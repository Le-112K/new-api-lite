package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

// 未配置计费规则的模型必须从公开价格页中消失，否则用户会看到一条根本调用不了
// 的报价。这条不变量与 /v1/models 的过滤规则一致。
func TestFilterPricingByConfiguredPriceDropsUnpricedModels(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "priced-ratio", PriceConfigured: true},
		{ModelName: "unpriced", PriceConfigured: false},
		{ModelName: "priced-request", PriceConfigured: true},
	}

	filtered := filterPricingByConfiguredPrice(pricing)

	assert.Len(t, filtered, 2)
	assert.Equal(t, "priced-ratio", filtered[0].ModelName)
	assert.Equal(t, "priced-request", filtered[1].ModelName)
}

func TestFilterPricingByConfiguredPriceHandlesEmptyList(t *testing.T) {
	assert.Empty(t, filterPricingByConfiguredPrice(nil))
	assert.Empty(t, filterPricingByConfiguredPrice([]model.Pricing{}))
}

// 全部未定价时返回空切片而不是 nil，保证 JSON 序列化成 [] 而不是 null。
func TestFilterPricingByConfiguredPriceReturnsEmptySlice(t *testing.T) {
	filtered := filterPricingByConfiguredPrice([]model.Pricing{
		{ModelName: "unpriced"},
	})

	assert.NotNil(t, filtered)
	assert.Empty(t, filtered)
}
