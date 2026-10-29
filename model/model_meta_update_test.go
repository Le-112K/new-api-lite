package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// The metadata drawer writes every configurable column through Model.Update,
// which uses an explicit Select allowlist. A field that is missing from that
// list saves without error but never reaches the database — the model square
// then keeps showing a dash. Guard the whole set so adding a form field without
// touching Update fails loudly here instead of silently on the public page.
func TestUpdatePersistsConfigurableMetadata(t *testing.T) {
	previous := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, db.AutoMigrate(&Model{}, &Option{}))

	original := Model{ModelName: "deepseek-reasoner", Status: 1, SyncOfficial: 1}
	require.NoError(t, db.Create(&original).Error)

	update := Model{
		Id:               original.Id,
		ModelName:        "deepseek-reasoner",
		DisplayName:      "DeepSeek 深度推理",
		ContextLength:    128000,
		MaxOutputTokens:  8192,
		ThinkingStrength: "high",
		Capabilities:     "function_calling,vision",
		Status:           1,
		SyncOfficial:     1,
	}
	require.NoError(t, update.Update())

	var stored Model
	require.NoError(t, db.First(&stored, original.Id).Error)
	assert.Equal(t, "DeepSeek 深度推理", stored.DisplayName)
	assert.Equal(t, int64(128000), stored.ContextLength)
	assert.Equal(t, int64(8192), stored.MaxOutputTokens)
	assert.Equal(t, "high", stored.ThinkingStrength)
	assert.Equal(t, "function_calling,vision", stored.Capabilities)
}

// Selected columns are written even when the value is zero, so an admin can
// clear a field instead of being stuck with the first value they saved.
func TestUpdateCanClearDisplayName(t *testing.T) {
	previous := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, db.AutoMigrate(&Model{}, &Option{}))

	original := Model{
		ModelName:    "glm-5-3-flash",
		DisplayName:  "GLM 5.3 Flash",
		Status:       1,
		SyncOfficial: 1,
	}
	require.NoError(t, db.Create(&original).Error)

	clear := Model{Id: original.Id, ModelName: original.ModelName, Status: 1, SyncOfficial: 1}
	require.NoError(t, clear.Update())

	var stored Model
	require.NoError(t, db.First(&stored, original.Id).Error)
	assert.Empty(t, stored.DisplayName)
}
