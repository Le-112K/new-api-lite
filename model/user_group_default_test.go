package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 新账号默认落在免费档。
// 这里显式断言而不是依赖列默认值：列默认值只在 CREATE 生效，
// 且历史库里该列的默认值仍是 'default'，靠它容易和代码期望脱节。
func TestInsertDefaultsNewUserToFreeTier(t *testing.T) {
	setupUserUpdateTestState(t)

	user := &User{
		Username: "fresh-user",
		Password: "TestPassword123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, user.Insert())

	var stored User
	require.NoError(t, DB.Where("username = ?", user.Username).First(&stored).Error)
	assert.Equal(t, "free", stored.Group)
}

// 管理员显式指定的分组不能被默认值覆盖：建号时就决定是 VIP 的账号，
// 不应该先落到 free 再靠改分组纠正。
func TestInsertPreservesExplicitlyAssignedGroup(t *testing.T) {
	setupUserUpdateTestState(t)

	user := &User{
		Username: "vip-user",
		Password: "TestPassword123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "vip",
	}
	require.NoError(t, user.Insert())

	var stored User
	require.NoError(t, DB.Where("username = ?", user.Username).First(&stored).Error)
	assert.Equal(t, "vip", stored.Group)
}
