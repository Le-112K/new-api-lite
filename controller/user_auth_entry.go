package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// authEntryRequest is the body of the single sign-in/sign-up endpoint.
type authEntryRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	// Optional transport encryption, mirroring the old /api/user/login body.
	PasswordEncrypted string `json:"password_encrypted"`
	EncryptionKeyID   string `json:"encryption_key_id"`
	// AgreeLegal is the applicant's explicit acceptance of the terms and the
	// privacy policy. It is only required on the signup path: an existing
	// account already accepted them when it was created.
	AgreeLegal bool `json:"agree_legal"`
}

// AuthEntry is the one entry point for both signing in and signing up.
//
// The email decides which of the two the request is:
//   - a known account → the password is checked and, on a match, a session is
//     issued exactly like /api/user/login does;
//   - an unknown address → the password is hashed, parked in
//     pending_registrations and a one-time verification link is mailed out.
//     Nothing is created until that link is opened.
//
// The two outcomes necessarily look different to the caller (a session vs. a
// "check your inbox" screen), so this endpoint is an account-existence oracle by
// construction. That is mitigated by keeping the failure message identical to
// the ordinary login error, by the strict per-IP rate limit on the route, and
// by the turnstile gate when it is enabled.
func AuthEntry(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordLoginDisabled)
		return
	}
	var req authEntryRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	email := model.NormalizeEmail(req.Email)
	username := strings.TrimSpace(req.Username)
	if email == "" && username == "" {
		common.ApiErrorI18n(c, i18n.MsgUserEmailRequired)
		return
	}
	password := req.Password
	if common.PasswordLoginEncryptionEnabled {
		if req.PasswordEncrypted == "" || req.EncryptionKeyID == "" {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		decrypted, err := common.DecryptPassword(req.PasswordEncrypted, req.EncryptionKeyID)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
		password = decrypted
	}
	if password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// Super administrators keep the classic username + password sign-in. Their
	// accounts predate the email identity and may have no email at all, so the
	// email branch below can never find them. This path is gated on the root
	// role: registered users derive a username from their email, and allowing
	// them through here would sidestep the email identity entirely.
	if username != "" {
		if strings.Contains(username, "@") {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
		failureKey := "root_username:" + strings.ToLower(username)
		if common.IsLoginLockedOut(failureKey) {
			common.SysLog("root username sign-in locked out: " + username)
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
		rootUser, err := model.GetRootUserByUsername(username)
		if err != nil || rootUser == nil ||
			rootUser.Status != common.UserStatusEnabled ||
			!common.ValidatePasswordAndHash(password, rootUser.Password) {
			common.NoteLoginFailure(failureKey)
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
		common.ClearLoginFailures(failureKey)
		c.Set("login_method", "root_username")
		setupLogin(rootUser, c)
		return
	}

	user, err := model.GetUniqueUserByEmail(email)
	switch {
	case err == nil && user != nil:
		// Known account: the password alone decides. No email is sent, so a
		// returning user never has to open their inbox again.
		if !common.ValidatePasswordAndHash(password, user.Password) ||
			user.Status != common.UserStatusEnabled {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
		c.Set("login_method", "password")
		setupLogin(user, c)
		return
	case errors.Is(err, model.ErrEmailNotFound):
		// fall through to the signup path
	case errors.Is(err, model.ErrEmailAmbiguous):
		// Legacy duplicate rows cannot be resolved safely; do not guess.
		common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
		return
	default:
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	// Unknown address from here on: this request is a signup.
	if !common.RegisterEnabled || !common.PasswordRegisterEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		return
	}
	// A soft-deleted account still occupies the unique index, so it must not be
	// allowed to start a pending signup it could never complete.
	if available, err := model.IsEmailAvailable(email, 0); err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	} else if !available {
		common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
		return
	}
	if !req.AgreeLegal {
		common.ApiErrorI18n(c, i18n.MsgUserLegalConsentRequired)
		return
	}
	if err := common.ValidateNewAccountPassword(password); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	passwordHash, err := common.HashAccountPassword(password)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
		return
	}
	token, err := model.UpsertPendingRegistration(email, passwordHash, common.GetTimestamp())
	if err != nil {
		common.SysError(fmt.Sprintf("failed to store pending registration for %s: %v", email, err))
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	if err := sendSignupVerificationEmail(c, email, token); err != nil {
		common.SysError(fmt.Sprintf("failed to send signup verification email to %s: %v", email, err))
		common.ApiErrorI18n(c, i18n.MsgUserVerificationEmailFailed)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"action": "verify_email",
			"email":  email,
		},
	})
}

// VerifyEmailLink turns a clicked link into an account: the token is consumed
// (single use), the parked password hash becomes the account password, and the
// caller is signed in so the redirect after verification lands in the console
// rather than on another form.
func VerifyEmailLink(c *gin.Context) {
	var req struct {
		Token string `json:"token"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	// The token is read from the body, never from the URL, so it does not end up
	// in access logs, Referer headers or browser history of the API call.
	pending, err := model.ConsumePendingRegistration(req.Token)
	if err != nil {
		switch {
		case errors.Is(err, model.ErrVerificationLinkExpired):
			common.ApiErrorI18n(c, i18n.MsgUserVerificationLinkExpired)
		case errors.Is(err, model.ErrVerificationLinkInvalid):
			common.ApiErrorI18n(c, i18n.MsgUserVerificationLinkInvalid)
		default:
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		}
		return
	}

	username, err := model.DeriveUsernameFromEmail(pending.Email)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to derive username for %s: %v", pending.Email, err))
		common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
		return
	}
	user, err := model.CreateVerifiedUser(username, pending.Email, pending.PasswordHash)
	if err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
			return
		}
		common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
		return
	}

	c.Set("login_method", "email_link")
	setupLogin(user, c)
}

// ResendVerification mints a fresh link for a pending signup. The response is
// deliberately identical whether or not anything was sent: this endpoint must
// not become the account oracle that AuthEntry cannot avoid being.
func ResendVerification(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	email := model.NormalizeEmail(req.Email)
	if email == "" {
		common.ApiErrorI18n(c, i18n.MsgUserEmailRequired)
		return
	}
	if token, ok := model.RotatePendingRegistrationToken(email); ok {
		if err := sendSignupVerificationEmail(c, email, token); err != nil {
			common.SysError(fmt.Sprintf("failed to resend signup verification email to %s: %v", email, err))
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"action": "verify_email",
			"email":  email,
		},
	})
}

// signupVerificationURL builds the link that goes into the mail. It prefers the
// configured server address and only falls back to the request origin when that
// address is still the shipped localhost default.
func signupVerificationURL(c *gin.Context, token string) string {
	base := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if base == "" || strings.Contains(base, "localhost") || strings.Contains(base, "127.0.0.1") {
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded == "https" || forwarded == "http" {
			scheme = forwarded
		}
		host := c.Request.Host
		if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Host")); forwarded != "" {
			host = forwarded
		}
		base = scheme + "://" + host
	}
	return base + "/verify?token=" + url.QueryEscape(token)
}

func sendSignupVerificationEmail(c *gin.Context, email string, token string) error {
	lang := i18n.GetLangFromContext(c)
	link := signupVerificationURL(c, token)
	systemName := common.SystemName
	subject := i18n.Translate(lang, "email.signup_subject", map[string]any{"SystemName": systemName})
	body := buildSignupVerificationEmailHTML(lang, systemName, link)
	return common.SendEmail(subject, email, body)
}

func buildSignupVerificationEmailHTML(lang string, systemName string, link string) string {
	tr := func(key string, args map[string]any) string {
		return i18n.Translate(lang, key, args)
	}
	title := tr("email.signup_title", nil)
	intro := tr("email.signup_body", map[string]any{"SystemName": systemName})
	button := tr("email.signup_button", nil)
	fallback := tr("email.signup_fallback", nil)
	expiry := tr("email.signup_expiry", nil)
	ignore := tr("email.signup_ignore", nil)
	return fmt.Sprintf(`<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="padding:0 4px 20px;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#0a0a0a;">%s</td></tr>
    <tr><td style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:32px;">
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0a0a0a;letter-spacing:-0.01em;">%s</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#52525b;">%s</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0a0a0a;">
        <a href="%s" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">%s</a>
      </td></tr></table>
      <p style="margin:24px 0 6px;font-size:12px;color:#8a8a8f;">%s</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#52525b;word-break:break-all;">%s</p>
      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:24px 0;" />
      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8a8a8f;">%s</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8f;">%s</p>
    </td></tr>
  </table>
</body></html>`,
		systemName, title, intro, link, button, fallback, link, expiry, ignore)
}
