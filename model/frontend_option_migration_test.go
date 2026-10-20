package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useFrontendOptionMigrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func requireOptionValue(t *testing.T, db *gorm.DB, key string) string {
	t.Helper()
	var option Option
	require.NoError(t, db.Where(&Option{Key: key}).First(&option).Error)
	return option.Value
}

func requireOptionMissing(t *testing.T, db *gorm.DB, key string) {
	t.Helper()
	var option Option
	assert.ErrorIs(t, db.Where(&Option{Key: key}).First(&option).Error, gorm.ErrRecordNotFound)
}

func TestMigrateRetiredFrontendOptionsMigratesValidValuesIdempotently(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacy := []Option{
		{Key: retiredThemeOptionKey, Value: "classic"},
		{Key: "ApiInfo", Value: `[{"url":"https://api.example.com","route":"primary","description":"API","color":"blue"}]`},
		{Key: "Announcements", Value: `[{"content":"maintenance","publishDate":"2026-07-20T00:00:00Z","type":"warning"}]`},
		{Key: "FAQ", Value: `[{"title":"Question","content":"Answer"}]`},
	}
	require.NoError(t, db.Create(&legacy).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	requireOptionMissing(t, db, retiredThemeOptionKey)
	assert.JSONEq(t, legacy[1].Value, requireOptionValue(t, db, "console_setting.api_info"))
	assert.Equal(t, legacy[2].Value, requireOptionValue(t, db, "console_setting.announcements"))
	assert.JSONEq(t, `[{"question":"Question","answer":"Answer"}]`, requireOptionValue(t, db, "console_setting.faq"))
	for _, key := range []string{"ApiInfo", "Announcements", "FAQ"} {
		requireOptionMissing(t, db, key)
	}

	before, err := AllOption()
	require.NoError(t, err)
	require.NoError(t, MigrateRetiredFrontendOptions())
	after, err := AllOption()
	require.NoError(t, err)
	assert.ElementsMatch(t, before, after)
}

func TestLegacyConsoleListMigrationCapsAPIInfoAndFAQ(t *testing.T) {
	apiInfo := make([]map[string]any, 51)
	faq := make([]map[string]any, 51)
	for i := range apiInfo {
		apiInfo[i] = map[string]any{
			"url":         fmt.Sprintf("https://api-%d.example.com", i),
			"route":       fmt.Sprintf("route-%d", i),
			"description": "API",
			"color":       "blue",
		}
		faq[i] = map[string]any{"title": fmt.Sprintf("Question %d", i), "content": "Answer"}
	}
	apiBytes, err := common.Marshal(apiInfo)
	require.NoError(t, err)
	faqBytes, err := common.Marshal(faq)
	require.NoError(t, err)

	migratedAPI, err := transformLegacyAPIInfo(string(apiBytes))
	require.NoError(t, err)
	migratedFAQ, err := transformLegacyFAQ(string(faqBytes))
	require.NoError(t, err)
	var apiResult []map[string]any
	require.NoError(t, common.UnmarshalJsonStr(migratedAPI, &apiResult))
	var faqResult []map[string]any
	require.NoError(t, common.UnmarshalJsonStr(migratedFAQ, &faqResult))
	assert.Len(t, apiResult, 50)
	assert.Len(t, faqResult, 50)
}

func TestMigrateRetiredFrontendOptionsPreservesMalformedValuesAndContinues(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacy := []Option{
		{Key: "ApiInfo", Value: `{invalid`},
		{Key: "FAQ", Value: `[{"question":"Question","answer":"Answer"}]`},
	}
	require.NoError(t, db.Create(&legacy).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	assert.Equal(t, `{invalid`, requireOptionValue(t, db, "ApiInfo"))
	requireOptionMissing(t, db, "console_setting.api_info")
	requireOptionMissing(t, db, "FAQ")
	assert.JSONEq(t, legacy[1].Value, requireOptionValue(t, db, "console_setting.faq"))
}

func TestMigrateRetiredFrontendOptionsPreservesMixedInvalidFAQ(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	legacyFAQ := `[{"question":"Valid question","answer":"Valid answer"},{"question":"Missing answer"}]`
	require.NoError(t, db.Create(&Option{Key: "FAQ", Value: legacyFAQ}).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	assert.Equal(t, legacyFAQ, requireOptionValue(t, db, "FAQ"))
	requireOptionMissing(t, db, "console_setting.faq")
}

func TestMigrateRetiredFrontendOptionsKeepsAuthoritativeTargets(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	options := []Option{
		{Key: "ApiInfo", Value: `{invalid`},
		{Key: "console_setting.api_info", Value: `[{"url":"https://new.example.com"}]`},
	}
	require.NoError(t, db.Create(&options).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	assert.Equal(t, options[1].Value, requireOptionValue(t, db, "console_setting.api_info"))
	for _, key := range []string{"ApiInfo"} {
		requireOptionMissing(t, db, key)
	}
}

func TestMigrateRetiredFrontendOptionsKeepsEmptyAuthoritativeTargets(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	options := []Option{
		{Key: "ApiInfo", Value: `[{"url":"https://old.example.com"}]`},
		{Key: "console_setting.api_info", Value: ""},
	}
	require.NoError(t, db.Create(&options).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	assert.Empty(t, requireOptionValue(t, db, "console_setting.api_info"))
	for _, key := range []string{"ApiInfo"} {
		requireOptionMissing(t, db, key)
	}
}

func TestRetiredThemeOptionRowIsRemoved(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	require.NoError(t, db.Create(&Option{Key: retiredThemeOptionKey, Value: "classic"}).Error)

	require.NoError(t, MigrateRetiredFrontendOptions())
	requireOptionMissing(t, db, retiredThemeOptionKey)

	// Running again must stay a no-op instead of resurrecting the row.
	require.NoError(t, MigrateRetiredFrontendOptions())
	requireOptionMissing(t, db, retiredThemeOptionKey)
}
