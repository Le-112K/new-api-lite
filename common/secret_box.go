package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

// 信封加密前缀：带此前缀的值视为已加密，禁止二次加密；不带前缀的值按
// 历史明文透传（读路径），保存时才加密（惰性迁移）。
const secretBoxPrefix = "enc:v1:"

var ErrSecretBoxDecrypt = errors.New("secret box decryption failed")

func IsEncryptedSecret(value string) bool {
	return strings.HasPrefix(value, secretBoxPrefix)
}

func secretBoxAEAD() (cipher.AEAD, error) {
	mac := hmac.New(sha256.New, []byte(CryptoSecret))
	mac.Write([]byte("secret-box-v1"))
	key := mac.Sum(nil)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// EncryptSecretString wraps a secret (an upstream API key) in an AES-256-GCM
// envelope derived from CryptoSecret so database dumps and backups do not
// expose it in plaintext. Already-wrapped and empty values pass through.
func EncryptSecretString(plaintext string) (string, error) {
	if plaintext == "" || IsEncryptedSecret(plaintext) {
		return plaintext, nil
	}
	aead, err := secretBoxAEAD()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return secretBoxPrefix + base64.RawStdEncoding.EncodeToString(sealed), nil
}

// DecryptSecretString opens a value produced by EncryptSecretString. Legacy
// plaintext values (no envelope prefix) are returned unchanged so existing
// rows keep working until their next save re-encrypts them.
func DecryptSecretString(value string) (string, error) {
	if value == "" || !IsEncryptedSecret(value) {
		return value, nil
	}
	raw, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(value, secretBoxPrefix))
	if err != nil {
		return "", ErrSecretBoxDecrypt
	}
	aead, err := secretBoxAEAD()
	if err != nil {
		return "", err
	}
	nonceSize := aead.NonceSize()
	if len(raw) < nonceSize {
		return "", ErrSecretBoxDecrypt
	}
	plaintext, err := aead.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", ErrSecretBoxDecrypt
	}
	return string(plaintext), nil
}
