package onemin

import (
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"

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

func TestAdaptorRoutesByImagePresence(t *testing.T) {
	adaptor := &Adaptor{}

	textOnly := &dto.GeneralOpenAIRequest{
		Model:    "gpt-6-luna",
		Messages: []dto.Message{textMessage("user", "hi")},
	}
	_, err := adaptor.ConvertOpenAIRequest(nil, nil, textOnly)
	require.NoError(t, err)
	assert.False(t, adaptor.useNative)

	withImage := &dto.GeneralOpenAIRequest{
		Model: "gpt-6-luna",
		Messages: []dto.Message{messageWithImages(t,
			dto.MediaContent{
				Type:     dto.ContentTypeImageURL,
				ImageUrl: map[string]any{"url": "https://example.com/a.png"},
			},
		)},
	}
	_, err = adaptor.ConvertOpenAIRequest(nil, nil, withImage)
	require.NoError(t, err)
	assert.True(t, adaptor.useNative, "image requests must use the native surface")
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

func TestNativeStreamHandlesEmptyContent(t *testing.T) {
	native := "event: result\ndata: {\"aiRecord\":{\"uuid\":\"e\",\"model\":\"gpt-6-luna\"}}\n\n"

	converted, err := io.ReadAll(nativeStreamToOpenAI(strings.NewReader(native), "gpt-6-luna"))
	require.NoError(t, err)

	output := string(converted)
	assert.Contains(t, output, `"role":"assistant"`)
	assert.Contains(t, output, `"finish_reason":"stop"`)
	assert.Contains(t, output, "data: [DONE]")
}
