package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"

func arkRelayInfo(path string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestURLPath: path,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeVolcEngine,
			ChannelBaseUrl: arkBaseURL,
		},
	}
}

func volcengineRelayInfo(baseURL string, path string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestURLPath: path,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeVolcEngine,
			ChannelBaseUrl: baseURL,
		},
	}
}

// Volcano Ark serves the OpenAI protocol under an /api/v3 prefix, which the
// channel base URL already carries. A client path still brings its own /v1
// version segment; joining both yields /api/v3/v1/chat/completions, and the
// upstream answers 404 to that.
func TestGetRequestURLVolcEngineDropsClientVersionPrefix(t *testing.T) {
	adaptor := &Adaptor{ChannelType: constant.ChannelTypeVolcEngine}

	url, err := adaptor.GetRequestURL(arkRelayInfo("/v1/chat/completions"))
	require.NoError(t, err)
	assert.Equal(t, arkBaseURL+"/chat/completions", url)

	url, err = adaptor.GetRequestURL(arkRelayInfo("/v1/models"))
	require.NoError(t, err)
	assert.Equal(t, arkBaseURL+"/models", url)
}

// Every other OpenAI-compatible channel keeps the client's version segment, so
// the Ark-specific trimming must not leak into them.
func TestGetRequestURLKeepsVersionPrefixForOpenAI(t *testing.T) {
	const base = "https://api.openai.com"
	info := &relaycommon.RelayInfo{
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenAI,
			ChannelBaseUrl: base,
		},
	}

	url, err := (&Adaptor{ChannelType: constant.ChannelTypeOpenAI}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, base+"/v1/chat/completions", url)
}

// Model discovery goes through the same helper the relay path uses, so the two
// endpoints can never drift apart.
func TestBuildVolcEngineModelListURLMatchesRelayEndpoint(t *testing.T) {
	url, err := BuildVolcEngineModelListURL(arkBaseURL)
	require.NoError(t, err)
	assert.Equal(t, arkBaseURL+"/models", url)
}

// The dashboard's region picker lists bare hosts with no path, which is also
// what the "add channel" flow submits. Without normalization the joined URL
// degenerates to /chat/completions (and /models for discovery) and the
// upstream answers 404 — operators then cannot fetch models at all.
func TestGetRequestURLVolcEngineNormalizesBareHost(t *testing.T) {
	adaptor := &Adaptor{ChannelType: constant.ChannelTypeVolcEngine}

	for _, base := range []string{
		"https://ark.cn-beijing.volces.com",
		"https://ark.cn-beijing.volces.com/",
		"https://ark.ap-southeast.bytepluses.com",
	} {
		url, err := adaptor.GetRequestURL(volcengineRelayInfo(base, "/v1/chat/completions"))
		require.NoError(t, err)
		assert.Equal(t, strings.TrimSuffix(base, "/")+volcengineAPIPrefix+"/chat/completions", url)
	}

	url, err := adaptor.GetRequestURL(volcengineRelayInfo("https://ark.cn-beijing.volces.com", "/v1/models"))
	require.NoError(t, err)
	assert.Equal(t, "https://ark.cn-beijing.volces.com/api/v3/models", url)
}

// A base URL that already carries a path (including a trailing slash) is
// joined as-is; only path-less values are normalized.
func TestGetRequestURLVolcEngineKeepsExistingPath(t *testing.T) {
	adaptor := &Adaptor{ChannelType: constant.ChannelTypeVolcEngine}

	url, err := adaptor.GetRequestURL(volcengineRelayInfo(arkBaseURL, "/v1/chat/completions"))
	require.NoError(t, err)
	assert.Equal(t, arkBaseURL+"/chat/completions", url)

	url, err = adaptor.GetRequestURL(volcengineRelayInfo(arkBaseURL+"/", "/v1/chat/completions"))
	require.NoError(t, err)
	assert.Equal(t, arkBaseURL+"/chat/completions", url)
}

// Discovery normalizes a bare host through the same rule.
func TestBuildVolcEngineModelListURLNormalizesBareHost(t *testing.T) {
	url, err := BuildVolcEngineModelListURL("https://ark.cn-beijing.volces.com")
	require.NoError(t, err)
	assert.Equal(t, "https://ark.cn-beijing.volces.com/api/v3/models", url)
}
