package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRootUsernameLoginTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.UserSession{},
		&model.PendingRegistration{},
	))
	model.DB = db
	common.RedisEnabled = false
	common.SessionSecret = "root-username-login-test-secret"
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		for _, username := range []string{"admin", "locked-root"} {
			common.ClearLoginFailures("root_username:" + username)
		}
	})
	return db
}

func postAuthEntry(t *testing.T, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/auth/entry", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.RemoteAddr = "127.0.0.1:12345"
	AuthEntry(c)
	return recorder
}

func authEntrySucceeded(t *testing.T, recorder *httptest.ResponseRecorder) bool {
	t.Helper()
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response.Success
}

func TestAuthEntryRootUsernameSignsInWithoutEmail(t *testing.T) {
	db := setupRootUsernameLoginTest(t)
	hash, err := common.Password2Hash("root-secret")
	require.NoError(t, err)
	root := &model.User{
		Username:    "admin",
		Password:    hash,
		Role:        common.RoleRootUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(root).Error)

	recorder := postAuthEntry(t, map[string]any{
		"username": "admin",
		"password": "root-secret",
	})

	assert.True(t, authEntrySucceeded(t, recorder), recorder.Body.String())
}

func TestAuthEntryRejectsUsernameLoginForNonRootUsers(t *testing.T) {
	db := setupRootUsernameLoginTest(t)
	hash, err := common.Password2Hash("user-secret")
	require.NoError(t, err)
	// Registered users get a username derived from their email; it must never
	// become a second login identity.
	user := &model.User{
		Username:    "alice",
		Email:       "alice@example.com",
		Password:    hash,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)

	recorder := postAuthEntry(t, map[string]any{
		"username": "alice",
		"password": "user-secret",
	})

	assert.False(t, authEntrySucceeded(t, recorder))
	var pending int64
	require.NoError(t, db.Model(&model.PendingRegistration{}).Count(&pending).Error)
	assert.Zero(t, pending, "a bare username must not start a signup")
}

func TestAuthEntryUnknownUsernameDoesNotStartSignup(t *testing.T) {
	db := setupRootUsernameLoginTest(t)

	recorder := postAuthEntry(t, map[string]any{
		"username": "nobody",
		"password": "whatever-secret",
	})

	assert.False(t, authEntrySucceeded(t, recorder))
	var pending int64
	require.NoError(t, db.Model(&model.PendingRegistration{}).Count(&pending).Error)
	assert.Zero(t, pending)
}

func TestAuthEntryLocksRootUsernameAfterRepeatedFailures(t *testing.T) {
	db := setupRootUsernameLoginTest(t)
	hash, err := common.Password2Hash("root-secret")
	require.NoError(t, err)
	root := &model.User{
		Username:    "locked-root",
		Password:    hash,
		Role:        common.RoleRootUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(root).Error)

	for i := 0; i < common.LoginFailureThreshold; i++ {
		recorder := postAuthEntry(t, map[string]any{
			"username": "locked-root",
			"password": "wrong-secret",
		})
		assert.False(t, authEntrySucceeded(t, recorder))
	}

	// Even the right password is refused while the window is open.
	recorder := postAuthEntry(t, map[string]any{
		"username": "locked-root",
		"password": "root-secret",
	})
	assert.False(t, authEntrySucceeded(t, recorder))

	common.ClearLoginFailures("root_username:locked-root")
	recorder = postAuthEntry(t, map[string]any{
		"username": "locked-root",
		"password": "root-secret",
	})
	assert.True(t, authEntrySucceeded(t, recorder), recorder.Body.String())
}
