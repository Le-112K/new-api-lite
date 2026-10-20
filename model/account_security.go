package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ErrCurrentPasswordInvalid = errors.New("Current password is incorrect.")
	ErrAccountPasswordState   = errors.New("Password settings have changed. Reload the page and try again.")
	ErrAccountBindingChanged  = errors.New("Account bindings have changed. Start this operation again.")
	ErrCannotDeleteRootUser   = errors.New("The root account cannot be deleted.")
)

// ChangeUserPassword rechecks the authorized session, password state and current
// password under the same user lock as the credential update. Only self-profile
// fields are accepted; a stale snapshot cannot restore roles or account status.
func ChangeUserPassword(identity AuthSessionIdentity, update *User, firstPassword bool) error {
	hash, err := common.HashAccountPassword(update.Password)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := ValidateAuthSessionWithTx(tx, identity); err != nil {
			return err
		}
		var current User
		if err := tx.First(&current, identity.UserID).Error; err != nil {
			return err
		}
		if firstPassword != (current.Password == "") {
			return ErrAccountPasswordState
		}
		if !firstPassword && !common.ValidatePasswordAndHash(update.OriginalPassword, current.Password) {
			return ErrCurrentPasswordInvalid
		}
		if current.Password != "" && common.ValidatePasswordAndHash(update.Password, current.Password) {
			return common.ErrAccountPasswordSame
		}
		changes := map[string]any{"password": hash}
		if update.Username != "" {
			changes["username"] = update.Username
		}
		if update.DisplayName != "" {
			changes["display_name"] = update.DisplayName
		}
		if _, err := IncrementUserAuthVersionWithTx(tx, identity.UserID); err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", identity.UserID).Updates(changes).Error; err != nil {
			return err
		}
		return tx.First(update, identity.UserID).Error
	})
}
