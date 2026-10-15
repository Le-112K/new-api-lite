package openai

import (
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
