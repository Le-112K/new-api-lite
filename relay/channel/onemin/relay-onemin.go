package onemin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// buildNativePayload flattens an OpenAI chat request into the native feature
// payload and reports whether it carries images. Text-only requests keep using
// the OpenAI-compatible surface, which preserves tools and structured output;
// only image requests need the native surface.
func buildNativePayload(request *dto.GeneralOpenAIRequest) (nativeChatRequest, bool) {
	var prompt strings.Builder
	var images []string

	for _, message := range request.Messages {
		contents := message.ParseContent()
		var textParts []string
		for i := range contents {
			switch contents[i].Type {
			case dto.ContentTypeText:
				if contents[i].Text != "" {
					textParts = append(textParts, contents[i].Text)
				}
			case dto.ContentTypeImageURL:
				if image := contents[i].GetImageMedia(); image != nil && image.Url != "" {
					images = append(images, image.Url)
				}
			}
		}
		if len(textParts) == 0 {
			continue
		}
		text := strings.Join(textParts, "\n")
		// The native surface takes a single prompt string, so roles are folded
		// into a compact transcript that keeps the model's instructions intact.
		switch message.Role {
		case "system", "developer":
			prompt.WriteString(text)
			prompt.WriteString("\n\n")
		case "assistant":
			prompt.WriteString("Assistant: ")
			prompt.WriteString(text)
			prompt.WriteString("\n")
		default:
			if prompt.Len() > 0 {
				prompt.WriteString("User: ")
			}
			prompt.WriteString(text)
			prompt.WriteString("\n")
		}
	}

	payload := nativeChatRequest{
		Type:  nativeFeatureTag,
		Model: request.Model,
		PromptObject: nativePromptObject{
			Prompt: strings.TrimSpace(prompt.String()),
		},
	}
	if len(images) > 0 {
		payload.PromptObject.Attachments = &nativeAttachments{Images: images}
	}
	return payload, len(images) > 0
}

// nativeMetadata carries the upstream token counters. inputToken/outputToken
// are self-consistent with totalToken; promptToken counts something else and is
// deliberately ignored.
type nativeMetadata struct {
	InputToken   int `json:"inputToken"`
	OutputToken  int `json:"outputToken"`
	TotalToken   int `json:"totalToken"`
	InputDetails struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"inputTokenDetails"`
}

// nativeToOpenAIResponse converts the native envelope into an OpenAI chat
// completion so the shared OpenAI response handling (billing, format
// conversion, rendering) can be reused verbatim.
func nativeToOpenAIResponse(body []byte, model string) (*dto.OpenAITextResponse, *nativeError) {
	var envelope struct {
		AiRecord nativeAiRecord `json:"aiRecord"`
		Metadata nativeMetadata `json:"metadata"`
	}
	if err := common.Unmarshal(body, &envelope); err != nil {
		return nil, &nativeError{Message: "failed to parse 1min response: " + err.Error()}
	}

	record := envelope.AiRecord
	if record.Status != "" && record.Status != "SUCCESS" {
		return nil, &nativeError{Message: "1min returned status " + record.Status}
	}

	content := ""
	if len(record.AiRecordDetail.ResultObject) > 0 {
		content = strings.Join(record.AiRecordDetail.ResultObject, "")
	}

	responseModel := record.Model
	if responseModel == "" {
		responseModel = model
	}

	finishReason := "stop"
	response := &dto.OpenAITextResponse{
		Id:      "chatcmpl-" + record.Uuid,
		Model:   responseModel,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: []dto.OpenAITextResponseChoice{{
			Index: 0,
			Message: dto.Message{
				Role:    "assistant",
				Content: content,
			},
			FinishReason: finishReason,
		}},
	}
	response.Usage = dto.Usage{
		PromptTokens:     envelope.Metadata.InputToken,
		CompletionTokens: envelope.Metadata.OutputToken,
		TotalTokens:      envelope.Metadata.TotalToken,
	}
	response.Usage.PromptTokensDetails.CachedTokens = envelope.Metadata.InputDetails.CachedTokens
	return response, nil
}

// nativeStreamToOpenAI rewrites the native SSE stream into OpenAI chat
// completion chunks. The reader is consumed in the background so the shared
// OpenAI stream handler can keep doing the chunk parsing and billing.
func nativeStreamToOpenAI(body io.Reader, model string) io.Reader {
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		scanner := helper.NewStreamScanner(body)
		var responseId string
		created := common.GetTimestamp()
		sentRole := false
		var finalUsage *dto.Usage

		writeChunk := func(delta dto.ChatCompletionsStreamResponseChoiceDelta, finish *string) error {
			chunk := dto.ChatCompletionsStreamResponse{
				Id:      responseId,
				Object:  "chat.completion.chunk",
				Created: created,
				Model:   model,
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index:        0,
					Delta:        delta,
					FinishReason: finish,
				}},
			}
			data, err := json.Marshal(chunk)
			if err != nil {
				return err
			}
			_, err = fmt.Fprintf(pw, "data: %s\n\n", data)
			return err
		}

		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "event:") {
				continue
			}
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if payload == "" || payload == "[DONE]" {
				continue
			}

			var event nativeStreamEvent
			if err := common.UnmarshalJsonStr(payload, &event); err != nil {
				continue
			}

			if responseId == "" {
				if event.AiRecord != nil && event.AiRecord.Uuid != "" {
					responseId = "chatcmpl-" + event.AiRecord.Uuid
				} else {
					responseId = "chatcmpl-1min"
				}
			}

			if event.AiRecord != nil {
				// Terminal event. Usage is held back until after the
				// finish_reason chunk, matching the OpenAI stream layout.
				if record := event.AiRecord; record.Model != "" {
					model = record.Model
				}
				finalUsage = nativeUsageFromStreamRecord(payload)
				continue
			}

			if event.Content == "" {
				continue
			}
			delta := dto.ChatCompletionsStreamResponseChoiceDelta{}
			if !sentRole {
				delta.Role = "assistant"
				sentRole = true
			}
			content := event.Content
			delta.Content = &content
			if err := writeChunk(delta, nil); err != nil {
				pw.CloseWithError(err)
				return
			}
		}

		if err := scanner.Err(); err != nil {
			pw.CloseWithError(err)
			return
		}

		stop := "stop"
		finalDelta := dto.ChatCompletionsStreamResponseChoiceDelta{}
		if !sentRole {
			finalDelta.Role = "assistant"
		}
		if err := writeChunk(finalDelta, &stop); err != nil {
			pw.CloseWithError(err)
			return
		}
		if finalUsage != nil {
			data, err := json.Marshal(dto.ChatCompletionsStreamResponse{
				Id:      responseId,
				Object:  "chat.completion.chunk",
				Created: created,
				Model:   model,
				Choices: []dto.ChatCompletionsStreamResponseChoice{},
				Usage:   finalUsage,
			})
			if err == nil {
				fmt.Fprintf(pw, "data: %s\n\n", data)
			}
		}
		fmt.Fprint(pw, "data: [DONE]\n\n")
	}()
	return pr
}

func nativeUsageFromStreamRecord(payload string) *dto.Usage {
	var envelope struct {
		AiRecord struct {
			Metadata nativeMetadata `json:"metadata"`
		} `json:"aiRecord"`
	}
	if err := common.UnmarshalJsonStr(payload, &envelope); err != nil {
		return nil
	}
	meta := envelope.AiRecord.Metadata
	if meta.TotalToken == 0 && meta.InputToken == 0 && meta.OutputToken == 0 {
		return nil
	}
	usage := &dto.Usage{
		PromptTokens:     meta.InputToken,
		CompletionTokens: meta.OutputToken,
		TotalTokens:      meta.TotalToken,
	}
	usage.PromptTokensDetails.CachedTokens = meta.InputDetails.CachedTokens
	return usage
}

// Some reasoning models (the gpt-6 family) reject tool calling unless
// reasoning_effort is explicitly "none", while every other model rejects the
// field outright ("reasoning_effort is supported only for OpenAI reasoning
// models"). Which models fall on which side cannot be told from the request, so
// the shim reacts to the upstream error instead of guessing by model name: only
// when the error names this exact requirement is the request replayed once with
// the field set.
const reasoningEffortRequiredMarker = "requires reasoning_effort"

// detectReasoningEffortShim reports whether the upstream rejected a tool call
// because reasoning_effort was not "none". The response body is inspected
// through a restoring read so a non-retried request keeps its error payload.
func detectReasoningEffortShim(resp *http.Response, requestBody []byte) bool {
	if resp == nil || resp.StatusCode != http.StatusBadRequest || resp.Body == nil {
		return false
	}
	preview, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return false
	}
	rest, err := io.ReadAll(resp.Body)
	if err != nil {
		return false
	}
	resp.Body = io.NopCloser(io.MultiReader(bytes.NewReader(preview), bytes.NewReader(rest)))
	if !bytes.Contains(preview, []byte(reasoningEffortRequiredMarker)) {
		return false
	}

	var payload struct {
		Tools           []json.RawMessage `json:"tools"`
		ReasoningEffort json.RawMessage   `json:"reasoning_effort"`
	}
	if err := common.Unmarshal(requestBody, &payload); err != nil {
		return false
	}
	return len(payload.Tools) > 0 && len(payload.ReasoningEffort) == 0
}

// withReasoningEffortNone replays a tool-calling payload with the field the
// upstream demands. It returns false when the payload is not a tool request or
// already carries an effort setting, so nothing is ever overwritten.
func withReasoningEffortNone(body []byte) ([]byte, bool) {
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, false
	}
	tools, hasTools := payload["tools"].([]any)
	if !hasTools || len(tools) == 0 {
		return nil, false
	}
	if _, exists := payload["reasoning_effort"]; exists {
		return nil, false
	}
	payload["reasoning_effort"] = "none"
	retried, err := common.Marshal(payload)
	if err != nil {
		return nil, false
	}
	return retried, true
}

func replaceResponseBody(resp *http.Response, body []byte, contentType string) {
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Type", contentType)
	resp.StatusCode = http.StatusOK
}
