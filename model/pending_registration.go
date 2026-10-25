package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// PendingRegistrationTTL is how long a verification link stays usable.
const PendingRegistrationTTL = 24 * time.Hour

var (
	ErrVerificationLinkInvalid = errors.New("verification link is invalid")
	ErrVerificationLinkExpired = errors.New("verification link has expired")
)

// PendingRegistration is a signup that has been submitted but not yet proven:
// the password is already hashed, the account does not exist, and the only way
// to turn this row into a user is to present the token that was mailed out.
//
// The token itself is never stored — only its SHA-256 — so a database leak
// cannot be replayed into account takeovers.
type PendingRegistration struct {
	Id           int    `json:"id"`
	Email        string `json:"email" gorm:"type:varchar(64);uniqueIndex;not null"`
	PasswordHash string `json:"-" gorm:"type:varchar(255);not null"`
	TokenHash    string `json:"-" gorm:"type:varchar(64);index;not null"`
	ExpiresAt    int64  `json:"expires_at" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"not null"`
	// AgreedAt records when the applicant accepted the terms and privacy
	// policy. Signup without it is refused, so the timestamp travels with the
	// account that is eventually created.
	AgreedAt int64 `json:"agreed_at"`
}

func (PendingRegistration) TableName() string {
	return "pending_registrations"
}

func hashVerificationToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newVerificationToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate verification token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// UpsertPendingRegistration stores (or replaces) the pending signup for an
// email and returns the fresh plaintext token to be mailed to the applicant.
// Replacing rather than appending keeps "request a new link" idempotent and
// invalidates every previously mailed link for that address.
func UpsertPendingRegistration(email string, passwordHash string, agreedAt int64) (string, error) {
	email = NormalizeEmail(email)
	if email == "" {
		return "", ErrVerificationLinkInvalid
	}
	token, err := newVerificationToken()
	if err != nil {
		return "", err
	}
	now := common.GetTimestamp()
	// Drop stale rows for this address so the unique index never blocks a
	// legitimate retry after the link has aged out.
	if err := DB.Where("email = ? AND expires_at < ?", email, now).
		Delete(&PendingRegistration{}).Error; err != nil {
		return "", err
	}
	pending := PendingRegistration{
		Email:        email,
		PasswordHash: passwordHash,
		TokenHash:    hashVerificationToken(token),
		ExpiresAt:    now + int64(PendingRegistrationTTL.Seconds()),
		CreatedAt:    now,
		AgreedAt:     agreedAt,
	}
	if err := DB.Where("email = ?", email).Assign(map[string]any{
		"password_hash": pending.PasswordHash,
		"token_hash":    pending.TokenHash,
		"expires_at":    pending.ExpiresAt,
		"created_at":    pending.CreatedAt,
		"agreed_at":     pending.AgreedAt,
	}).FirstOrCreate(&pending).Error; err != nil {
		return "", err
	}
	return token, nil
}

// ConsumePendingRegistration validates a token and removes it in the same
// transaction, so two clicks on the same link cannot both create an account.
func ConsumePendingRegistration(token string) (*PendingRegistration, error) {
	if token == "" {
		return nil, ErrVerificationLinkInvalid
	}
	tokenHash := hashVerificationToken(token)
	var pending PendingRegistration
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("token_hash = ?", tokenHash).First(&pending).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrVerificationLinkInvalid
			}
			return err
		}
		if pending.ExpiresAt < common.GetTimestamp() {
			return ErrVerificationLinkExpired
		}
		res := tx.Where("id = ?", pending.Id).Delete(&PendingRegistration{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrVerificationLinkInvalid
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &pending, nil
}

// RotatePendingRegistrationToken mints a new link for an existing pending
// signup, leaving the stored password hash alone. It reports false when there is
// nothing to resend, which callers must not surface to anonymous users.
func RotatePendingRegistrationToken(email string) (string, bool) {
	email = NormalizeEmail(email)
	if email == "" {
		return "", false
	}
	token, err := newVerificationToken()
	if err != nil {
		return "", false
	}
	now := common.GetTimestamp()
	res := DB.Model(&PendingRegistration{}).
		Where("email = ? AND expires_at >= ?", email, now).
		Updates(map[string]any{
			"token_hash": hashVerificationToken(token),
			"expires_at": now + int64(PendingRegistrationTTL.Seconds()),
			"created_at": now,
		})
	if res.Error != nil || res.RowsAffected == 0 {
		return "", false
	}
	return token, true
}
