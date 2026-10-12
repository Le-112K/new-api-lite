package onemin

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func messageWithImages(t *testing.T, parts ...dto.MediaContent) dto.Message {
	t.Helper()
	return dto.Message{Role: "user", Content: parts}
}

func textMessage(role, text string) dto.Message {
	return dto.Message{Role: role, Content: text}
}

func TestBuildNativePayloadKeepsTextOnlyOnOpenAISurface(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:    "gpt-6-luna",
		Messages: []dto.Message{textMessage("user", "hello")},
	}

	payload, hasImages := buildNativePayload(request)

	assert.False(t, hasImages, "text-only requests must not switch to the native surface")
	assert.Empty(t, payload.PromptObject.Attachments)
}

func TestBuildNativePayloadRoutesImagesToAttachments(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			textMessage("system", "be brief"),
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "what is this"},
				dto.MediaContent{
					Type:     dto.ContentTypeImageURL,
					ImageUrl: map[string]any{"url": "https://example.com/a.png"},
				},
			),
		},
	}

	payload, hasImages := buildNativePayload(request)

	require.True(t, hasImages)
	require.NotNil(t, payload.PromptObject.Attachments)
	assert.Equal(t, []string{"https://example.com/a.png"}, payload.PromptObject.Attachments.Images)
	assert.Equal(t, nativeFeatureTag, payload.Type)
	assert.Contains(t, payload.PromptObject.Prompt, "be brief")
	assert.Contains(t, payload.PromptObject.Prompt, "what is this")
}

func relayContext(t *testing.T) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.1min.ai",
			ApiKey:         "test-key",
		},
	}
}

func TestAdaptorRoutesByImagePresence(t *testing.T) {
	adaptor := &Adaptor{}
	c, info := relayContext(t)

	textOnly := &dto.GeneralOpenAIRequest{
		Model:    "gpt-6-luna",
		Messages: []dto.Message{textMessage("user", "hi")},
	}
	_, err := adaptor.ConvertOpenAIRequest(c, info, textOnly)
	require.NoError(t, err)
	assert.False(t, adaptor.useNative)

	// A remote URL needs no upload, so this stays a pure routing assertion.
	withImage := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{messageWithImages(t,
			dto.MediaContent{
				Type:     dto.ContentTypeImageURL,
				ImageUrl: map[string]any{"url": "https://example.com/a.png"},
			},
		)},
	}
	_, err = adaptor.ConvertOpenAIRequest(c, info, withImage)
	require.NoError(t, err)
	assert.True(t, adaptor.useNative, "image requests must use the native surface")
}

func TestDescribeImageSchemes(t *testing.T) {
	assert.Equal(t, "none", describeImageSchemes(nil))
	assert.Equal(t, "inline", describeImageSchemes([]string{"data:image/png;base64,AAAA"}))
	assert.Equal(t, "url:example.com", describeImageSchemes([]string{"https://example.com/a.png"}))
	assert.Equal(t, "empty", describeImageSchemes([]string{""}))
}

func TestNativeToOpenAIResponse(t *testing.T) {
	body := []byte(`{
		"aiRecord": {
			"uuid": "abc-123",
			"model": "gpt-6-luna",
			"status": "SUCCESS",
			"aiRecordDetail": {"resultObject": ["图片是", "绿色"]}
		},
		"metadata": {"inputToken": 150, "outputToken": 5, "totalToken": 155}
	}`)

	response, upstreamErr := nativeToOpenAIResponse(body, "fallback-model")

	require.Nil(t, upstreamErr)
	require.Len(t, response.Choices, 1)
	assert.Equal(t, "chatcmpl-abc-123", response.Id)
	assert.Equal(t, "图片是绿色", response.Choices[0].Message.Content)
	assert.Equal(t, "stop", response.Choices[0].FinishReason)
	assert.Equal(t, 150, response.Usage.PromptTokens)
	assert.Equal(t, 5, response.Usage.CompletionTokens)
	assert.Equal(t, 155, response.Usage.TotalTokens)
	assert.Equal(t, "gpt-6-luna", response.Model)
}

func TestNativeToOpenAIResponseSurfacesReasoning(t *testing.T) {
	body := []byte(`{
		"aiRecord": {"uuid": "r1", "model": "gpt-6-luna", "status": "SUCCESS",
			"aiRecordDetail": {"resultObject": ["红色"]}},
		"metadata": {"inputToken": 10, "outputToken": 2, "totalToken": 12,
			"reasoningContent": "**Identifying colors**\n\nLooking at the image..."}
	}`)

	response, upstreamErr := nativeToOpenAIResponse(body, "gpt-6-luna")

	require.Nil(t, upstreamErr)
	require.NotNil(t, response.Choices[0].Message.ReasoningContent)
	assert.Contains(t, *response.Choices[0].Message.ReasoningContent, "Identifying colors")
	// Reasoning must not leak into the visible answer.
	assert.Equal(t, "红色", response.Choices[0].Message.Content)
}

func TestNativeToOpenAIResponseOmitsEmptyReasoning(t *testing.T) {
	body := []byte(`{
		"aiRecord": {"uuid": "r2", "model": "gpt-6-luna", "status": "SUCCESS",
			"aiRecordDetail": {"resultObject": ["ok"]}},
		"metadata": {"inputToken": 1, "outputToken": 1, "totalToken": 2, "reasoningContent": ""}
	}`)

	response, upstreamErr := nativeToOpenAIResponse(body, "gpt-6-luna")

	require.Nil(t, upstreamErr)
	assert.Nil(t, response.Choices[0].Message.ReasoningContent)
}

func TestNativeToOpenAIResponseRejectsFailureStatus(t *testing.T) {
	body := []byte(`{"aiRecord": {"status": "FAILURE", "model": "gpt-6-luna"}}`)

	_, upstreamErr := nativeToOpenAIResponse(body, "gpt-6-luna")

	require.NotNil(t, upstreamErr)
	assert.Contains(t, upstreamErr.text(), "FAILURE")
}

func TestNativeStreamToOpenAIProducesOpenAIChunks(t *testing.T) {
	native := strings.Join([]string{
		"event: content",
		`data: {"content":"图片"}`,
		"",
		"event: content",
		`data: {"content":"是绿色"}`,
		"",
		"event: result",
		`data: {"aiRecord":{"uuid":"xyz","model":"gpt-6-luna","metadata":{"inputToken":9,"outputToken":3,"totalToken":12}}}`,
		"",
	}, "\n")

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna"))
	require.NoError(t, err)

	output := string(converted)
	assert.Contains(t, output, `"role":"assistant"`)
	assert.Contains(t, output, `"content":"图片"`)
	assert.Contains(t, output, `"content":"是绿色"`)
	assert.Contains(t, output, `"finish_reason":"stop"`)
	assert.Contains(t, output, `"prompt_tokens":9`)
	assert.Contains(t, output, `"completion_tokens":3`)
	assert.Contains(t, output, "data: [DONE]")
	assert.NotContains(t, output, "imageList")

	// The terminal chunk must precede the usage-only chunk.
	assert.Less(t, strings.Index(output, `"finish_reason":"stop"`), strings.Index(output, `"prompt_tokens":9`))
}

func toolRequestBody(t *testing.T, extra map[string]any) []byte {
	t.Helper()
	payload := map[string]any{
		"model":    "gpt-6-luna",
		"messages": []any{map[string]any{"role": "user", "content": "weather?"}},
		"tools": []any{map[string]any{
			"type":     "function",
			"function": map[string]any{"name": "get_weather"},
		}},
	}
	for k, v := range extra {
		payload[k] = v
	}
	encoded, err := json.Marshal(payload)
	require.NoError(t, err)
	return encoded
}

func errorResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

const reasoningEffortError = `{"error":{"message":"Tool calling on this model requires reasoning_effort: none.","type":"invalid_request_error","param":"reasoning_effort"}}`

func TestDetectReasoningEffortShimTriggersOnToolRequest(t *testing.T) {
	resp := errorResponse(http.StatusBadRequest, reasoningEffortError)

	assert.True(t, detectReasoningEffortShim(resp, toolRequestBody(t, nil)))

	// The body must survive the inspection so a non-retried request still
	// reports the upstream error.
	restored, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, reasoningEffortError, string(restored))
}

func TestDetectReasoningEffortShimSkipsOtherCases(t *testing.T) {
	payload := toolRequestBody(t, nil)

	assert.False(t, detectReasoningEffortShim(errorResponse(http.StatusOK, reasoningEffortError), payload),
		"a 200 response is not an error to shim")
	assert.False(t, detectReasoningEffortShim(errorResponse(http.StatusBadRequest, `{"error":{"message":"bad model"}}`), payload),
		"unrelated errors must not trigger a retry")
	assert.False(t, detectReasoningEffortShim(
		errorResponse(http.StatusBadRequest, reasoningEffortError),
		toolRequestBody(t, map[string]any{"reasoning_effort": "high"}),
	), "an explicit effort setting must never be overwritten")

	noTools, err := json.Marshal(map[string]any{"model": "gpt-6-luna", "messages": []any{}})
	require.NoError(t, err)
	assert.False(t, detectReasoningEffortShim(errorResponse(http.StatusBadRequest, reasoningEffortError), noTools),
		"non-tool requests are unaffected")
}

func TestExtractQuotedNames(t *testing.T) {
	assert.Equal(t,
		[]string{"reasoning", "enable_thinking", "thinking"},
		extractQuotedNames(`Unrecognized keys: "reasoning", "enable_thinking", "thinking"`))
	assert.Equal(t, []string{"enable_thinking"},
		extractQuotedNames(`Unrecognized key: "enable_thinking"`))
	assert.Empty(t, extractQuotedNames("Unrecognized key: nothing quoted here"))
}

func TestRejectedParamsAndDropNamedKeys(t *testing.T) {
	body := []byte(`{"model":"gpt-6-luna","messages":[],"thinking":{"type":"enabled"},"enable_thinking":true,"reasoning_effort":"low"}`)
	resp := errorResponse(http.StatusBadRequest,
		`{"error":{"message":"Unrecognized keys: \"thinking\", \"enable_thinking\"","type":"invalid_request_error"}}`)

	names := rejectedParams(resp)
	assert.ElementsMatch(t, []string{"thinking", "enable_thinking"}, names)

	retried, ok := dropNamedKeys(body, names)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(retried, &payload))
	assert.NotContains(t, payload, "thinking")
	assert.NotContains(t, payload, "enable_thinking")
	// Everything the upstream did not complain about must survive.
	assert.Equal(t, "gpt-6-luna", payload["model"])
	assert.Equal(t, "low", payload["reasoning_effort"])

	// The original error body stays readable when a retry does not happen.
	restored, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Contains(t, string(restored), "Unrecognized keys")
}

func TestRejectedParamsHandlesOmitWording(t *testing.T) {
	resp := errorResponse(http.StatusBadRequest,
		`{"error":{"message":"Omit temperature for this model.","param":"temperature"}}`)
	assert.Equal(t, []string{"temperature"}, rejectedParams(resp))

	conflict := errorResponse(http.StatusBadRequest,
		`{"error":{"message":"Specify either max_tokens or max_completion_tokens, not both.","param":"max_completion_tokens"}}`)
	assert.Equal(t, []string{"max_completion_tokens"}, rejectedParams(conflict))
}

func TestRejectedParamsIgnoresOtherErrors(t *testing.T) {
	body := []byte(`{"model":"gpt-6-luna","messages":[]}`)

	assert.Empty(t, rejectedParams(errorResponse(http.StatusOK, `{"error":{"message":"Unrecognized key: \"x\""}}`)),
		"a successful response must never be rewritten")
	assert.Empty(t, rejectedParams(errorResponse(http.StatusBadRequest, `{"error":{"message":"some other failure"}}`)),
		"unrelated errors must not trigger a retry")

	// Named keys that are absent from the payload leave nothing to retry.
	_, ok := dropNamedKeys(body, []string{"absent_key"})
	assert.False(t, ok)
}

func TestWithReasoningEffortNone(t *testing.T) {
	retried, ok := withReasoningEffortNone(toolRequestBody(t, nil))
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(retried, &payload))
	assert.Equal(t, "none", payload["reasoning_effort"])
	assert.NotNil(t, payload["tools"], "the original tools must be preserved")

	_, ok = withReasoningEffortNone(toolRequestBody(t, map[string]any{"reasoning_effort": "high"}))
	assert.False(t, ok, "existing effort must not be overwritten")

	noTools, err := json.Marshal(map[string]any{"model": "gpt-6-luna", "messages": []any{}})
	require.NoError(t, err)
	_, ok = withReasoningEffortNone(noTools)
	assert.False(t, ok)
}

func TestNativeStreamHandlesEmptyContent(t *testing.T) {
	native := "event: result\ndata: {\"aiRecord\":{\"uuid\":\"e\",\"model\":\"gpt-6-luna\"}}\n\n"

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna"))
	require.NoError(t, err)

	output := string(converted)
	assert.Contains(t, output, `"role":"assistant"`)
	assert.Contains(t, output, `"finish_reason":"stop"`)
	assert.Contains(t, output, "data: [DONE]")
}
