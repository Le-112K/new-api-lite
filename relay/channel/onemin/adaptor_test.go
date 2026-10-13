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

	plan := buildNativePayload(request)

	assert.False(t, plan.hasImages, "text-only requests must not switch to the native surface")
	assert.Empty(t, plan.payload.PromptObject.Attachments)
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

	plan := buildNativePayload(request)
	payload := plan.payload

	require.True(t, plan.hasImages)
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

func TestStripCrawlingArtifact(t *testing.T) {
	// ZCode stores its own "Crawling site" decoration for loopback URLs in the
	// conversation; replaying it teaches the model to keep emitting it.
	assert.Equal(t,
		"**Interpreting user's request**\n\nThe user mentioned an image.",
		stripCrawlingArtifact("🌐 Crawling site http://127.0.0.1:8080\n**Interpreting user's request**\n\nThe user mentioned an image."))

	assert.Equal(t, "好的，抱歉刚才用了英文。",
		stripCrawlingArtifact("🌐 Crawling site 🔗 http://127.0.0.1:19387\n好的，抱歉刚才用了英文。"))

	// Ordinary content is untouched, including other hosts and plain text.
	assert.Equal(t, "回答正文", stripCrawlingArtifact("回答正文"))
	assert.Equal(t, "see http://example.com for details",
		stripCrawlingArtifact("see http://example.com for details"))
	assert.Equal(t, "http://127.0.0.1:8080 without the label",
		stripCrawlingArtifact("http://127.0.0.1:8080 without the label"))
}

func TestBuildNativePayloadDropsArtifactOnlyMessages(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			{Content: "🌐 Crawling site http://127.0.0.1:8080", Role: "assistant"},
			textMessage("user", "真实的用户消息"),
		},
	}

	payload := buildNativePayload(request).payload

	assert.NotContains(t, payload.PromptObject.Prompt, "Crawling site")
	assert.Contains(t, payload.PromptObject.Prompt, "真实的用户消息")
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

	response, upstreamErr := nativeToOpenAIResponse(body, "fallback-model", false)

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

func TestNativeToOpenAIResponseDropsReasoning(t *testing.T) {
	// The upstream reports the model's thinking, but forwarding it makes clients
	// without a thinking panel print it ahead of the answer, so it is dropped.
	body := []byte(`{
		"aiRecord": {"uuid": "r1", "model": "gpt-6-luna", "status": "SUCCESS",
			"aiRecordDetail": {"resultObject": ["红色"]}},
		"metadata": {"inputToken": 10, "outputToken": 2, "totalToken": 12,
			"reasoningContent": "**Identifying colors**\n\nLooking at the image..."}
	}`)

	response, upstreamErr := nativeToOpenAIResponse(body, "gpt-6-luna", false)

	require.Nil(t, upstreamErr)
	assert.Nil(t, response.Choices[0].Message.ReasoningContent)
	assert.Equal(t, "红色", response.Choices[0].Message.Content)
}

func TestNativeToOpenAIResponseRejectsFailureStatus(t *testing.T) {
	body := []byte(`{"aiRecord": {"status": "FAILURE", "model": "gpt-6-luna"}}`)

	_, upstreamErr := nativeToOpenAIResponse(body, "gpt-6-luna", false)

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

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna", false, nil))
	require.NoError(t, err)

	output := string(converted)
	// The opening is held back briefly so a leading decoration can be stripped,
	// so deltas may arrive coalesced; assert on the text that reaches the client.
	assert.Contains(t, output, `"role":"assistant"`)
	assert.Contains(t, output, `"content":"图片是绿色"`)
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

func TestDropNamedKeysAlsoCleansMessages(t *testing.T) {
	// Clients replay the reasoning we returned as message.reasoning_content,
	// which the upstream refuses to accept as input.
	body := []byte(`{"model":"gpt-6-luna","messages":[
		{"role":"user","content":"hi"},
		{"role":"assistant","content":"hello","reasoning_content":"thinking..."},
		{"role":"user","content":"again"}
	]}`)

	stripped, ok := dropNamedKeys(body, []string{"reasoning_content"})
	require.True(t, ok)

	var payload struct {
		Messages []map[string]any `json:"messages"`
	}
	require.NoError(t, json.Unmarshal(stripped, &payload))
	require.Len(t, payload.Messages, 3)
	for _, message := range payload.Messages {
		assert.NotContains(t, message, "reasoning_content")
	}
	// Message content must be untouched.
	assert.Equal(t, "hello", payload.Messages[1]["content"])
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

func TestNativeStreamDropsReasoningEvents(t *testing.T) {
	// The upstream frames thinking separately; forwarding it made clients print
	// the model's reasoning ahead of the answer.
	native := strings.Join([]string{
		"event: reasoning",
		`data: {"content":"**Describing image in Chinese**"}`,
		"",
		"event: reasoning",
		`data: {"content":"\n\nI see a red rectangle."}`,
		"",
		"event: content",
		`data: {"content":"这是一张纯红色的图片。"}`,
		"",
		"event: result",
		`data: {"aiRecord":{"uuid":"s1","model":"gpt-6-luna","metadata":{"inputToken":9,"outputToken":3,"totalToken":12}}}`,
		"",
	}, "\n")

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna", false, nil))
	require.NoError(t, err)

	output := string(converted)
	assert.Contains(t, output, "这是一张纯红色的图片。")
	assert.NotContains(t, output, "Describing image in Chinese")
	assert.NotContains(t, output, "I see a red rectangle")
	assert.Contains(t, output, "data: [DONE]")
}

func TestCrawlingStripperRemovesLeadingMarker(t *testing.T) {
	// The upstream prepends this when it fetches a loopback URL mentioned in the
	// prompt; the marker must not reach the client.
	marker := "🌐 Crawling site http://127.0.0.1:8080\n"

	stripper := &crawlingStripper{}
	assert.Equal(t, "", stripper.feed(marker), "the opening is withheld")
	assert.Equal(t, "好的，我会用中文回答。", stripper.feed("好的，我会用中文回答。"))
	assert.Equal(t, "", stripper.flush())
}

func TestCrawlingStripperPassesNormalRepliesThrough(t *testing.T) {
	stripper := &crawlingStripper{}
	first := stripper.feed("这是一张纯红色的图片，没有其他可辨认的内容，尺寸约为 224x126 像素。")
	assert.NotContains(t, first, "Crawling")
	assert.Contains(t, first, "纯红色")
}

func TestCrawlingStripperFlushesShortReplies(t *testing.T) {
	// Answers shorter than the lookahead must still reach the client.
	stripper := &crawlingStripper{}
	assert.Equal(t, "", stripper.feed("蓝色。"))
	assert.Equal(t, "蓝色。", stripper.flush())
	assert.Equal(t, "", stripper.flush(), "flush is idempotent")
}

func TestCrawlingStripperHandlesSplitMarker(t *testing.T) {
	stripper := &crawlingStripper{}
	assert.Equal(t, "", stripper.feed("🌐 Craw"))
	assert.Equal(t, "", stripper.feed("ling site http://127.0.0.1:19387\n"))
	// Still within the lookahead window, so nothing is released yet.
	assert.Equal(t, "", stripper.feed("正文"))
	assert.Equal(t, "正文", stripper.flush())
}

func TestNativeStreamHandlesEmptyContent(t *testing.T) {
	native := "event: result\ndata: {\"aiRecord\":{\"uuid\":\"e\",\"model\":\"gpt-6-luna\"}}\n\n"

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna", false, nil))
	require.NoError(t, err)

	output := string(converted)
	assert.Contains(t, output, `"role":"assistant"`)
	assert.Contains(t, output, `"finish_reason":"stop"`)
	assert.Contains(t, output, "data: [DONE]")
}

func imagePart(url string) dto.MediaContent {
	return dto.MediaContent{
		Type:     dto.ContentTypeImageURL,
		ImageUrl: map[string]any{"url": url},
	}
}

func weatherTools() []dto.ToolCallRequest {
	return []dto.ToolCallRequest{{
		Type: "function",
		Function: dto.FunctionRequest{
			Name:        "get_weather",
			Description: "Get the weather for a city",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"city": map[string]any{"type": "string"},
				},
				"required": []any{"city"},
			},
		},
	}}
}

// A client replays the whole conversation on every request. If any earlier turn
// carried a picture, that must not drag later turns onto the native surface —
// that is what silently disabled tool calling for the rest of the conversation.
func TestOlderTurnImagesDoNotRouteToNativeSurface(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "这是什么品牌"},
				imagePart("https://example.com/a.png"),
			),
			textMessage("assistant", "Google"),
			textMessage("user", "查询北京天气"),
		},
		Tools: weatherTools(),
	}

	plan := buildNativePayload(request)

	assert.False(t, plan.hasImages, "pictures from earlier turns must not switch to the native surface")
	assert.Nil(t, plan.payload.PromptObject.Attachments)
	assert.False(t, plan.toolAware)
}

// The newest user turn is the one that decides.
func TestCurrentTurnImageStillRoutesToNativeSurface(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			textMessage("user", "你好"),
			textMessage("assistant", "你好"),
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "看看这张"},
				imagePart("https://example.com/b.png"),
			),
		},
	}

	plan := buildNativePayload(request)

	require.True(t, plan.hasImages)
	require.NotNil(t, plan.payload.PromptObject.Attachments)
	assert.Equal(t, []string{"https://example.com/b.png"}, plan.payload.PromptObject.Attachments.Images)
}

func TestOlderTurnImagesBecomeMarkersInNativePrompt(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "之前那张"},
				imagePart("https://example.com/old.png"),
			),
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "这张呢"},
				imagePart("https://example.com/new.png"),
			),
		},
	}

	plan := buildNativePayload(request)

	require.True(t, plan.hasImages)
	require.NotNil(t, plan.payload.PromptObject.Attachments)
	assert.Equal(t, []string{"https://example.com/new.png"}, plan.payload.PromptObject.Attachments.Images,
		"only the newest turn's picture is sent to the model")
	assert.Contains(t, plan.payload.PromptObject.Prompt, staleImageMarker)
}

// The native surface has no tools field, so a vision request that needs tools
// gets them described in the prompt instead.
func TestToolsAreDescribedInPromptWhenCombinedWithImages(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "描述图片并查天气"},
				imagePart("https://example.com/a.png"),
			),
		},
		Tools: weatherTools(),
	}

	plan := buildNativePayload(request)

	require.True(t, plan.hasImages)
	assert.True(t, plan.toolAware, "tools must be described when the native surface is used")
	assert.Contains(t, plan.payload.PromptObject.Prompt, "get_weather")
	assert.Contains(t, plan.payload.PromptObject.Prompt, "city: required")
	assert.Contains(t, plan.payload.PromptObject.Prompt, "tool_calls")
}

// Without pictures the OpenAI-compatible surface handles tools natively, so no
// prompt script should be involved.
func TestToolsAreNotDescribedWithoutImages(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:    "gpt-6-luna",
		Messages: []dto.Message{textMessage("user", "查询天气")},
		Tools:    weatherTools(),
	}

	plan := buildNativePayload(request)

	assert.False(t, plan.hasImages)
	assert.False(t, plan.toolAware)
}

func TestParseToolScript(t *testing.T) {
	script := `{"tool_calls":[{"name":"get_weather","arguments":{"city":"北京"}}]}`
	calls, ok := parseToolScript(script)
	require.True(t, ok)
	require.Len(t, calls, 1)
	assert.Equal(t, "get_weather", calls[0].Function.Name)
	assert.Equal(t, `{"city":"北京"}`, calls[0].Function.Arguments)
	assert.True(t, strings.HasPrefix(calls[0].ID, "call_"))

	fenced := "```json\n" + script + "\n```"
	calls, ok = parseToolScript(fenced)
	require.True(t, ok, "a markdown fence should be stripped")
	assert.Equal(t, "get_weather", calls[0].Function.Name)

	_, ok = parseToolScript("北京今天晴，气温 25 度。")
	assert.False(t, ok, "ordinary prose is not a tool request")

	_, ok = parseToolScript("")
	assert.False(t, ok)

	_, ok = parseToolScript(`{"tool_calls":[]}`)
	assert.False(t, ok)

	_, ok = parseToolScript(`{"tool_calls":[{"name":"","arguments":{}}]}`)
	assert.False(t, ok, "a nameless entry is not usable")
}

func TestSanitizeMessagesForOpenAIReplacesImages(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "之前那张"},
				imagePart("https://example.com/old.png"),
			),
			textMessage("assistant", "Google"),
			textMessage("user", "查询北京天气"),
		},
	}

	cleaned := sanitizeMessagesForOpenAI(request)

	assert.NotSame(t, request, cleaned)
	first := cleaned.Messages[0]
	encoded, err := json.Marshal(first.Content)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "example.com/old.png",
		"the OpenAI-compatible surface rejects image content")
	assert.Contains(t, string(encoded), staleImageMarker)
	// Untouched messages keep their text.
	assert.Equal(t, "查询北京天气", cleaned.Messages[2].Content)
}

func TestSanitizeMessagesForOpenAILeavesCleanRequestsAlone(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:    "gpt-6-luna",
		Messages: []dto.Message{textMessage("user", "hello")},
	}

	assert.Same(t, request, sanitizeMessagesForOpenAI(request))
}

// End-to-end routing: after an older turn carried an image, a new text question
// with tools must still reach the OpenAI-compatible surface.
func TestConvertOpenAIRequestStaysOnOpenAISurfaceAfterOlderImage(t *testing.T) {
	c, info := relayContext(t)
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{
			messageWithImages(t,
				dto.MediaContent{Type: dto.ContentTypeText, Text: "这是什么品牌"},
				imagePart("https://example.com/a.png"),
			),
			textMessage("assistant", "Google"),
			textMessage("user", "查询北京天气"),
		},
		Tools: weatherTools(),
	}

	adaptor := &Adaptor{}
	adaptor.Init(info)
	converted, err := adaptor.ConvertOpenAIRequest(c, info, request)

	require.NoError(t, err)
	assert.False(t, adaptor.useNative, "must not be pinned to the native surface")
	forwarded, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok, "expected the request to be forwarded to the OpenAI-compatible surface")
	assert.Len(t, forwarded.Messages, 3)
	encoded, err := json.Marshal(forwarded.Messages[0].Content)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "image_url")
}

func TestNativeStreamEmitsToolCallsWhenToolAware(t *testing.T) {
	native := "event: content\ndata: {\"content\":\"{\\\"tool_calls\\\":[{\\\"name\\\":\\\"get_weather\\\",\\\"arguments\\\":{\\\"city\\\":\\\"北京\\\"}}]}\"}\n\n" +
		"event: result\ndata: {\"aiRecord\":{\"uuid\":\"t\",\"model\":\"gpt-6-luna\"}}\n\n"

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna", true, nil))

	require.NoError(t, err)
	output := string(converted)
	assert.Contains(t, output, "get_weather")
	assert.Contains(t, output, `"finish_reason":"tool_calls"`)
	assert.Contains(t, output, "data: [DONE]")
}

func TestNativeStreamPassesProseThroughWhenToolAware(t *testing.T) {
	native := "event: content\ndata: {\"content\":\"这是一张 Google 的标志图片，蓝红黄绿四色组成。\"}\n\n" +
		"event: result\ndata: {\"aiRecord\":{\"uuid\":\"t2\",\"model\":\"gpt-6-luna\"}}\n\n"

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna", true, nil))

	require.NoError(t, err)
	output := string(converted)
	assert.NotContains(t, output, `"finish_reason":"tool_calls"`)
	assert.Contains(t, output, "Google")
	assert.Contains(t, output, `"finish_reason":"stop"`)
}
