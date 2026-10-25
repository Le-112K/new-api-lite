package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
)

func newAssetEngine(contentType, body string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(StaticCompression())
	engine.GET("/asset", func(c *gin.Context) {
		c.Header("Content-Type", contentType)
		c.String(http.StatusOK, body)
	})
	return engine
}

func serve(t *testing.T, engine *gin.Engine, acceptEncoding string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, "/asset", nil)
	if acceptEncoding != "" {
		request.Header.Set("Accept-Encoding", acceptEncoding)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

const scriptBody = "const answer = 42; // padding padding padding padding padding"

func TestStaticCompressionPrefersBrotli(t *testing.T) {
	engine := newAssetEngine("text/javascript; charset=utf-8", strings.Repeat(scriptBody, 20))
	recorder := serve(t, engine, "gzip, deflate, br")

	if got := recorder.Header().Get("Content-Encoding"); got != "br" {
		t.Fatalf("Content-Encoding = %q, want br", got)
	}
	if got := recorder.Header().Get("Content-Length"); got != "" {
		t.Fatalf("Content-Length should be dropped for a compressed body, got %q", got)
	}

	decoded, err := io.ReadAll(brotli.NewReader(bytes.NewReader(recorder.Body.Bytes())))
	if err != nil {
		t.Fatalf("brotli decode: %v", err)
	}
	want := strings.Repeat(scriptBody, 20)
	if string(decoded) != want {
		t.Fatalf("decoded body mismatch: got %d bytes, want %d", len(decoded), len(want))
	}
}

func TestStaticCompressionFallsBackToGzip(t *testing.T) {
	engine := newAssetEngine("text/css; charset=utf-8", strings.Repeat("body{color:#000}", 40))
	recorder := serve(t, engine, "gzip")

	if got := recorder.Header().Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip", got)
	}

	reader, err := gzip.NewReader(bytes.NewReader(recorder.Body.Bytes()))
	if err != nil {
		t.Fatalf("gzip reader: %v", err)
	}
	decoded, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("gzip decode: %v", err)
	}
	if want := strings.Repeat("body{color:#000}", 40); string(decoded) != want {
		t.Fatalf("decoded body mismatch: got %d bytes, want %d", len(decoded), len(want))
	}
}

func TestStaticCompressionSkipsCompressedFormats(t *testing.T) {
	body := strings.Repeat("wOF2", 100)
	engine := newAssetEngine("font/woff2", body)
	recorder := serve(t, engine, "gzip, br")

	if got := recorder.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("woff2 must not be re-compressed, got Content-Encoding %q", got)
	}
	if got := recorder.Body.String(); got != body {
		t.Fatalf("body was rewritten: got %d bytes, want %d", len(got), len(body))
	}
}

func TestStaticCompressionLeavesNonOKAlone(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(StaticCompression())
	engine.GET("/asset", func(c *gin.Context) {
		c.String(http.StatusNotFound, strings.Repeat("nope", 200))
	})

	recorder := serve(t, engine, "gzip, br")
	if got := recorder.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("404 must stay identity, got Content-Encoding %q", got)
	}
}
