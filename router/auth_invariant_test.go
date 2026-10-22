package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 匿名放行白名单：这些 /api 端点天然不需要登录态（公开页、注册登录入口、
// 支付回调、API key 自认证）。除白名单外的每条已注册路由，匿名请求必须
// 被鉴权中间件拒绝——任何路由漏挂鉴权都会让下面的行为断言变红，
// 这是「删代码带走守卫」类回归的最终防线。
//
// 白名单条目本身也做双向校验：必须仍然注册着，防止名单腐烂。
var anonymousAllowedRoutes = []string{
	// 公开页面与初始化。
	"GET /api/setup",
	"POST /api/setup",
	"GET /api/status",
	"GET /api/notice",
	"GET /api/user-agreement",
	"GET /api/privacy-policy",
	"GET /api/home_page_content",
	"GET /api/user/groups",
	// 模型价格页对游客公开（仅受 HeaderNavModule 开关控制）。
	"GET /api/pricing",

	// 匿名账号入口。
	"GET /api/verification",
	"GET /api/reset_password",
	"POST /api/user/reset",
	"POST /api/user/register",
	"GET /api/user/login/encryption-key",
	"POST /api/user/login",

	// 浏览器会话 cookie 端点（凭 cookie 自认证）。
	"POST /api/user/auth/refresh",
	"POST /api/user/auth/logout",

	// 支付回调（凭签名校验，无登录态）。
	"GET /api/user/epay/notify",
	"POST /api/user/epay/notify",
	"GET /api/subscription/epay/notify",
	"POST /api/subscription/epay/notify",
	"GET /api/subscription/epay/return",
	"POST /api/subscription/epay/return",

	// API key 自认证（TokenAuthReadOnly）。
	"GET /api/usage/token/",
	"GET /api/log/token",
}

func newAuthInvariantTestEngine(t *testing.T) *gin.Engine {
	t.Helper()
	setupRelayRouterTestDB(t)

	// 关闭限流，让每个路由的匿名探测只受鉴权判定影响。
	oldGlobalAPI := common.GlobalApiRateLimitEnable
	oldGlobalWeb := common.GlobalWebRateLimitEnable
	oldCritical := common.CriticalRateLimitEnable
	common.GlobalApiRateLimitEnable = false
	common.GlobalWebRateLimitEnable = false
	common.CriticalRateLimitEnable = false
	t.Cleanup(func() {
		common.GlobalApiRateLimitEnable = oldGlobalAPI
		common.GlobalWebRateLimitEnable = oldGlobalWeb
		common.CriticalRateLimitEnable = oldCritical
	})

	engine := gin.New()
	require.NotPanics(t, func() {
		SetApiRouter(engine)
		SetDashboardRouter(engine)
		SetRelayRouter(engine)
	})
	return engine
}

// probePath 把路由模板里的参数段换成固定值，保证模板路由可命中。
func probePath(path string) string {
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		if strings.HasPrefix(segment, ":") || strings.HasPrefix(segment, "*") {
			segments[i] = "probe"
		}
	}
	return strings.Join(segments, "/")
}

func TestEveryRegisteredRouteRejectsAnonymous(t *testing.T) {
	engine := newAuthInvariantTestEngine(t)
	allowed := map[string]bool{}
	for _, key := range anonymousAllowedRoutes {
		allowed[key] = true
	}

	registered := map[string]bool{}
	for _, route := range engine.Routes() {
		key := route.Method + " " + route.Path
		registered[key] = true
		if allowed[key] {
			continue
		}
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(route.Method, probePath(route.Path), nil)
		engine.ServeHTTP(rec, req)
		assert.Contains(t,
			[]int{http.StatusUnauthorized, http.StatusForbidden},
			rec.Code,
			"route %s 必须拒绝匿名请求（疑似漏挂鉴权中间件），实际 %d", key, rec.Code,
		)
	}
	assert.NotEmpty(t, registered, "路由表不应为空（装配失败？）")
}

func TestAnonymousAllowlistStaysRegistered(t *testing.T) {
	engine := newAuthInvariantTestEngine(t)
	registered := map[string]bool{}
	for _, route := range engine.Routes() {
		registered[route.Method+" "+route.Path] = true
	}
	for _, key := range anonymousAllowedRoutes {
		assert.True(t, registered[key], "白名单条目 %s 已不再注册，应从名单移除", key)
	}
}
