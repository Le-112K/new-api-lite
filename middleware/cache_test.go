package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCacheControlByPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(Cache())
	handler := func(c *gin.Context) { c.String(http.StatusOK, "ok") }
	engine.GET("/", handler)
	engine.GET("/static/js/index.abc123.js", handler)
	engine.GET("/static/font/sora.woff2", handler)
	engine.GET("/fonts/sora-latin-wght-normal.woff2", handler)
	engine.GET("/pricing", handler)
	engine.GET("/favicon.ico", handler)

	cases := []struct {
		path string
		want string
	}{
		// The shell points at hashed asset names, so it must revalidate.
		{"/", "no-cache"},
		// Content-hashed: safe to keep forever.
		{"/static/js/index.abc123.js", "public, max-age=31536000, immutable"},
		{"/static/font/sora.woff2", "public, max-age=31536000, immutable"},
		// Fixed-name brand fonts: immutable, renaming a font busts the cache.
		{"/fonts/sora-latin-wght-normal.woff2", "public, max-age=31536000, immutable"},
		// SPA fallbacks and unhashed files keep the shorter window.
		{"/pricing", "max-age=604800"},
		{"/favicon.ico", "max-age=604800"},
	}

	for _, testCase := range cases {
		request := httptest.NewRequest(http.MethodGet, testCase.path, nil)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)

		if got := recorder.Header().Get("Cache-Control"); got != testCase.want {
			t.Errorf("%s: Cache-Control = %q, want %q", testCase.path, got, testCase.want)
		}
	}
}
