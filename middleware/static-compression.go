package middleware

import (
	"net/http"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// brotliLevel 5 is the sweet spot for on-the-fly compression of already
// minified JS/CSS: within a few percent of level 11 while staying fast enough
// to serve on every cold request. A single static response is ~700 KB across
// five chunks, so the level matters less than not buffering the whole body.
const brotliLevel = 5

// StaticCompression serves the embedded frontend with Brotli when the client
// advertises it, falling back to the existing gzip middleware otherwise.
//
// Deliberately scoped to the web assets router: API and relay traffic keep
// their current handler, because streaming responses (SSE) must not be wrapped
// in a compressor that buffers.
func StaticCompression() gin.HandlerFunc {
	gzipFallback := gzip.Gzip(gzip.DefaultCompression)

	return func(c *gin.Context) {
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "br") {
			gzipFallback(c)
			return
		}

		writer := &brotliWriter{ResponseWriter: c.Writer}
		c.Writer = writer
		c.Next()
		_ = writer.Close()
	}
}

type brotliWriter struct {
	gin.ResponseWriter
	writer  *brotli.Writer
	decided bool
}

func (w *brotliWriter) WriteHeader(code int) {
	w.decide(code)
	w.ResponseWriter.WriteHeader(code)
}

func (w *brotliWriter) Write(b []byte) (int, error) {
	w.decide(w.Status())
	if w.writer == nil {
		return w.ResponseWriter.Write(b)
	}
	return w.writer.Write(b)
}

func (w *brotliWriter) WriteString(s string) (int, error) {
	w.decide(w.Status())
	if w.writer == nil {
		return w.ResponseWriter.WriteString(s)
	}
	// brotli.Writer has no WriteString; the copy is negligible for the handful
	// of string writes gin performs.
	return w.writer.Write([]byte(s))
}

func (w *brotliWriter) Flush() {
	if w.writer != nil {
		_ = w.writer.Flush()
	}
	w.ResponseWriter.Flush()
}

func (w *brotliWriter) Close() error {
	if w.writer == nil {
		return nil
	}
	return w.writer.Close()
}

// decide runs once, at the first moment the response headers are readable.
// Content-Type is set by http.ServeContent just before WriteHeader, so this is
// the earliest point that can tell a JS chunk from an already-compressed woff2.
func (w *brotliWriter) decide(code int) {
	if w.decided {
		return
	}
	w.decided = true

	header := w.Header()
	if code != http.StatusOK ||
		header.Get("Content-Encoding") != "" ||
		!compressibleType(header.Get("Content-Type")) {
		return
	}

	// Length refers to the identity body; the compressed one has no known size.
	header.Del("Content-Length")
	header.Set("Content-Encoding", "br")
	header.Add("Vary", "Accept-Encoding")
	w.writer = brotli.NewWriterLevel(w.ResponseWriter, brotliLevel)
}

func compressibleType(contentType string) bool {
	if contentType == "" {
		return false
	}
	if strings.HasPrefix(contentType, "text/") {
		return true
	}
	for _, needle := range []string{"javascript", "json", "xml", "svg"} {
		if strings.Contains(contentType, needle) {
			return true
		}
	}
	return false
}
