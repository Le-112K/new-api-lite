package controller

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 公开套餐视图必须只带展示字段。
//
// 这个端点是匿名的，一旦有人图省事直接返回 model.SubscriptionPlan，运营侧的
// sort_order、allow_wallet_overflow 之类配置就跟着公开了。这里用序列化结果
// 锁边界：卡片要用的字段在，内部配置不在。
func TestToPublicSubscriptionPlanExposesDisplayFieldsOnly(t *testing.T) {
	allowBalance := false
	plan := model.SubscriptionPlan{
		Id:                 7,
		Title:              "Lite轻享版",
		Subtitle:           "日常轻度使用",
		PriceAmount:        6.88,
		Currency:           "USD",
		DurationUnit:       "month",
		DurationValue:      1,
		TotalAmount:        100000,
		QuotaResetPeriod:   "daily",
		UpgradeGroup:       "vip",
		MaxPurchasePerUser: 3,
		SortOrder:          99,
		AllowBalancePay:    &allowBalance,
	}

	got := toPublicSubscriptionPlan(plan)

	assert.Equal(t, 7, got.Id)
	assert.Equal(t, "Lite轻享版", got.Title)
	assert.Equal(t, 6.88, got.PriceAmount)
	assert.Equal(t, int64(100000), got.TotalAmount)
	assert.Equal(t, "daily", got.QuotaResetPeriod)
	assert.Equal(t, "vip", got.UpgradeGroup)
	assert.Equal(t, 3, got.MaxPurchasePerUser)
	assert.False(t, got.AllowBalancePay, "显式关闭余额支付时要如实透出，否则前端会误显示该选项")

	raw, err := json.Marshal(got)
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"id":7`)
	assert.NotContains(t, string(raw), "sort_order")
	assert.NotContains(t, string(raw), "allow_wallet_overflow")
}

// nil 表示沿用默认值：允许余额支付。
func TestToPublicSubscriptionPlanDefaultsBalancePayToTrue(t *testing.T) {
	got := toPublicSubscriptionPlan(model.SubscriptionPlan{Id: 1, Title: "Pro"})
	assert.True(t, got.AllowBalancePay)
}
