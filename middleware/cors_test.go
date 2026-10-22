package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newCORSProbeServer(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(CORS())
	engine.GET("/probe", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	engine.OPTIONS("/probe", func(c *gin.Context) {
		c.String(http.StatusOK, "unreachable-with-preflight")
	})
	return engine
}

// F-002 回归锁：CORS 响应头只发给显式白名单来源，且永不携带
// Allow-Credentials / 通配 Allow-Origin（令牌泄露时不得放大为任意站点可读）。

func TestCORSAllowsOnlyConfiguredOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example.com, https://app.example.com")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Origin", "https://app.example.com")
	engine.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "https://app.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSRejectsUnlistedOriginsWithoutBreakingRequests(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example.com")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Origin", "https://evil.example.net")
	engine.ServeHTTP(rec, req)

	// 请求本身放行（非浏览器客户端不受影响），但不发 CORS 头，
	// 浏览器因此拒绝把响应交给页面脚本。
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSDefaultDeniesAllCrossOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Origin", "https://anything.example.org")
	engine.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSPreflightOnlyForConfiguredOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example.com")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/probe", nil)
	req.Header.Set("Origin", "https://console.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, "https://console.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, rec.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Credentials"))

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodOptions, "/probe", nil)
	req.Header.Set("Origin", "https://evil.example.net")
	req.Header.Set("Access-Control-Request-Method", "GET")
	engine.ServeHTTP(rec, req)

	assert.NotEqual(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSNeverEmitsWildcardOriginOrCredentials(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "*")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Origin", "https://anything.example.org")
	engine.ServeHTTP(rec, req)

	// "*" 不是合法白名单条目：字面量 "*" 不匹配任何来源，等效拒绝，
	// 绝不允许退回通配行为。
	assert.NotEqual(t, "*", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSLeavesSameOriginAndNonBrowserRequestsUntouched(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example.com")
	engine := newCORSProbeServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}
