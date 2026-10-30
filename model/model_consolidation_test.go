package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMatchStandardModels(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertAggregateMetadata(t, []Model{
		// 泛化家族用前缀规则；preview 变体有独立精确元数据。
		{ModelName: "gpt-4", NameRule: NameRulePrefix},
		{ModelName: "gpt-4-turbo-preview", NameRule: NameRuleExact},
	})

	matches := MatchStandardModels([]string{
		"gpt-4-turbo",
		"gpt-4",
		"gpt-4-turbo-preview",
		"unmatched-model",
		"",
		"gpt-4-turbo",
	})

	require.Len(t, matches, 4)

	byName := make(map[string]StandardMatch)
	for _, match := range matches {
		byName[match.Name] = match
	}

	turbo := byName["gpt-4-turbo"]
	assert.True(t, turbo.Mapped)
	assert.Equal(t, "gpt-4", turbo.Standard)
	assert.Equal(t, "prefix", turbo.Rule)

	self := byName["gpt-4"]
	assert.False(t, self.Mapped)
	assert.Equal(t, "gpt-4", self.Standard)

	// 精确元数据压过前缀：preview 归自己，不归 gpt-4。
	preview := byName["gpt-4-turbo-preview"]
	assert.False(t, preview.Mapped)
	assert.Equal(t, "gpt-4-turbo-preview", preview.Standard)

	unmatched := byName["unmatched-model"]
	assert.False(t, unmatched.Mapped)
	assert.Equal(t, "unmatched-model", unmatched.Standard)
}

func TestMatchStandardModelsWithoutMetadata(t *testing.T) {
	resetPricingEndpointTestTables(t)

	matches := MatchStandardModels([]string{"solo", "solo"})
	require.Len(t, matches, 1)
	assert.Equal(t, "solo", matches[0].Name)
	assert.False(t, matches[0].Mapped)
}
