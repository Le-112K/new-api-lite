package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPath2RelayMode(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/v1/alpha/search", want: RelayModeAlphaSearch},
		{path: "/v1/alpha/search?foo=1", want: RelayModeAlphaSearch},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.want, Path2RelayMode(tt.path))
		})
	}
}

// TestPath2RelayModeRetiredPathsStayUnknown guards the endpoint slim-down:
// these protocols were removed on purpose, so they must not quietly map back
// onto a live relay mode even if someone re-registers the route.
func TestPath2RelayModeRetiredPathsStayUnknown(t *testing.T) {
	retired := []string{
		"/v1/completions",
		"/v1/embeddings",
		"/v1/rerank",
		"/v1/audio/speech",
		"/v1/audio/transcriptions",
		"/v1/audio/translations",
		"/v1/realtime",
	}
	for _, path := range retired {
		t.Run(path, func(t *testing.T) {
			assert.Equal(t, RelayModeUnknown, Path2RelayMode(path))
		})
	}
}
