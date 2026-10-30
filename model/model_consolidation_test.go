package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertConsolidationChannel(t *testing.T, id int, name string, models string) {
	t.Helper()
	require.NoError(t, DB.Create(&Channel{
		Id:     id,
		Name:   name,
		Models: models,
	}).Error)
}

func TestGetConsolidationSuggestions(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertAggregateMetadata(t, []Model{
		{ModelName: "gpt-4", NameRule: NameRulePrefix},
	})
	insertConsolidationChannel(t, 1, "main", "gpt-4,gpt-4-turbo")
	insertConsolidationChannel(t, 2, "backup", "gpt-4-turbo-preview")

	suggestions, err := GetConsolidationSuggestions()
	require.NoError(t, err)
	require.Len(t, suggestions, 1)

	assert.Equal(t, "gpt-4", suggestions[0].StandardName)
	assert.Equal(t, "prefix", suggestions[0].Rule)
	// 标准名本尊（gpt-4）不产生建议；其余别名逐渠道列出。
	assert.Len(t, suggestions[0].Items, 2)
	assert.Contains(t, suggestions[0].Items, ConsolidationItem{ChannelID: 1, ChannelName: "main", Alias: "gpt-4-turbo"})
	assert.Contains(t, suggestions[0].Items, ConsolidationItem{ChannelID: 2, ChannelName: "backup", Alias: "gpt-4-turbo-preview"})
}

func TestApplyConsolidationRewritesChannel(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertConsolidationChannel(t, 1, "main", "gpt-4,gpt-4-turbo")

	updated, err := ApplyConsolidation([]ConsolidationApplyItem{
		{ChannelID: 1, Standard: "gpt-4", Alias: "gpt-4-turbo"},
	}, true)
	require.NoError(t, err)
	assert.Equal(t, 1, updated)

	var channel Channel
	require.NoError(t, DB.Where("id = ?", 1).First(&channel).Error)

	models := channel.GetModels()
	assert.Contains(t, models, "gpt-4")
	assert.NotContains(t, models, "gpt-4-turbo")

	mapping := make(map[string]string)
	require.NoError(t, json.Unmarshal([]byte(channel.GetModelMapping()), &mapping))
	assert.Equal(t, "gpt-4-turbo", mapping["gpt-4"])

	// abilities 与渠道模型同步。
	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", 1).Find(&abilities).Error)
	names := make([]string, 0, len(abilities))
	for _, ability := range abilities {
		names = append(names, ability.Model)
	}
	assert.Contains(t, names, "gpt-4")
	assert.NotContains(t, names, "gpt-4-turbo")
}

func TestApplyConsolidationKeepsAliasesByDefault(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertConsolidationChannel(t, 1, "main", "gpt-4-turbo")

	updated, err := ApplyConsolidation([]ConsolidationApplyItem{
		{ChannelID: 1, Standard: "gpt-4", Alias: "gpt-4-turbo"},
	}, false)
	require.NoError(t, err)
	assert.Equal(t, 1, updated)

	var channel Channel
	require.NoError(t, DB.Where("id = ?", 1).First(&channel).Error)
	models := channel.GetModels()
	assert.Contains(t, models, "gpt-4-turbo")
	assert.Contains(t, models, "gpt-4")
}

func TestApplyConsolidationSkipsMissingAlias(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertConsolidationChannel(t, 1, "main", "gpt-4")

	updated, err := ApplyConsolidation([]ConsolidationApplyItem{
		{ChannelID: 1, Standard: "gpt-4", Alias: "not-in-channel"},
	}, true)
	require.NoError(t, err)
	assert.Equal(t, 0, updated)

	var channel Channel
	require.NoError(t, DB.Where("id = ?", 1).First(&channel).Error)
	assert.Empty(t, channel.GetModelMapping())
}
