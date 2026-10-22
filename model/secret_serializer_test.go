package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// F-005 回归锁：渠道上游 key 落库必须是信封密文，内存/接口层保持明文；
// 历史明文行可读且会被启动迁移自动加密。

func rawChannelKey(t *testing.T, id int) string {
	t.Helper()
	var raw string
	require.NoError(t, DB.Raw("SELECT `key` FROM channels WHERE id = ?", id).Scan(&raw).Error)
	return raw
}

func useSecretBoxTestKey(t *testing.T) {
	t.Helper()
	old := common.CryptoSecret
	common.CryptoSecret = "test-secret-box"
	t.Cleanup(func() { common.CryptoSecret = old })
}

func TestChannelKeyIsEncryptedAtRest(t *testing.T) {
	truncateTables(t)
	useSecretBoxTestKey(t)

	channel := &Channel{Name: "enc-at-rest", Key: "sk-upstream-plain", Type: 1}
	require.NoError(t, channel.Insert())

	stored := rawChannelKey(t, channel.Id)
	assert.True(t, common.IsEncryptedSecret(stored), "DB 应存密文, got %q", stored)
	assert.NotContains(t, stored, "sk-upstream-plain")

	loaded := &Channel{}
	require.NoError(t, DB.First(loaded, "id = ?", channel.Id).Error)
	assert.Equal(t, "sk-upstream-plain", loaded.Key, "内存中应还原明文")
}

func TestChannelKeyMultiKeyBlobRoundTrip(t *testing.T) {
	truncateTables(t)
	useSecretBoxTestKey(t)

	channel := &Channel{Name: "enc-multi", Key: "sk-one\nsk-two\nsk-three", Type: 1}
	require.NoError(t, channel.Insert())

	assert.NotContains(t, rawChannelKey(t, channel.Id), "sk-one")

	loaded := &Channel{}
	require.NoError(t, DB.First(loaded, "id = ?", channel.Id).Error)
	assert.Equal(t, []string{"sk-one", "sk-two", "sk-three"}, loaded.GetKeys())
}

func TestMigrateChannelKeyEncryptionWrapsLegacyPlaintext(t *testing.T) {
	truncateTables(t)
	useSecretBoxTestKey(t)

	// 绕过序列化器直接插历史明文行，模拟升级前的存量数据。
	require.NoError(t, DB.Exec("INSERT INTO channels (id, name, type, `key`, status) VALUES (9001, 'legacy', 1, 'sk-legacy-plain', 1)").Error)
	require.NoError(t, DB.Exec("INSERT INTO channels (id, name, type, `key`, status) VALUES (9002, 'empty', 1, '', 1)").Error)

	migrated, err := MigrateChannelKeyEncryption()
	require.NoError(t, err)
	assert.Equal(t, 1, migrated, "只迁移非空明文行")

	stored := rawChannelKey(t, 9001)
	assert.True(t, common.IsEncryptedSecret(stored))
	assert.NotContains(t, stored, "sk-legacy-plain")

	loaded := &Channel{}
	require.NoError(t, DB.First(loaded, "id = ?", 9001).Error)
	assert.Equal(t, "sk-legacy-plain", loaded.Key)

	// 幂等：再跑一次没有可迁移行。
	migrated, err = MigrateChannelKeyEncryption()
	require.NoError(t, err)
	assert.Zero(t, migrated)
}

func TestChannelKeyUpdateKeepsEncryption(t *testing.T) {
	truncateTables(t)
	useSecretBoxTestKey(t)

	channel := &Channel{Name: "enc-update", Key: "sk-old", Type: 1}
	require.NoError(t, channel.Insert())

	channel.Key = "sk-new"
	require.NoError(t, channel.Update())

	stored := rawChannelKey(t, channel.Id)
	assert.True(t, common.IsEncryptedSecret(stored))
	assert.NotContains(t, stored, "sk-new")

	loaded := &Channel{}
	require.NoError(t, DB.First(loaded, "id = ?", channel.Id).Error)
	assert.Equal(t, "sk-new", loaded.Key)
}

func TestSecretBoxRoundTripAndTamperDetection(t *testing.T) {
	useSecretBoxTestKey(t)

	wrapped, err := common.EncryptSecretString("sk-round-trip")
	require.NoError(t, err)
	assert.True(t, common.IsEncryptedSecret(wrapped))

	plain, err := common.DecryptSecretString(wrapped)
	require.NoError(t, err)
	assert.Equal(t, "sk-round-trip", plain)

	// 幂等：已包装的值再包一次不变。
	again, err := common.EncryptSecretString(wrapped)
	require.NoError(t, err)
	assert.Equal(t, wrapped, again)

	// 旧明文透传。
	legacy, err := common.DecryptSecretString("sk-legacy-plain")
	require.NoError(t, err)
	assert.Equal(t, "sk-legacy-plain", legacy)

	// 篡改密文必须失败，不能静默放行。
	tampered := wrapped[:len(wrapped)-4] + "AAAA"
	_, err = common.DecryptSecretString(tampered)
	assert.ErrorIs(t, err, common.ErrSecretBoxDecrypt)

	// 换密钥解密必须失败（防止弱派生）。
	other, err := common.EncryptSecretString("sk-under-other-secret")
	require.NoError(t, err)
	common.CryptoSecret = "another-secret"
	_, err = common.DecryptSecretString(other)
	assert.ErrorIs(t, err, common.ErrSecretBoxDecrypt)
}
