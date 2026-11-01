package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupTierTestDB 准备一个只含 abilities 的内存库，用于档位判定。
func setupTierTestDB(t *testing.T, abilities []model.Ability) {
	t.Helper()
	previous := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Ability{}))
	model.DB = db
	for i := range abilities {
		require.NoError(t, db.Create(&abilities[i]).Error)
	}
	t.Cleanup(func() { model.DB = previous })
}

func TestRequiredTierFollowsLowestEnabledGroup(t *testing.T) {
	setupTierTestDB(t, []model.Ability{
		// 免费模型：同时挂在 free 与 vip
		{Group: "free", Model: "deepseek", ChannelId: 1, Enabled: true},
		{Group: "vip", Model: "deepseek", ChannelId: 1, Enabled: true},
		// VIP 模型：只挂 vip
		{Group: "vip", Model: "glm", ChannelId: 1, Enabled: true},
		// SVIP 专属
		{Group: "svip", Model: "gpt", ChannelId: 1, Enabled: true},
		// 被禁用的渠道不参与判定
		{Group: "free", Model: "claude", ChannelId: 1, Enabled: false},
		{Group: "svip", Model: "claude", ChannelId: 1, Enabled: true},
	})

	cases := []struct {
		model    string
		wantTier string
		wantOK   bool
	}{
		{"deepseek", SubscriptionTierFree, true},
		{"glm", SubscriptionTierVip, true},
		{"gpt", SubscriptionTierSvip, true},
		// 只在 svip 有启用的渠道，免费的禁用记录不算
		{"claude", SubscriptionTierSvip, true},
		{"unknown-model", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			tier, ok := RequiredTierForModel(tc.model)
			require.Equal(t, tc.wantOK, ok)
			require.Equal(t, tc.wantTier, tier)
		})
	}
}

func TestCanTierAccessModelIsDownwardCompatible(t *testing.T) {
	setupTierTestDB(t, []model.Ability{
		{Group: "free", Model: "deepseek", ChannelId: 1, Enabled: true},
		{Group: "vip", Model: "glm", ChannelId: 1, Enabled: true},
		{Group: "svip", Model: "gpt", ChannelId: 1, Enabled: true},
	})

	cases := []struct {
		tier  string
		model string
		want  bool
	}{
		// 免费档只能用免费模型
		{SubscriptionTierFree, "deepseek", true},
		{SubscriptionTierFree, "glm", false},
		{SubscriptionTierFree, "gpt", false},
		// VIP 向下兼容免费模型
		{SubscriptionTierVip, "deepseek", true},
		{SubscriptionTierVip, "glm", true},
		{SubscriptionTierVip, "gpt", false},
		// SVIP 全可用
		{SubscriptionTierSvip, "deepseek", true},
		{SubscriptionTierSvip, "glm", true},
		{SubscriptionTierSvip, "gpt", true},
		// 未挂任何档位分组的模型不按档位拦截，交给渠道选择报错
		{SubscriptionTierFree, "not-configured", true},
	}

	for _, tc := range cases {
		t.Run(tc.tier+"/"+tc.model, func(t *testing.T) {
			require.Equal(t, tc.want, CanTierAccessModel(tc.tier, tc.model))
		})
	}
}

// default 是 new-api 的出厂分组名，迁移期按免费档处理。
func TestDefaultGroupIsTreatedAsFreeTier(t *testing.T) {
	require.Equal(t, SubscriptionTierFree, NormalizeSubscriptionTier("default"))
	require.Equal(t, SubscriptionTierFree, NormalizeSubscriptionTier(" free "))
	require.Equal(t, SubscriptionTierVip, NormalizeSubscriptionTier("vip"))
	require.Equal(t, "", NormalizeSubscriptionTier("some-custom-group"))
	require.Equal(t, -1, SubscriptionTierIndex("some-custom-group"))

	require.Equal(t, []string{"free"}, SubscriptionTierGroups("default"))
	require.Equal(t, []string{"free", "vip"}, SubscriptionTierGroups("vip"))
	require.Equal(t, []string{"free", "vip", "svip"}, SubscriptionTierGroups("svip"))
}
