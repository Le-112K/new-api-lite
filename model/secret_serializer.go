package model

import (
	"context"
	"reflect"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/schema"
)

// SecretSerializer transparently encrypts credential columns at rest.
// In-memory values stay plaintext (the relay needs them); the database
// stores the AES-GCM envelope produced by common.EncryptSecretString.
// Legacy plaintext rows pass through unchanged on read and are re-encrypted
// on their next write (or by MigrateChannelKeyEncryption at startup).
type SecretSerializer struct{}

func (SecretSerializer) Scan(ctx context.Context, field *schema.Field, dst reflect.Value, dbValue interface{}) error {
	raw, _ := dbValue.(string)
	plain, err := common.DecryptSecretString(raw)
	if err != nil {
		return err
	}
	field.ReflectValueOf(ctx, dst).SetString(plain)
	return nil
}

func (SecretSerializer) Value(_ context.Context, _ *schema.Field, _ reflect.Value, fieldValue interface{}) (interface{}, error) {
	secret, _ := fieldValue.(string)
	return common.EncryptSecretString(secret)
}

func init() {
	schema.RegisterSerializer("secret", SecretSerializer{})
}

// MigrateChannelKeyEncryption wraps legacy plaintext channel keys in the
// AES-GCM envelope so database dumps stop exposing upstream credentials.
// Detection reads the raw column because loaded structs are already
// decrypted. The write encrypts explicitly and relies on
// common.EncryptSecretString being idempotent: whether or not the update
// path also runs the serializer, the key ends up wrapped exactly once.
func MigrateChannelKeyEncryption() (int, error) {
	refCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"key"`
	}
	var rows []struct {
		Id  int
		Key string
	}
	if err := DB.Raw("SELECT id, " + refCol + " FROM channels WHERE " + refCol + " <> '' AND " + refCol + " NOT LIKE 'enc:v1:%'").Scan(&rows).Error; err != nil {
		return 0, err
	}
	for _, row := range rows {
		encrypted, err := common.EncryptSecretString(row.Key)
		if err != nil {
			return 0, err
		}
		if err := DB.Model(&Channel{}).Where("id = ?", row.Id).Update("key", encrypted).Error; err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}
