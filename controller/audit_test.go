package controller

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	sqlmysql "github.com/go-sql-driver/mysql"
	"gorm.io/driver/clickhouse"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupAuditTest(t *testing.T) (*model.User, string) {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.Log{}, &model.AuditLog{}, &model.CasbinRule{}, &model.AuthzRole{}, &model.Option{},
		&model.AuthFlow{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	previousMaster := common.IsMasterNode
	common.IsMasterNode = true
	require.NoError(t, authz.Init(db))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.IsMasterNode = previousMaster
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
	})
	user := &model.User{Username: "audit-owner", Password: "placeholder", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, db.Create(user).Error)
	_, jwt := newAuditTestSession(t, user.Id, "audit-owner-session")
	return user, jwt
}

// newAuditTestSession creates a browser session and returns its dashboard JWT.
func newAuditTestSession(t *testing.T, userID int, sid string) (service.AuthIdentity, string) {
	t.Helper()
	now := time.Now().Unix()
	require.NoError(t, model.CreateUserSession(&model.UserSession{SID: sid, UserID: userID, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "refresh-" + sid, LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}))
	identity := service.AuthIdentity{UserID: userID, SessionID: sid, UserAuthVersion: 1, SessionVersion: 1}
	jwt, _, err := service.IssueAccessToken(identity)
	require.NoError(t, err)
	return identity, jwt
}
func auditRequest(router http.Handler, method, path, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(`{"secret":"body-must-not-be-logged"}`))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("User-Agent", "audit-test-client")
	request.RemoteAddr = "192.0.2.8:4567"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestAuditIsolationVisibilityAndFailureContracts(t *testing.T) {
	user, pat := setupAuditTest(t)
	metadata := model.AuditOther{
		Op:        &model.AuditOperation{Action: "generic"},
		AdminInfo: &model.AuditAdminInfo{AdminID: 1},
		RootInfo:  model.AuditFields{"private": "root-only"},
	}
	for _, owner := range []int{user.Id, user.Id + 1} {
		model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleAdminUser, UserId: owner, Username: fmt.Sprint(owner), Category: model.AuditCategorySecurity, Success: false, Other: metadata})
	}
	router := gin.New()
	router.Use(middleware.RequestId())
	router.GET("/api/audit/self", middleware.UserAuth(), GetAuditLogs)
	router.GET("/api/audit", middleware.AdminAuth(), middleware.RequirePermission(authz.AuditRead), GetAuditLogs)
	response := auditRequest(router, "GET", "/api/audit/self?username=other&user_id=2&category=security&success=false&page_size=1", pat)
	var result struct {
		Success bool
		Data    struct {
			Items []model.AuditLog
			Total int
		}
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success)
	require.Equal(t, 1, result.Data.Total)
	require.Len(t, result.Data.Items, 1)
	assert.Equal(t, user.Id, result.Data.Items[0].UserId)
	assert.NotContains(t, response.Body.String(), "admin_info")
	assert.NotContains(t, response.Body.String(), "root-only")
	var payload struct {
		Data struct {
			Items []struct {
				Other map[string]any `json:"other"`
			}
		}
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload), "audit metadata must be a JSON object, not an encoded string")
	require.Len(t, payload.Data.Items, 1)
	assert.Contains(t, payload.Data.Items[0].Other, "op")
	require.NoError(t, authz.SetUserPermissions(user.Id, authz.PermissionsMap{authz.ResourceAudit: {authz.ActionRead: true}}))
	response = auditRequest(router, "GET", "/api/audit?category=security", pat)
	assert.Contains(t, response.Body.String(), "admin_info")
	assert.NotContains(t, response.Body.String(), "root-only")
	for _, query := range []string{"success=bad", "category=bad", "token_ref=secret", "start_timestamp=-1", "start_timestamp=2&end_timestamp=1", "p=-1", "page_size=-1"} {
		assert.Contains(t, auditRequest(router, "GET", "/api/audit/self?"+query, pat).Body.String(), `"success":false`)
	}
	require.NoError(t, model.LOG_DB.Callback().Query().Before("gorm:query").Register("audit:fail", func(tx *gorm.DB) {
		if tx.Statement.Table == "audit_logs" {
			tx.AddError(errors.New("audit store unavailable"))
		}
	}))
	_, _, err := model.GetAuditLogs(model.AuditLogFilter{UserId: user.Id}, 0, 10, common.RoleAdminUser)
	require.Error(t, err, "an unavailable audit store must surface instead of reporting an empty page")
	model.LOG_DB.Callback().Query().Remove("audit:fail")
}

func TestAuditRoleVisibilityAndPermissions(t *testing.T) {
	admin, pat := setupAuditTest(t)
	root := &model.User{Username: "root-audit", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AuthVersion: 1}
	require.NoError(t, model.DB.Create(root).Error)
	_, rootToken := newAuditTestSession(t, root.Id, "audit-root-session")
	metadata := model.AuditOther{
		AdminInfo: &model.AuditAdminInfo{AdminID: 1},
		RootInfo:  model.AuditFields{"private": "root-only"},
	}
	for i, role := range []int{1, 10, 100, 0, -1, 99} {
		model.RecordAuditLog(nil, model.AuditLog{ActorRole: role, UserId: admin.Id, Username: admin.Username, Category: model.AuditCategorySecurity, RequestId: fmt.Sprintf("role-%d", role), CreatedAt: int64(100 + i), Other: metadata})
	}
	model.RecordAuditLog(nil, model.AuditLog{ActorRole: 100, UserId: root.Id, Username: root.Username, Category: model.AuditCategorySecurity, RequestId: "root-owned", Other: metadata})
	router := gin.New()
	router.Use(middleware.RequestId())
	router.GET("/api/audit", middleware.AdminAuth(), middleware.RequirePermission(authz.AuditRead), GetAuditLogs)
	router.GET("/api/audit/self", middleware.UserAuth(), GetAuditLogs)
	now := time.Now().Unix()
	session := &model.UserSession{SID: "audit-permissions-session", UserID: admin.Id, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "placeholder", LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}
	require.NoError(t, model.CreateUserSession(session))
	jwt, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: admin.Id, SessionID: session.SID, UserAuthVersion: 1, SessionVersion: 1})
	require.NoError(t, err)
	for _, credential := range []string{pat, jwt} {
		assert.Equal(t, http.StatusForbidden, auditRequest(router, "GET", "/api/audit", credential).Code)
	}
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		return authz.SetUserPermissionsInTx(tx, admin.Id, authz.PermissionsMap{authz.ResourceAudit: {authz.ActionRead: true}})
	}))
	require.NoError(t, authz.ReloadPolicy())
	for _, credential := range []string{pat, jwt} {
		for _, endpoint := range []string{"/api/audit", "/api/audit/self"} {
			response := auditRequest(router, "GET", endpoint+"?category=security&page_size=1", credential)
			assert.Equal(t, http.StatusOK, response.Code)
			var result struct {
				Data struct {
					Total int
					Items []model.AuditLog
				}
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, 2, result.Data.Total)
			require.Len(t, result.Data.Items, 1)
			assert.Equal(t, 10, result.Data.Items[0].ActorRole)
			assert.NotContains(t, response.Body.String(), "root-only")
			for _, filter := range []string{"request_id=role-100", "username=" + root.Username, "request_id=role-0"} {
				filtered := auditRequest(router, "GET", endpoint+"?category=security&"+filter, credential)
				// self ignores supplied usernames, while still excluding every root row.
				if endpoint == "/api/audit/self" && strings.HasPrefix(filter, "username=") {
					continue
				}
				assert.Contains(t, filtered.Body.String(), `"total":0`)
			}
		}
	}
	rootSelf := auditRequest(router, "GET", "/api/audit/self?category=security", rootToken)
	assert.Contains(t, rootSelf.Body.String(), `"actor_role":100`)
	assert.NotContains(t, rootSelf.Body.String(), "admin_info")
	rootAll := auditRequest(router, "GET", "/api/audit?category=security", rootToken)
	assert.Contains(t, rootAll.Body.String(), `"total":7`)
	assert.Contains(t, rootAll.Body.String(), "root-only")
	require.NoError(t, authz.SetUserPermissions(admin.Id, authz.PermissionsMap{authz.ResourceAudit: {authz.ActionRead: false}}))
	for _, credential := range []string{pat, jwt} {
		assert.Equal(t, http.StatusForbidden, auditRequest(router, "GET", "/api/audit", credential).Code)
		assert.Equal(t, http.StatusOK, auditRequest(router, "GET", "/api/audit/self", credential).Code)
	}
}

func TestAuditRoleSnapshotSurvivesActorChanges(t *testing.T) {
	user, pat := setupAuditTest(t)
	user.Role = common.RoleRootUser
	require.NoError(t, model.DB.Model(user).Update("role", user.Role).Error)
	router := gin.New()
	router.Use(middleware.RequestId())
	router.POST("/change-role", middleware.UserAuth(), func(c *gin.Context) {
		recordLoginAudit(user, c)
		recordUserSecurityAudit(c, user.Id, "user.security_verify", nil)
		recordSubscriptionResetUserLogs(c, &model.SubscriptionResetResult{ResetCount: 1, PlanId: 1, PlanTitle: "Plan", AffectedUserIds: []int{999}}, auditOperatorInfo(c))
		require.NoError(t, model.DB.Model(user).Update("role", common.RoleAdminUser).Error)
		c.Status(200)
	})
	require.Equal(t, http.StatusOK, auditRequest(router, "POST", "/change-role", pat).Code)
	entries, total, err := model.GetAuditLogs(model.AuditLogFilter{}, 0, 20, common.RoleAdminUser)
	require.NoError(t, err)
	assert.Zero(t, total)
	assert.Empty(t, entries)
	require.NoError(t, model.DB.Unscoped().Delete(user).Error)
	entries, total, err = model.GetAuditLogs(model.AuditLogFilter{}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	assert.EqualValues(t, 3, total)
	for _, entry := range entries {
		assert.Equal(t, common.RoleRootUser, entry.ActorRole)
	}
}

func TestSecurityAndOperationEventsUseAuditTable(t *testing.T) {
	user, _ := setupAuditTest(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/event", nil)
	c.Set("id", user.Id)
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set(common.RequestIdKey, "correlated-request")
	recordLoginAudit(user, c)
	for _, action := range []string{"user.security_verify", "user.password_change", "user.binding_start", "user.binding_bind", "user.email_binding_resend"} {
		recordUserSecurityAudit(c, user.Id, action, nil)
	}
	recordManageAudit(c, "option.update", map[string]any{"key": "safe"})
	recordSubscriptionResetUserLogs(c, &model.SubscriptionResetResult{ResetCount: 1, PlanId: 1, PlanTitle: "Plan", AffectedUserIds: []int{user.Id}}, &model.AuditAdminInfo{AdminID: user.Id})
	for _, typ := range []int{model.LogTypeTopup, model.LogTypeConsume, model.LogTypeRefund, model.LogTypeSystem} {
		model.RecordLog(user.Id, typ, "business entry")
	}
	var audits []model.AuditLog
	require.NoError(t, model.LOG_DB.Find(&audits).Error)
	assert.Len(t, audits, 8)
	for _, entry := range audits {
		assert.Equal(t, "correlated-request", entry.RequestId)
		assert.Equal(t, user.Role, entry.ActorRole)
	}
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	assert.Len(t, logs, 4)
	_, err := model.DeleteOldLogBatch(context.Background(), time.Now().Unix()+1, 100)
	require.NoError(t, err)
	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.AuditLog{}).Count(&count).Error)
	assert.EqualValues(t, 8, count)
}

// Released schemas copied from v1.0.0-rc.33; only the Go type names differ.

type releasedAuditUser struct {
	Id               int                        `json:"id"`
	Username         string                     `json:"username" gorm:"unique;index" validate:"max=20"`
	Password         string                     `json:"password" gorm:"not null;" validate:"min=8,max=20"`
	OriginalPassword string                     `json:"original_password" gorm:"-:all"` // this field is only for Password change verification, don't save it to database!
	DisplayName      string                     `json:"display_name" gorm:"index" validate:"max=20"`
	Role             int                        `json:"role" gorm:"type:int;default:1"`   // admin, common
	Status           int                        `json:"status" gorm:"type:int;default:1"` // enabled, disabled
	Email            string                     `json:"email" gorm:"index" validate:"max=50"`
	GitHubId         string                     `json:"github_id" gorm:"column:github_id;index"`
	DiscordId        string                     `json:"discord_id" gorm:"column:discord_id;index"`
	OidcId           string                     `json:"oidc_id" gorm:"column:oidc_id;index"`
	WeChatId         string                     `json:"wechat_id" gorm:"column:wechat_id;index"`
	TelegramId       string                     `json:"telegram_id" gorm:"column:telegram_id;index"`
	VerificationCode string                     `json:"verification_code" gorm:"-:all"`                         // this field is only for Email verification, don't save it to database!
	AccessToken      *string                    `json:"-" gorm:"type:char(32);column:access_token;uniqueIndex"` // this token is for system management
	Quota            int                        `json:"quota" gorm:"type:int;default:0"`
	UsedQuota        int                        `json:"used_quota" gorm:"type:int;default:0;column:used_quota"` // used quota
	RequestCount     int                        `json:"request_count" gorm:"type:int;default:0;"`               // request number
	Group            string                     `json:"group" gorm:"type:varchar(64);default:'default'"`
	AffCode          string                     `json:"aff_code" gorm:"type:varchar(32);column:aff_code;uniqueIndex"`
	AffCount         int                        `json:"aff_count" gorm:"type:int;default:0;column:aff_count"`
	AffQuota         int                        `json:"aff_quota" gorm:"type:int;default:0;column:aff_quota"`           // 邀请剩余额度
	AffHistoryQuota  int                        `json:"aff_history_quota" gorm:"type:int;default:0;column:aff_history"` // 邀请历史额度
	InviterId        int                        `json:"inviter_id" gorm:"type:int;column:inviter_id;index"`
	DeletedAt        gorm.DeletedAt             `gorm:"index"`
	LinuxDOId        string                     `json:"linux_do_id" gorm:"column:linux_do_id;index"`
	Setting          string                     `json:"setting" gorm:"type:text;column:setting"`
	Remark           string                     `json:"remark,omitempty" gorm:"type:varchar(255)" validate:"max=255"`
	CreatedAt        int64                      `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	LastLoginAt      int64                      `json:"last_login_at" gorm:"default:0;column:last_login_at"`
	AuthVersion      int64                      `json:"-" gorm:"type:bigint;not null;default:1;column:auth_version"`
	AdminPermissions map[string]map[string]bool `json:"admin_permissions,omitempty" gorm:"-:all"`
}

func (releasedAuditUser) TableName() string { return "users" }

type releasedAuditLog struct {
	Id                int    `json:"id" gorm:"index:idx_created_at_id,priority:2;index:idx_user_id_id,priority:2"`
	UserId            int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:1;index:idx_created_at_type"`
	Type              int    `json:"type" gorm:"index:idx_created_at_type"`
	Content           string `json:"content"`
	Username          string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName         string `json:"token_name" gorm:"index;default:''"`
	ModelName         string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota             int    `json:"quota" gorm:"default:0"`
	PromptTokens      int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int    `json:"completion_tokens" gorm:"default:0"`
	UseTime           int    `json:"use_time" gorm:"default:0"`
	IsStream          bool   `json:"is_stream"`
	ChannelId         int    `json:"channel" gorm:"index"`
	ChannelName       string `json:"channel_name" gorm:"->"`
	TokenId           int    `json:"token_id" gorm:"default:0;index"`
	Group             string `json:"group" gorm:"index"`
	Ip                string `json:"ip" gorm:"index;default:''"`
	RequestId         string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	UpstreamRequestId string `json:"upstream_request_id,omitempty" gorm:"type:varchar(128);index:idx_logs_upstream_request_id;default:''"`
	Other             string `json:"other"`
}

func (releasedAuditLog) TableName() string { return "logs" }

// External tests create a new database per case on a loopback-only disposable
// instance. They never drop databases or tables supplied through an environment variable.
func newAuditTestDatabase(t *testing.T, kind, dsn string) (*gorm.DB, string) {
	t.Helper()
	if kind == "sqlite" {
		path := t.TempDir() + "/audit.db"
		db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
		require.NoError(t, err)
		return db, path
	}
	require.NotEmpty(t, dsn)
	name := fmt.Sprintf("newapi_audit_%d", time.Now().UnixNano())
	var original, isolated gorm.Dialector
	var newDSN string
	if kind == "mysql" {
		config, err := sqlmysql.ParseDSN(dsn)
		require.NoError(t, err)
		require.Equal(t, "tcp", config.Net)
		host, _, err := net.SplitHostPort(config.Addr)
		require.NoError(t, err)
		require.True(t, net.ParseIP(host).IsLoopback(), "database tests only permit loopback instances")
		original = mysql.Open(dsn)
		config.DBName = name
		newDSN = config.FormatDSN()
		isolated = mysql.Open(newDSN)
	} else {
		parsed, err := url.Parse(dsn)
		require.NoError(t, err)
		require.True(t, net.ParseIP(parsed.Hostname()).IsLoopback(), "database tests only permit loopback instances")
		parsed.Path = "/" + name
		newDSN = parsed.String()
		if kind == "clickhouse" {
			original = clickhouse.Open(dsn)
			isolated = clickhouse.Open(newDSN)
		} else {
			original = postgres.Open(dsn)
			isolated = postgres.Open(newDSN)
		}
	}
	admin, err := gorm.Open(original, &gorm.Config{})
	require.NoError(t, err)
	// No IF NOT EXISTS: a collision fails before any test data can be written.
	createSQL := "CREATE DATABASE " + name
	if kind == "mysql" {
		createSQL += " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}
	require.NoError(t, admin.Exec(createSQL).Error)
	sqlDB, err := admin.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	db, err := gorm.Open(isolated, &gorm.Config{})
	require.NoError(t, err)
	t.Logf("isolated database: %s (%s)", name, kind)
	t.Cleanup(func() {
		connection, err := db.DB()
		if err == nil {
			_ = connection.Close()
		}
	})
	return db, newDSN
}

func verifyAuditRoleStorage(t *testing.T) {
	t.Helper()
	for i, role := range []int{1, 10, 100, 0, 99} {
		model.RecordAuditLog(nil, model.AuditLog{ActorRole: role, UserId: 1, Username: "role-owner", CreatedAt: int64(200 + i), Category: model.AuditCategoryOperation, RequestId: fmt.Sprintf("matrix-role-%d", role)})
	}
	filter := model.AuditLogFilter{Category: model.AuditCategoryOperation}
	visible, total, err := model.GetAuditLogs(filter, 0, 1, common.RoleAdminUser)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, visible, 1)
	assert.Equal(t, common.RoleAdminUser, visible[0].ActorRole)
	visible, total, err = model.GetAuditLogs(filter, 1, 1, common.RoleCommonUser)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, visible, 1)
	assert.Equal(t, common.RoleCommonUser, visible[0].ActorRole)
	filter.RequestId = "matrix-role-100"
	visible, total, err = model.GetAuditLogs(filter, 0, 20, common.RoleAdminUser)
	require.NoError(t, err)
	assert.Zero(t, total)
	assert.Empty(t, visible)
	visible, total, err = model.GetAuditLogs(filter, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, visible, 1)
	assert.Equal(t, common.RoleRootUser, visible[0].ActorRole)
}

func verifyAuditJSONStorage(t *testing.T) {
	t.Helper()
	columns, err := model.LOG_DB.Migrator().ColumnTypes(&model.AuditLog{})
	require.NoError(t, err)
	var otherType string
	for _, column := range columns {
		if column.Name() == "other" {
			otherType = strings.ToLower(column.DatabaseTypeName())
		}
	}
	assert.Equal(t, "json", otherType)

	metadata := model.AuditOther{
		Op: &model.AuditOperation{Action: "channel.update", Params: model.AuditFields{
			"id": 42, "name": "渠道", "changed_fields": []string{}, "large_id": uint64(9007199254740993),
			"extra": map[string]any{"attempts": 0, "permitted": false, "ratio": 1.25, "targets": []int{1, 2}},
		}},
		AdminInfo: &model.AuditAdminInfo{AdminID: 1},
		AuditInfo: &model.AuditRequestInfo{Method: "PUT", Route: "/api/channel/", Path: "/api/channel/", Status: 200, Success: false},
		RootInfo:  model.AuditFields{"private": "root-only"},
	}
	model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleCommonUser, UserId: 1, Username: "json-owner", Category: model.AuditCategorySecurity, RequestId: "matrix-json", Other: metadata})
	filter := model.AuditLogFilter{RequestId: "matrix-json"}
	entries, total, err := model.GetAuditLogs(filter, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, entries, 1)
	stored, err := common.Marshal(entries[0].Other)
	require.NoError(t, err)
	expected, err := common.Marshal(metadata)
	require.NoError(t, err)
	assert.JSONEq(t, string(expected), string(stored))
	require.NotNil(t, entries[0].Other.Op)
	assert.Equal(t, "channel.update", entries[0].Other.Op.Action)
	require.NotNil(t, entries[0].Other.AuditInfo)
	assert.False(t, entries[0].Other.AuditInfo.Success)
	var details struct {
		Op struct {
			Params struct {
				LargeId uint64 `json:"large_id"`
			}
		}
	}
	require.NoError(t, common.Unmarshal(stored, &details))
	assert.EqualValues(t, 9007199254740993, details.Op.Params.LargeId, "JSON numbers must retain their type and precision")
	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser} {
		entries, _, err = model.GetAuditLogs(filter, 0, 20, role)
		require.NoError(t, err)
		require.Len(t, entries, 1)
		assert.Nil(t, entries[0].Other.RootInfo)
		if role == common.RoleCommonUser {
			assert.Nil(t, entries[0].Other.AdminInfo)
			assert.Nil(t, entries[0].Other.AuditInfo)
		} else {
			assert.NotNil(t, entries[0].Other.AdminInfo)
			assert.NotNil(t, entries[0].Other.AuditInfo)
		}
	}
	model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleCommonUser, UserId: 1, Username: "json-owner", RequestId: "matrix-json-empty", Other: model.AuditOther{}})
	entries, _, err = model.GetAuditLogs(model.AuditLogFilter{RequestId: "matrix-json-empty"}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	empty, err := common.Marshal(entries[0].Other)
	require.NoError(t, err)
	assert.JSONEq(t, `{}`, string(empty))
	for range 2 {
		require.NoError(t, model.InitLogDB())
	}
	entries, total, err = model.GetAuditLogs(filter, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, entries, 1)
	stored, err = common.Marshal(entries[0].Other)
	require.NoError(t, err)
	assert.JSONEq(t, string(expected), string(stored), "repeated startup must retain structured audit metadata")
}

func TestAuditOtherDatabaseEncoding(t *testing.T) {
	const payload = `{"op":{"action":"channel.update","params":{"id":9007199254740993,"nested":{"count":0,"enabled":false}}},"admin_info":{"admin_id":1,"admin_username":"root","admin_role":100,"auth_method":"session"},"audit_info":{"method":"PUT","route":"/api/channel/","path":"/api/channel/","status":200,"success":false},"root_info":{"generation":18446744073709551615}}`
	for _, input := range []any{payload, []byte(payload)} {
		var other model.AuditOther
		require.NoError(t, other.Scan(input))
		require.NotNil(t, other.Op)
		assert.Equal(t, "channel.update", other.Op.Action)
		require.NotNil(t, other.AdminInfo)
		assert.Equal(t, 100, other.AdminInfo.AdminRole)
		require.NotNil(t, other.AuditInfo)
		assert.False(t, other.AuditInfo.Success)
		encoded, err := other.Value()
		require.NoError(t, err)
		text, ok := encoded.(string)
		require.True(t, ok, "PostgreSQL simple protocol requires a string parameter")
		assert.JSONEq(t, payload, text)
		assert.Contains(t, text, "9007199254740993")
		assert.Contains(t, text, "18446744073709551615")
		for _, empty := range []any{nil, "", []byte(`null`), "{}"} {
			require.NoError(t, other.Scan(input))
			require.NoError(t, other.Scan(empty))
			encoded, err = other.Value()
			require.NoError(t, err)
			assert.Equal(t, "{}", encoded, "empty input must clear fields from the previous row")
		}
	}
	var invalid model.AuditOther
	assert.Error(t, invalid.Scan(42))
	assert.Error(t, invalid.Scan([]byte(`{broken`)))
}

func TestAuditDatabaseMatrix(t *testing.T) {
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	previousMaster, previousSQLite := common.IsMasterNode, common.SQLitePath
	common.IsMasterNode = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.IsMasterNode, common.SQLitePath = previousMaster, previousSQLite
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
	})
	cases := []struct {
		name, env string
		typ       common.DatabaseType
	}{
		{"sqlite", "", common.DatabaseTypeSQLite}, {"mysql", "AUDIT_MYSQL_DSN", common.DatabaseTypeMySQL}, {"postgres", "AUDIT_POSTGRES_DSN", common.DatabaseTypePostgreSQL},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dsn := os.Getenv(tc.env)
			if tc.env != "" && dsn == "" {
				t.Skip(tc.env + " is not configured")
			}
			for _, upgrade := range []bool{false, true} {
				t.Run(fmt.Sprintf("upgrade=%v", upgrade), func(t *testing.T) {
					db, isolatedDSN := newAuditTestDatabase(t, tc.name, dsn)
					t.Setenv("LOG_SQL_DSN", "")
					if tc.name == "sqlite" {
						common.SQLitePath = isolatedDSN
						t.Setenv("SQL_DSN", "local")
					} else {
						t.Setenv("SQL_DSN", isolatedDSN)
					}
					model.DB, model.LOG_DB = db, db
					common.SetDatabaseTypes(tc.typ, tc.typ)
					versionSQL := "SELECT version()"
					if tc.name == "sqlite" {
						versionSQL = "SELECT sqlite_version()"
					}
					var version string
					require.NoError(t, db.Raw(versionSQL).Scan(&version).Error)
					t.Logf("database version: %s", version)
					if upgrade {
						require.NoError(t, db.AutoMigrate(&releasedAuditUser{}, &releasedAuditLog{}))
						legacy := "released-token"
						require.NoError(t, db.Create(&releasedAuditUser{Username: "released-owner", Password: "placeholder", AccessToken: &legacy, Quota: 1234}).Error)
						require.NoError(t, db.Create(&releasedAuditLog{UserId: 1, Type: model.LogTypeLogin, Content: "historical login", CreatedAt: 100, RequestId: "legacy-request"}).Error)
					}
					for range 2 {
						require.NoError(t, model.InitDB())
						require.NoError(t, model.InitLogDB())
					}
					if !upgrade {
						require.NoError(t, db.Create(&model.User{Username: "fresh-owner", Password: "placeholder"}).Error)
					}
					if upgrade {
						var user model.User
						require.NoError(t, db.First(&user, 1).Error)
						assert.Equal(t, 1234, user.Quota)
						var old model.Log
						require.NoError(t, db.First(&old).Error)
						assert.Equal(t, "historical login", old.Content)
					}
					const tokenRef = "5f2a9c1d8b7e4f0a3c6d9e2b5f8a1c4d7e0b3f6a9c2d5e8b1f4a7c0d3e6b9f2a"
					model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleAdminUser, UserId: 1, Username: "owner", CreatedAt: 99, Category: model.AuditCategorySecurity, TokenRef: tokenRef, Ip: "192.0.2.1", Success: true})
					byRef, _, err := model.GetAuditLogs(model.AuditLogFilter{UserId: 1, TokenRef: tokenRef}, 0, 10, common.RoleCommonUser)
					require.NoError(t, err)
					require.Len(t, byRef, 1, "audit rows of a token are found by its token_ref")
					require.NoError(t, model.LOG_DB.Where("token_ref = ?", tokenRef).Delete(&model.AuditLog{}).Error)
					for _, timestamp := range []int64{101, 102, 103} {
						model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleAdminUser, UserId: 1, Username: "owner", CreatedAt: timestamp, Category: model.AuditCategorySecurity, TokenRef: tokenRef, Ip: "192.0.2.1", Success: timestamp != 102})
					}
					first, total, err := model.GetAuditLogs(model.AuditLogFilter{UserId: 1}, 0, 2, common.RoleCommonUser)
					require.NoError(t, err)
					assert.EqualValues(t, 3, total)
					require.Len(t, first, 2)
					assert.EqualValues(t, 103, first[0].CreatedAt)
					second, _, err := model.GetAuditLogs(model.AuditLogFilter{UserId: 1}, 2, 2, common.RoleCommonUser)
					require.NoError(t, err)
					require.Len(t, second, 1)
					assert.EqualValues(t, 101, second[0].CreatedAt)
					failure := false
					failed, _, err := model.GetAuditLogs(model.AuditLogFilter{UserId: 1, Success: &failure}, 0, 10, 1)
					require.NoError(t, err)
					require.Len(t, failed, 1)
					assert.EqualValues(t, 102, failed[0].CreatedAt)
					require.NoError(t, model.MigrateAuditLogs())
					_, total, err = model.GetAuditLogs(model.AuditLogFilter{UserId: 1}, 0, 10, 1)
					require.NoError(t, err)
					assert.EqualValues(t, 3, total)
					verifyAuditRoleStorage(t)
					verifyAuditJSONStorage(t)
					require.NoError(t, authz.Init(model.DB))
					assert.False(t, authz.Can(1, common.RoleAdminUser, authz.AuditRead))
					require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
						return authz.SetUserPermissionsInTx(tx, 1, authz.PermissionsMap{authz.ResourceAudit: {authz.ActionRead: true}})
					}))
					require.NoError(t, authz.ReloadPolicy())
					assert.True(t, authz.Can(1, common.RoleAdminUser, authz.AuditRead))
					require.NoError(t, authz.Init(model.DB))
					require.NoError(t, authz.Init(model.DB))
					assert.True(t, authz.Can(1, common.RoleAdminUser, authz.AuditRead))
					require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
						return authz.SetUserPermissionsInTx(tx, 1, authz.PermissionsMap{authz.ResourceAudit: {authz.ActionRead: false}})
					}))
					require.NoError(t, authz.ReloadPolicy())
					assert.False(t, authz.Can(1, common.RoleAdminUser, authz.AuditRead))
					assert.True(t, authz.Can(1, common.RoleRootUser, authz.AuditRead))
				})
			}
		})
	}
}

func TestIndependentAuditLogStores(t *testing.T) {
	_, _ = setupAuditTest(t)
	previousMaster := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	for _, tc := range []struct{ kind, env string }{{"mysql", "AUDIT_MYSQL_DSN"}, {"postgres", "AUDIT_POSTGRES_DSN"}, {"clickhouse", "AUDIT_CLICKHOUSE_DSN"}} {
		for _, upgrade := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/upgrade=%v", tc.kind, upgrade), func(t *testing.T) {
				dsn := os.Getenv(tc.env)
				if dsn == "" {
					t.Skip(tc.env + " is not configured")
				}
				logDB, isolatedDSN := newAuditTestDatabase(t, tc.kind, dsn)
				if upgrade {
					if tc.kind == "clickhouse" {
						require.NoError(t, logDB.Exec(releasedClickHouseLogSchema).Error)
					} else {
						require.NoError(t, logDB.AutoMigrate(&releasedAuditLog{}))
					}
					require.NoError(t, logDB.Create(&releasedAuditLog{UserId: 1, Username: "legacy", CreatedAt: time.Now().Unix(), Type: model.LogTypeLogin, Content: "retained historical login", RequestId: "legacy-split-request"}).Error)
				}
				t.Setenv("LOG_SQL_DSN", isolatedDSN)
				t.Setenv("LOG_SQL_CLICKHOUSE_TTL_DAYS", "7")
				require.NoError(t, model.InitLogDB())
				require.NoError(t, model.InitLogDB())
				if upgrade {
					var old model.Log
					require.NoError(t, model.LOG_DB.Where("request_id = ?", "legacy-split-request").Take(&old).Error)
					assert.Equal(t, "retained historical login", old.Content)
				}
				const independentRef = "9c1d8b7e4f0a3c6d9e2b5f8a1c4d7e0b3f6a9c2d5e8b1f4a7c0d3e6b9f2a5f2a"
				model.RecordAuditLog(nil, model.AuditLog{ActorRole: common.RoleAdminUser, UserId: 1, Username: "independent", Category: model.AuditCategoryOperation, TokenRef: independentRef, Ip: "192.0.2.8", Success: false, Status: 403})
				entries, total, err := model.GetAuditLogs(model.AuditLogFilter{UserId: 1}, 0, 20, common.RoleAdminUser)
				require.NoError(t, err)
				assert.EqualValues(t, 1, total)
				require.Len(t, entries, 1)
				assert.False(t, entries[0].Success)
				assert.Equal(t, independentRef, entries[0].TokenRef)
				model.RecordLog(1, model.LogTypeTopup, "independent business")
				_, err = model.DeleteOldLogBatch(context.Background(), time.Now().Unix()+1, 100)
				require.NoError(t, err)
				_, total, err = model.GetAuditLogs(model.AuditLogFilter{UserId: 1}, 0, 20, 1)
				require.NoError(t, err)
				assert.EqualValues(t, 1, total)
				var mainCount int64
				require.NoError(t, model.DB.Model(&model.AuditLog{}).Count(&mainCount).Error)
				assert.Zero(t, mainCount)
				verifyAuditRoleStorage(t)
				verifyAuditJSONStorage(t)
				if tc.kind == "clickhouse" {
					var create string
					require.NoError(t, model.LOG_DB.Raw("SHOW CREATE TABLE audit_logs").Scan(&create).Error)
					assert.NotContains(t, strings.ToUpper(create), "TTL")
					require.NoError(t, model.LOG_DB.Raw("SHOW CREATE TABLE logs").Scan(&create).Error)
					assert.Contains(t, strings.ToUpper(create), "TTL")
				}
			})
		}
	}
}

// ClickHouse logs schema from v1.0.0-rc.33.
const releasedClickHouseLogSchema = `
CREATE TABLE IF NOT EXISTS logs (
	id Int64 DEFAULT 0,
	user_id Int32 DEFAULT 0,
	created_at Int64 DEFAULT 0,
	type Int32 DEFAULT 0,
	content String DEFAULT '',
	username String DEFAULT '',
	token_name String DEFAULT '',
	model_name String DEFAULT '',
	quota Int32 DEFAULT 0,
	prompt_tokens Int32 DEFAULT 0,
	completion_tokens Int32 DEFAULT 0,
	use_time Int32 DEFAULT 0,
	is_stream UInt8 DEFAULT 0,
	channel_id Int32 DEFAULT 0,
	token_id Int32 DEFAULT 0,
	` + "`group`" + ` String DEFAULT '',
	ip String DEFAULT '',
	request_id String DEFAULT '',
	upstream_request_id String DEFAULT '',
	other String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(toDateTime(created_at))
ORDER BY (created_at, request_id)`
