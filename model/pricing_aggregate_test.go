package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertAggregateMetadata(t *testing.T, records []Model) {
	t.Helper()
	for i := range records {
		require.NoError(t, DB.Create(&records[i]).Error)
	}
}

func TestAggregatePricingByCanonical(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertAggregateMetadata(t, []Model{
		// 泛化家族用前缀规则：gpt-4* 全部并入 gpt-4 标准模型。
		{ModelName: "gpt-4", NameRule: NameRulePrefix},
		{ModelName: "deepseek-v4", NameRule: NameRulePrefix},
	})

	pricing := []Pricing{
		// gpt-4 家族：标准名本尊存在，代表必须是 gpt-4。
		{ModelName: "gpt-4", EnableGroup: []string{"default"}},
		{ModelName: "gpt-4-turbo", EnableGroup: []string{"pro"}},
		{ModelName: "gpt-4-2024-08-06", EnableGroup: []string{"default"}},
		// deepseek 家族：标准名本尊不在渠道里，代表取最短名。
		{ModelName: "deepseek-v4-0324", EnableGroup: []string{"default"}},
		{ModelName: "deepseek-v4-ga", EnableGroup: []string{"pro", "default"}},
		// 无元数据归属：自成一组，展示行为不变。
		{ModelName: "standalone-model", EnableGroup: []string{"default"}},
	}

	aggregated := AggregatePricingByCanonical(pricing)

	assert.Len(t, aggregated, 3)

	byCanonical := make(map[string]Pricing)
	for _, item := range aggregated {
		byCanonical[item.Canonical] = item
	}

	gpt4, ok := byCanonical["gpt-4"]
	assert.True(t, ok)
	assert.Equal(t, "gpt-4", gpt4.ModelName)
	assert.Equal(t, []string{"gpt-4-2024-08-06", "gpt-4-turbo"}, gpt4.Aliases)
	// 套餐并集保持首次出现顺序且去重。
	assert.Equal(t, []string{"default", "pro"}, gpt4.EnableGroup)

	ds, ok := byCanonical["deepseek-v4"]
	assert.True(t, ok)
	// 代表取最短名（最接近标准名）：deepseek-v4-ga 比 deepseek-v4-0324 短。
	assert.Equal(t, "deepseek-v4-ga", ds.ModelName)
	assert.Equal(t, []string{"deepseek-v4-0324"}, ds.Aliases)
	assert.Equal(t, []string{"default", "pro"}, ds.EnableGroup)

	standalone, ok := byCanonical["standalone-model"]
	assert.True(t, ok)
	assert.Equal(t, "standalone-model", standalone.ModelName)
	assert.Empty(t, standalone.Aliases)
}

func TestAggregatePricingByCanonicalWithoutMetadata(t *testing.T) {
	resetPricingEndpointTestTables(t)

	pricing := []Pricing{
		{ModelName: "solo", EnableGroup: []string{"default"}},
	}
	aggregated := AggregatePricingByCanonical(pricing)
	assert.Len(t, aggregated, 1)
	assert.Equal(t, "solo", aggregated[0].ModelName)
	assert.Empty(t, aggregated[0].Aliases)
}

func TestAggregatePricingByCanonicalPrefixAmbiguity(t *testing.T) {
	// 精确规则压过前缀规则：gpt-4-turbo 有自己的精确元数据时独立成卡，
	// 不被 gpt-4（前缀）吞并；前缀元数据仍归并剩下的 preview 变体。
	resetPricingEndpointTestTables(t)
	insertAggregateMetadata(t, []Model{
		{ModelName: "gpt-4", NameRule: NameRulePrefix},
		{ModelName: "gpt-4-turbo", NameRule: NameRuleExact},
	})

	pricing := []Pricing{
		{ModelName: "gpt-4", EnableGroup: []string{"default"}},
		{ModelName: "gpt-4-turbo", EnableGroup: []string{"pro"}},
		{ModelName: "gpt-4-turbo-preview", EnableGroup: []string{"pro"}},
	}

	aggregated := AggregatePricingByCanonical(pricing)
	assert.Len(t, aggregated, 2)

	byCanonical := make(map[string]Pricing)
	for _, item := range aggregated {
		byCanonical[item.Canonical] = item
	}
	turbo, ok := byCanonical["gpt-4-turbo"]
	assert.True(t, ok)
	assert.Equal(t, "gpt-4-turbo", turbo.ModelName)
	assert.Empty(t, turbo.Aliases)

	gpt4, ok := byCanonical["gpt-4"]
	assert.True(t, ok)
	assert.Equal(t, []string{"gpt-4-turbo-preview"}, gpt4.Aliases)
}
