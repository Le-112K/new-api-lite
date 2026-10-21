package advancedcustom_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/advancedcustom"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSGLangChannelProtocols(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeSGLang)
	require.True(t, ok)
	adaptor := relay.GetAdaptor(apiType)
	require.NotNil(t, adaptor)
	assert.Equal(t, "advanced_custom", adaptor.GetChannelName())
	assert.Contains(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeSGLang, "served-model"), constant.EndpointTypeAnthropic)
	assert.Contains(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeSGLang, "served-model"), constant.EndpointTypeOpenAIResponse)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeSGLang, ChannelBaseUrl: "https://inference.example/prefix", ApiKey: "test-key"}}
	info.ChannelOtherSettings.AdvancedCustom = common.GetAdvancedCustomPreset(constant.ChannelTypeSGLang)
	adaptor.Init(info)
	for _, path := range []string{"/v1/chat/completions", "/v1/responses", "/v1/messages"} {
		info.RequestURLPath = path
		adaptor = &advancedcustom.Adaptor{}
		adaptor.Init(info)
		url, err := adaptor.GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, "https://inference.example/prefix"+path, url)
	}
	for _, format := range []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude} {
		info.RelayFormat = format
		info.RequestURLPath = "/v1/messages"
		adaptor = &advancedcustom.Adaptor{}
		adaptor.Init(info)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
		headers := http.Header{}
		require.NoError(t, adaptor.SetupRequestHeader(c, &headers, info))
		assert.Equal(t, "Bearer test-key", headers.Get("Authorization"))
	}
	info.RequestURLPath = "/v1/chat/completions"
	adaptor = &advancedcustom.Adaptor{}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	request := &dto.GeneralOpenAIRequest{Model: "served-model"}
	converted, err := adaptor.ConvertOpenAIRequest(c, info, request)
	require.NoError(t, err)
	assert.Same(t, request, converted)
	info.RequestURLPath = "/v1/messages"
	adaptor = &advancedcustom.Adaptor{}
	adaptor.Init(info)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	claudeRequest := &dto.ClaudeRequest{Model: "served-model", Thinking: &dto.Thinking{Type: "adaptive"}}
	converted, err = adaptor.ConvertClaudeRequest(c, info, claudeRequest)
	require.NoError(t, err)
	assert.Same(t, claudeRequest, converted)
	info.RequestURLPath = "/v1beta/models/test:generateContent"
	adaptor = &advancedcustom.Adaptor{}
	adaptor.Init(info)
	_, err = adaptor.ConvertGeminiRequest(nil, info, &dto.GeminiChatRequest{})
	require.Error(t, err)
}
