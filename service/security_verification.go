package service

import (
	"crypto/hmac"
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	VerificationMethodPassword = "password"
	VerificationMethodSession  = "session"
	VerificationScopeChannelKeyRead = "channel.key.read"
	VerificationScopeLogin          = "auth.login"
	VerificationScopeAccessTokenGenerate = "access_token.generate"
	VerificationScopeAccessTokenRevoke   = "access_token.revoke"
	VerificationScopeAccessTokenUpdate   = "access_token.update"
	VerificationScopeAccountBind         = "account.binding.bind"
	VerificationScopePasswordSet         = "account.password.set"
	VerificationScopePasswordChange      = "account.password.change"
	VerificationScopeAccountDelete       = "account.delete"
	// Administrative step-up scopes bind the managed user into the proof so a
	// proof issued for one account cannot be replayed against another.
	VerificationScopeAdminUserCreate = "admin.user.create"
	VerificationScopeAdminUserUpdate = "admin.user.update"
	VerificationScopeAdminUserDelete = "admin.user.delete"
	VerificationScopeAdminUserManage = "admin.user.manage"
	verificationScopeAdminUserPrefix = "admin.user."
)

// adminUserManageActions are the ManageUser actions that change a user's
// status or role. Quota adjustments are not gated and deletion has its own scope.
var adminUserManageActions = []string{"disable", "enable", "promote", "demote"}

var (
	ErrVerificationFailed         = errors.New("Verification failed. Please try again.")
	ErrVerificationUnavailable    = errors.New("This verification method is currently unavailable.")
	ErrVerificationLocked         = errors.New("Verification is temporarily locked.")
	ErrVerificationContextInvalid = errors.New("The action details are invalid.")
	ErrVerificationForbidden      = errors.New("You do not have permission to perform this action.")
)

// VerificationOperation describes the action being authorized, independently of
// its authentication method. Each scope owns a strict, normalized context schema.
type VerificationOperation struct {
	Scope   string          `json:"scope"`
	Context json.RawMessage `json:"context,omitempty"`
}

type ChannelKeyReadContext struct {
	ChannelID int `json:"channel_id"`
}

type AccountBindingContext struct {
	Provider string `json:"provider"`
	Email    string `json:"email,omitempty"`
	Code     string `json:"code,omitempty"`
}

type AdminUserContext struct {
	UserID int `json:"user_id"`
}

type AdminUserManageContext struct {
	UserID int    `json:"user_id"`
	Action string `json:"action"`
}

type AdminUserCreateContext struct {
	Role int `json:"role"`
}

// AccessTokenGenerateContext binds a creation proof to the exact grant. Scopes
// are compared as a sorted, de-duplicated set.
type AccessTokenGenerateContext struct {
	Scopes    []string `json:"scopes"`
	ExpiresAt int64    `json:"expires_at"`
}

// AccessTokenUpdateContext binds a grant change to one token and the exact new
// grant, compared as a sorted, de-duplicated set.
type AccessTokenUpdateContext struct {
	TokenID int      `json:"token_id"`
	Scopes  []string `json:"scopes"`
}

// AccessTokenRevokeContext names exactly one token: a scoped token ID or the
// legacy token.
type AccessTokenRevokeContext struct {
	TokenID int  `json:"token_id,omitempty"`
	Legacy  bool `json:"legacy,omitempty"`
}

const (
	maxAccessTokenContextScopes   = 128
	maxAccessTokenContextScopeLen = 64
)

// NormalizeAccessTokenScopeList trims, de-duplicates and sorts scope keys. It
// only checks the shape; grantability is checked against the scope catalog.
func NormalizeAccessTokenScopeList(scopes []string) ([]string, bool) {
	if len(scopes) == 0 || len(scopes) > maxAccessTokenContextScopes {
		return nil, false
	}
	normalized := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" || len(scope) > maxAccessTokenContextScopeLen {
			return nil, false
		}
		normalized = append(normalized, scope)
	}
	slices.Sort(normalized)
	return slices.Compact(normalized), true
}

// VerificationBinding contains no original operation parameters. It can safely
// travel through a signed proof or a server-owned interactive verification flow.
type VerificationBinding struct {
	Scope       string `json:"scope"`
	ContextHash string `json:"context_hash"`
}

func BindVerificationOperation(operation VerificationOperation) (VerificationBinding, error) {
	var fields map[string]json.RawMessage
	if len(operation.Context) > 0 {
		if common.GetJsonType(operation.Context) != "object" || common.Unmarshal(operation.Context, &fields) != nil {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
	}
	var normalized any
	switch operation.Scope {
	case VerificationScopeChannelKeyRead:
		var context ChannelKeyReadContext
		if len(fields) != 1 || common.Unmarshal(fields["channel_id"], &context.ChannelID) != nil || context.ChannelID <= 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopeAccountBind:
		var context AccountBindingContext
		if common.Unmarshal(operation.Context, &context) != nil {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		context.Provider = strings.TrimSpace(context.Provider)
		switch context.Provider {
		case "email":
			context.Email = model.NormalizeEmail(context.Email)
			if len(fields) != 2 || common.Validate.Var(context.Email, "required,email") != nil || context.Code != "" {
				return VerificationBinding{}, ErrVerificationContextInvalid
			}
		default:
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopeAdminUserUpdate, VerificationScopeAdminUserDelete:
		var context AdminUserContext
		if len(fields) != 1 || common.Unmarshal(fields["user_id"], &context.UserID) != nil || context.UserID <= 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopeAdminUserManage:
		var context AdminUserManageContext
		if len(fields) != 2 || common.Unmarshal(operation.Context, &context) != nil || context.UserID <= 0 || !slices.Contains(adminUserManageActions, context.Action) {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopeAdminUserCreate:
		var context AdminUserCreateContext
		if len(fields) != 1 || common.Unmarshal(fields["role"], &context.Role) != nil || context.Role < common.RoleAdminUser || !common.IsValidateRole(context.Role) {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopeAccessTokenGenerate:
		var context AccessTokenGenerateContext
		if len(fields) != 2 || fields["scopes"] == nil || fields["expires_at"] == nil ||
			common.Unmarshal(operation.Context, &context) != nil || context.ExpiresAt < 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		scopes, ok := NormalizeAccessTokenScopeList(context.Scopes)
		if !ok {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		context.Scopes = scopes
		normalized = context
	case VerificationScopeAccessTokenUpdate:
		var context AccessTokenUpdateContext
		if len(fields) != 2 || common.Unmarshal(operation.Context, &context) != nil || context.TokenID <= 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		scopes, ok := NormalizeAccessTokenScopeList(context.Scopes)
		if !ok {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		context.Scopes = scopes
		normalized = context
	case VerificationScopeAccessTokenRevoke:
		var context AccessTokenRevokeContext
		if len(fields) != 1 || common.Unmarshal(operation.Context, &context) != nil || context.TokenID < 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		// Exactly one target: {"token_id": n} or {"legacy": true}.
		if (context.TokenID > 0) == context.Legacy {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = context
	case VerificationScopePasswordSet, VerificationScopePasswordChange, VerificationScopeAccountDelete:
		if len(fields) != 0 {
			return VerificationBinding{}, ErrVerificationContextInvalid
		}
		normalized = struct{}{}
	default:
		return VerificationBinding{}, ErrProofScope
	}
	payload, err := common.Marshal(struct {
		Scope   string `json:"scope"`
		Context any    `json:"context"`
	}{Scope: operation.Scope, Context: normalized})
	if err != nil {
		return VerificationBinding{}, err
	}
	return VerificationBinding{
		Scope:       operation.Scope,
		ContextHash: common.GenerateHMACWithKey(authSigningKey("verification-context"), string(payload)),
	}, nil
}

type SecurityProof struct {
	ProofToken string `json:"proof_token"`
	ExpiresAt  int64  `json:"expires_at"`
	Method     string `json:"method"`
	Scope      string `json:"scope"`
}

type VerificationMethodOption struct {
	Method    string `json:"method"`
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

type VerificationRequirements struct {
	Scope                     string                     `json:"scope"`
	Methods                   []VerificationMethodOption `json:"methods"`
	PasswordEncryptionEnabled bool                       `json:"password_encryption_enabled"`
}

// securityVerificationPolicy is the only operation-to-method policy. Device
// support and disabled providers never turn an enrolled factor into an absent one.
func securityVerificationPolicy(scope string, state model.UserVerificationState) ([]VerificationMethodOption, error) {
	var methods []string
	switch scope {
	case VerificationScopeChannelKeyRead, VerificationScopeLogin:
		// Login offers no verification method: the second factors that used to
		// require a step-up here were removed. An empty list means the caller
		// treats the account as "no step-up required" and issues the session.
	case VerificationScopeAccessTokenGenerate, VerificationScopeAccessTokenUpdate, VerificationScopeAccessTokenRevoke,
		VerificationScopeAccountBind, VerificationScopePasswordSet, VerificationScopePasswordChange,
		VerificationScopeAccountDelete, VerificationScopeAdminUserCreate, VerificationScopeAdminUserUpdate,
		VerificationScopeAdminUserDelete, VerificationScopeAdminUserManage:
		if scope == VerificationScopeAccountDelete && state.Role == common.RoleRootUser {
			return nil, ErrVerificationForbidden
		}
		if (scope == VerificationScopePasswordSet && state.HasPassword) || (scope == VerificationScopePasswordChange && !state.HasPassword) {
			return nil, ErrVerificationForbidden
		}
		// The password is the only remaining step-up factor. An account without
		// one cannot authorize these actions at all.
		if !state.HasPassword {
			return nil, ErrVerificationUnavailable
		}
		methods = []string{VerificationMethodPassword}
	default:
		return nil, ErrProofScope
	}
	options := make([]VerificationMethodOption, 0, len(methods))
	for _, method := range methods {
		options = append(options, VerificationMethodOption{Method: method, Available: true})
	}
	return options, nil
}

func GetVerificationRequirements(identity AuthIdentity, scope string) (*VerificationRequirements, error) {
	if scope == VerificationScopeLogin {
		return nil, ErrProofScope
	}
	state, err := model.GetUserVerificationState(identity.UserID)
	if err != nil {
		return nil, err
	}
	if state.Status != common.UserStatusEnabled || state.AuthVersion != identity.UserAuthVersion {
		return nil, ErrAuthTokenInvalid
	}
	if scope == VerificationScopeChannelKeyRead && state.Role != common.RoleRootUser {
		return nil, ErrVerificationForbidden
	}
	if strings.HasPrefix(scope, verificationScopeAdminUserPrefix) && state.Role < common.RoleAdminUser {
		return nil, ErrVerificationForbidden
	}
	if err := requireAccessTokenVerificationScope(identity, scope); err != nil {
		return nil, err
	}
	methods, err := securityVerificationPolicy(scope, *state)
	if err != nil {
		return nil, err
	}
	requirements := &VerificationRequirements{Scope: scope, Methods: methods, PasswordEncryptionEnabled: common.PasswordLoginEncryptionEnabled}
	for i := range methods {
		if methods[i].Method == VerificationMethodPassword && !common.PasswordLoginEnabled {
			switch scope {
			case VerificationScopeAccountBind, VerificationScopePasswordSet, VerificationScopePasswordChange,
				VerificationScopeAccountDelete, VerificationScopeAdminUserCreate, VerificationScopeAdminUserUpdate,
				VerificationScopeAdminUserDelete, VerificationScopeAdminUserManage:
				methods[i].Available, methods[i].Reason = false, "Password authentication is disabled."
			}
		}
	}
	return requirements, nil
}

func RequireVerificationMethod(identity AuthIdentity, scope, method string) (*VerificationRequirements, error) {
	requirements, err := GetVerificationRequirements(identity, scope)
	if err != nil {
		return nil, err
	}
	for _, option := range requirements.Methods {
		if option.Method != method {
			continue
		}
		if !option.Available {
			return nil, ErrVerificationUnavailable
		}
		return requirements, nil
	}
	return nil, ErrProofMethod
}

// CompleteSecurityVerification runs after the concrete authentication ceremony.
// Recheck the session and policy after potentially slow external authentication.
func CompleteSecurityVerification(identity AuthIdentity, binding VerificationBinding, method string) (*SecurityProof, error) {
	if err := ValidateStepUpIdentity(identity); err != nil {
		return nil, err
	}
	if _, err := RequireVerificationMethod(identity, binding.Scope, method); err != nil {
		return nil, err
	}
	token, expiresAt, err := IssueSecurityProof(identity, method, binding)
	if err != nil {
		return nil, err
	}
	return &SecurityProof{ProofToken: token, ExpiresAt: expiresAt, Method: method, Scope: binding.Scope}, nil
}

// ConsumeOperationProof accepts a proof at most once. The consumption commits
// before the caller performs its action; an action failure must not restore it.
func ConsumeOperationProof(raw string, identity AuthIdentity, operation VerificationOperation) (*model.AuthFlowAuthorization, error) {
	binding, err := BindVerificationOperation(operation)
	if err != nil {
		return nil, err
	}
	claims, err := verifySecurityProof(raw, identity, binding)
	if err != nil {
		return nil, err
	}
	if err := ValidateStepUpIdentity(identity); err != nil {
		return nil, err
	}
	if _, err := RequireVerificationMethod(identity, binding.Scope, claims.Method); err != nil {
		return nil, err
	}
	flow, err := model.ConsumeAuthFlowWithAction(claims.ID, model.AuthFlowMatch{
		Purpose: model.AuthFlowPurposeSecurityProof, UserId: identity.UserID, SessionId: identity.SessionID,
	}, func(tx *gorm.DB, _ *model.AuthFlow) error {
		return model.ValidateAuthSessionWithTx(tx, identity)
	})
	switch {
	case errors.Is(err, model.ErrAuthFlowConsumed):
		return nil, ErrProofConsumed
	case errors.Is(err, model.ErrAuthFlowExpired):
		return nil, ErrAuthTokenExpired
	case errors.Is(err, model.ErrAuthFlowInvalid):
		return nil, ErrAuthTokenInvalid
	case err != nil:
		return nil, err
	}
	return &model.AuthFlowAuthorization{
		AuthSessionIdentity: identity, ProofID: flow.Id, Scope: binding.Scope,
		ContextHash: binding.ContextHash, Method: claims.Method,
	}, nil
}

// ValidateFlowAuthorization permits a dedicated configuration flow to outlive
// its consumed proof, while retaining its operation, session and method policy.
func ValidateFlowAuthorization(identity AuthIdentity, operation VerificationOperation, authorization *model.AuthFlowAuthorization) error {
	if authorization == nil || authorization.ProofID <= 0 || authorization.AuthSessionIdentity != identity {
		return model.ErrAuthFlowInvalid
	}
	binding, err := BindVerificationOperation(operation)
	if err != nil {
		return err
	}
	if authorization.Scope != binding.Scope || !hmac.Equal([]byte(authorization.ContextHash), []byte(binding.ContextHash)) {
		return model.ErrAuthFlowInvalid
	}
	if err := ValidateStepUpIdentity(identity); err != nil {
		return err
	}
	_, err = RequireVerificationMethod(identity, binding.Scope, authorization.Method)
	return err
}

type VerificationInput struct {
	Method            string          `json:"method"`
	Scope             string          `json:"scope"`
	Context           json.RawMessage `json:"context,omitempty"`
	Code              string          `json:"code,omitempty"`
	Password          string          `json:"password,omitempty"`
	PasswordEncrypted string          `json:"password_encrypted,omitempty"`
	EncryptionKeyID   string          `json:"encryption_key_id,omitempty"`
}

func VerifySecurityInput(identity AuthIdentity, input VerificationInput) (*SecurityProof, error) {
	binding, err := BindVerificationOperation(VerificationOperation{Scope: input.Scope, Context: input.Context})
	if err != nil {
		return nil, err
	}
	if _, err := RequireVerificationMethod(identity, input.Scope, input.Method); err != nil {
		return nil, err
	}
	switch input.Method {
	case VerificationMethodPassword:
		password := input.Password
		if common.PasswordLoginEncryptionEnabled {
			var err error
			password, err = common.DecryptPassword(input.PasswordEncrypted, input.EncryptionKeyID)
			if err != nil {
				return nil, ErrVerificationFailed
			}
		}
		user, err := model.GetUserById(identity.UserID, true)
		if err != nil {
			return nil, err
		}
		if password == "" || user.Password == "" || !common.ValidatePasswordAndHash(password, user.Password) {
			return nil, ErrVerificationFailed
		}
	default:
		return nil, ErrProofMethod
	}
	return CompleteSecurityVerification(identity, binding, input.Method)
}
