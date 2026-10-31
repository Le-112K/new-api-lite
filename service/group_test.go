package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

// auto 分组顺序机制已移除：auto 不再是可选择的计费分组。
// 这组用例锁定该语义，避免后续有人把 auto 重新加回定价表或可用分组表。
func TestAutoGroupIsNoLongerSelectable(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalUsable := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsable))
	})

	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))

	// auto 不在定价分组表里 → 永远不可选，即使有人把它写进可用分组表
	require.False(t, IsUserSelectableGroup("default", "auto"))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
	require.False(t, IsUserSelectableGroup("default", "auto"))

	// 正常分组仍然可选
	require.True(t, IsUserSelectableGroup("default", "default"))
	require.True(t, IsUserSelectableGroup("default", "vip"))
	require.False(t, IsUserSelectableGroup("default", "nonexistent"))
	require.False(t, IsUserSelectableGroup("default", ""))
}

// 分组可见性仍然按「全局可用分组 + 按用户分组的增删」生效，
// 这是订阅制下隔离档位的唯一闸门。
func TestGroupVisibilityNarrowsUsableGroups(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalUsable := setting.UserUsableGroups2JSONString()
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	originalSpecial := special.ReadAll()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsable))
		special.Clear()
		special.AddAll(originalSpecial)
	})

	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"free":1,"vip":1,"svip":1}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"free":"Free","vip":"VIP","svip":"SVIP"}`))
	special.Clear()
	// free 用户看不到 vip / svip；vip 用户看不到 svip
	special.Set("free", map[string]string{"-:vip": "", "-:svip": ""})
	special.Set("vip", map[string]string{"-:svip": ""})

	require.True(t, IsUserSelectableGroup("free", "free"))
	require.False(t, IsUserSelectableGroup("free", "vip"))
	require.False(t, IsUserSelectableGroup("free", "svip"))

	require.True(t, IsUserSelectableGroup("vip", "free"))
	require.True(t, IsUserSelectableGroup("vip", "vip"))
	require.False(t, IsUserSelectableGroup("vip", "svip"))

	require.True(t, IsUserSelectableGroup("svip", "svip"))
}
