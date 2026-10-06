package controller

import (
	"bytes"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// modelManagementRequest invokes a controller handler with a root-user context
// and decodes the response into output when it is not nil.
func modelManagementRequest(t *testing.T, handler gin.HandlerFunc, method, path string, body any, output any) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, bytes.NewReader(encoded))
	context.Set("role", common.RoleRootUser)
	handler(context)
	if output != nil {
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), output), recorder.Body.String())
	}
	return recorder
}

// modelManagementDB spins up an isolated database for controller tests and
// restores every global it touches on cleanup. It replaces the helper
// previously shipped with the removed model-management tests.
func modelManagementDB(t *testing.T, kind, dsn string) *gorm.DB {
	t.Helper()
	database, isolatedDSN := newAuditTestDatabase(t, kind, dsn)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousMaster, previousSQLite := common.IsMasterNode, common.SQLitePath
	previousRedis, previousMemory := common.RedisEnabled, common.MemoryCacheEnabled
	previousOptions := common.OptionMap
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	restoreRatios := []struct {
		value   string
		restore func(string) error
	}{
		{ratio_setting.ModelPrice2JSONString(), ratio_setting.UpdateModelPriceByJSONString},
		{ratio_setting.ModelRatio2JSONString(), ratio_setting.UpdateModelRatioByJSONString},
		{ratio_setting.CompletionRatio2JSONString(), ratio_setting.UpdateCompletionRatioByJSONString},
		{ratio_setting.CacheRatio2JSONString(), ratio_setting.UpdateCacheRatioByJSONString},
		{ratio_setting.CreateCacheRatio2JSONString(), ratio_setting.UpdateCreateCacheRatioByJSONString},
		{ratio_setting.ImageRatio2JSONString(), ratio_setting.UpdateImageRatioByJSONString},
		{ratio_setting.AudioRatio2JSONString(), ratio_setting.UpdateAudioRatioByJSONString},
		{ratio_setting.AudioCompletionRatio2JSONString(), ratio_setting.UpdateAudioCompletionRatioByJSONString},
	}
	common.IsMasterNode = false
	common.RedisEnabled, common.MemoryCacheEnabled = false, false
	common.OptionMap = map[string]string{}
	if kind == "sqlite" {
		common.SQLitePath = isolatedDSN
		isolatedDSN = "local"
	}
	t.Setenv("SQL_DSN", isolatedDSN)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitDB())
	database = model.DB
	model.LOG_DB = database
	require.NoError(t, database.AutoMigrate(&model.Model{}, &model.Vendor{}, &model.Channel{}, &model.Ability{}, &model.Option{}, &model.User{}, &model.AuditLog{}))
	for _, value := range restoreRatios {
		require.NoError(t, value.restore("{}"))
	}
	config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": "{}", "billing_expr": "{}", "plugin_billing_expr": "{}"})
	var version string
	query := "SELECT version()"
	if kind == "sqlite" {
		query = "SELECT sqlite_version()"
	}
	require.NoError(t, database.Raw(query).Scan(&version).Error)
	t.Logf("database version: %s", version)
	t.Cleanup(func() {
		for _, value := range restoreRatios {
			require.NoError(t, value.restore(value.value))
		}
		config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": previousConfig["billing_setting.billing_mode"], "billing_expr": previousConfig["billing_setting.billing_expr"], "plugin_billing_expr": previousConfig[billing_setting.PluginBillingExprOption]})
		common.OptionMap = previousOptions
		common.IsMasterNode, common.SQLitePath = previousMaster, previousSQLite
		common.RedisEnabled, common.MemoryCacheEnabled = previousRedis, previousMemory
		common.SetDatabaseTypes(previousMain, previousLog)
		connection, err := database.DB()
		if err == nil {
			require.NoError(t, connection.Close())
		}
		model.DB, model.LOG_DB = previousDB, previousLogDB
	})
	return database
}
