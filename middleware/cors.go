package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// CORS emits cross-origin response headers only for origins explicitly listed
// in the CORS_ALLOWED_ORIGINS environment variable (comma-separated). The
// default (empty) allows no cross-origin access at all.
//
// Requests are never rejected: origins outside the allowlist simply get no
// CORS response headers, so browsers refuse to expose the response to page
// scripts while non-browser API clients are unaffected. Credentials are
// deliberately unsupported — endpoints behind this middleware authenticate
// with API keys in headers, never cookies, so credentialed CORS would only
// widen the blast radius of a leaked token.
func CORS() gin.HandlerFunc {
	allowedOrigins := make(map[string]bool)
	for part := range strings.SplitSeq(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		if origin := strings.TrimSpace(part); origin != "" {
			allowedOrigins[origin] = true
		}
	}
	allowHeaders := strings.Join([]string{
		"Accept",
		"Accept-Language",
		"Authorization",
		"Content-Type",
		"If-None-Match",
		"Originator",
		"Session_id",
		"X-Application-Header",
		"X-Auth-Session",
		"X-Codex-Beta-Features",
		"X-Requested-With",
		"X-Security-Proof",
		"X-Test-Limit",
		"anthropic-beta",
		"anthropic-version",
		"x-api-key",
		"x-goog-api-key",
	}, ", ")
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" || !allowedOrigins[origin] {
			c.Next()
			return
		}
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Origin", origin)
		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", allowHeaders)
			c.Header("Access-Control-Max-Age", "86400")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
