package onemin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
)

// crawlingArtifact matches the decoration a client renders when the model
// emits a loopback URL — ZCode's system prompt tells the model to link local
// content that way, so it copies the example address into its replies. The
// decoration gets stored in the conversation, and once it is in the history the
// model keeps repeating it, because folding the transcript back into the prompt
// shows it its own past wording. Removing it here breaks that cycle.
var crawlingArtifact = regexp.MustCompile(`🌐\s*Crawling site\s*🔗?\s*http://127\.0\.0\.1:\d+[^\S\n]*\n?`)

func stripCrawlingArtifact(text string) string {
	if !strings.Contains(text, "Crawling site") {
		return text
	}
	return crawlingArtifact.ReplaceAllString(text, "")
}

// crawlingReplyPrefix is the decoration the upstream emits when it decides to
// fetch a loopback URL mentioned in the prompt — ZCode's system prompt offers
// http://127.0.0.1:8080 as its linking example, so it ends up in the prompt of
// every request and the upstream prepends this marker to the reply.
var crawlingReplyPrefix = regexp.MustCompile(`^🌐\s*Crawling site\s*🔗?\s*http://127\.0\.0\.1:\d+[^\S\n]*\n?`)

// crawlingLeadLookahead is how much of a reply is held back before deciding
// whether it opens with the marker. The marker is shorter than this, so one
// withheld prefix is always enough to recognise it.
const crawlingLeadLookahead = 64

// crawlingStripper withholds the opening of a reply just long enough to strip
// the marker, which the upstream may split across deltas, then passes the rest
// through untouched.
type crawlingStripper struct {
	pending strings.Builder
	settled bool
}

// feed returns the text that is safe to forward for this delta, which is empty
// until the opening has been inspected.
func (s *crawlingStripper) feed(chunk string) string {
	if s.settled {
		return chunk
	}
	s.pending.WriteString(chunk)
	if s.pending.Len() < crawlingLeadLookahead {
		return ""
	}
	return s.release()
}

// flush returns whatever is still withheld once the reply ends, so short
// answers are not swallowed by the lookahead.
func (s *crawlingStripper) flush() string {
	if s.settled {
		return ""
	}
	return s.release()
}

func (s *crawlingStripper) release() string {
	s.settled = true
	return stripCrawlingReply(s.pending.String())
}

func stripCrawlingReply(text string) string {
	if !strings.HasPrefix(text, "🌐") {
		return text
	}
	return crawlingReplyPrefix.ReplaceAllString(text, "")
}

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
		text := stripCrawlingArtifact(strings.Join(textParts, "\n"))
		if text == "" {
			// The message carried nothing but the decoration.
			continue
		}
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

	// The upstream reports the model's thinking in metadata.reasoningContent.
	// It is deliberately not forwarded: clients that lack a dedicated thinking
	// panel render it inline ahead of the answer, which reads as noise, and the
	// upstream only supplies it intermittently anyway.
	message := dto.Message{
		Role:    "assistant",
		Content: stripCrawlingReply(content),
	}

	response := &dto.OpenAITextResponse{
		Id:      "chatcmpl-" + record.Uuid,
		Model:   responseModel,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: []dto.OpenAITextResponseChoice{{
			Index:        0,
			Message:      message,
			FinishReason: "stop",
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
func nativeStreamToOpenAI(body io.Reader, model string, onComplete func(transcript, events string)) io.Reader {
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		scanner := helper.NewStreamScanner(body)
		var responseId string
		created := common.GetTimestamp()
		sentRole := false
		var finalUsage *dto.Usage
		var transcript strings.Builder
		var rawEvents strings.Builder
		stripper := &crawlingStripper{}

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

		// The upstream frames each delta with an event name: `reasoning` carries
		// the model's thinking, `content` the answer, `result` the terminal
		// record. The name has to be tracked, otherwise the thinking gets
		// forwarded as answer text.
		eventName := ""
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			if name, found := strings.CutPrefix(line, "event:"); found {
				eventName = strings.TrimSpace(name)
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
				// Terminal event: usage arrives here rather than with each delta.
				if record := event.AiRecord; record.Model != "" {
					model = record.Model
				}
				finalUsage = nativeUsageFromStreamRecord(payload)
				continue
			}

			// The model's thinking is not part of the answer; clients without a
			// dedicated thinking panel would print it ahead of the reply.
			if eventName == "reasoning" {
				continue
			}
			if event.Content == "" {
				continue
			}
			// The stripper withholds the opening, so the delta is built only
			// once there is text to send — otherwise the withheld delta would
			// consume the role marker without ever emitting it.
			sanitized := stripper.feed(event.Content)
			if sanitized == "" {
				continue
			}
			rawEvents.WriteString(fmt.Sprintf("[%s]%s | ", eventName, truncateForLog(sanitized, 120)))
			transcript.WriteString(sanitized)
			content := sanitized
			delta := dto.ChatCompletionsStreamResponseChoiceDelta{Content: &content}
			if !sentRole {
				delta.Role = "assistant"
				sentRole = true
			}
			if err := writeChunk(delta, nil); err != nil {
				pw.CloseWithError(err)
				return
			}
		}

		if err := scanner.Err(); err != nil {
			pw.CloseWithError(err)
			return
		}

		if tail := stripper.flush(); tail != "" {
			content := tail
			if err := writeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{Content: &content}, nil); err != nil {
				pw.CloseWithError(err)
				return
			}
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
		if onComplete != nil {
			onComplete(transcript.String(), rawEvents.String())
		}
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

// uploadAsset stores one image with 1min and returns the key that the native
// chat endpoint accepts in attachments.images. Clients routinely send pasted
// images as base64 data URIs, which the upstream cannot fetch on its own, so
// anything that is not already a plain http(s) URL has to be uploaded first.
func uploadAsset(ctx context.Context, apiBase, apiKey, filename string, raw []byte) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("asset", filename)
	if err != nil {
		return "", err
	}
	if _, err = part.Write(raw); err != nil {
		return "", err
	}
	if err = writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+nativeAssetPath, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("API-KEY", apiKey)

	client := &http.Client{Timeout: assetUploadTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer service.CloseResponseBodyGracefully(resp)

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		var upstream nativeError
		if common.Unmarshal(payload, &upstream) == nil {
			if msg := upstream.text(); msg != "" {
				return "", fmt.Errorf("asset upload rejected: %s", msg)
			}
		}
		return "", fmt.Errorf("asset upload returned status %d", resp.StatusCode)
	}

	var uploaded struct {
		Asset struct {
			Key string `json:"key"`
		} `json:"asset"`
	}
	if err := common.Unmarshal(payload, &uploaded); err != nil {
		return "", err
	}
	if uploaded.Asset.Key == "" {
		return "", errors.New("asset upload returned no key")
	}
	return uploaded.Asset.Key, nil
}

// resolveInlineImages replaces every inline (base64) image with an uploaded
// asset key, leaving plain http(s) URLs untouched so public images still pass
// straight through without a redundant round trip.
func resolveInlineImages(ctx context.Context, apiBase, apiKey string, images []string) ([]string, error) {
	resolved := make([]string, 0, len(images))
	for i, image := range images {
		if !strings.HasPrefix(image, "data:") {
			resolved = append(resolved, image)
			continue
		}
		meta, payload, found := strings.Cut(image, ",")
		if !found {
			return nil, errors.New("malformed inline image")
		}
		if !strings.Contains(meta, "base64") {
			return nil, errors.New("only base64 inline images are supported")
		}
		raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(payload))
		if err != nil {
			return nil, fmt.Errorf("decode inline image: %w", err)
		}
		mime := mimeTypeFromDataURI(meta)
		key, err := uploadAsset(ctx, apiBase, apiKey, fmt.Sprintf("image-%d%s", i, extensionForMime(mime)), raw)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, key)
	}
	return resolved, nil
}

func mimeTypeFromDataURI(meta string) string {
	trimmed := strings.TrimPrefix(meta, "data:")
	if idx := strings.Index(trimmed, ";"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	return strings.TrimSpace(trimmed)
}

func extensionForMime(mime string) string {
	switch mime {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}

// truncateForLog bounds a diagnostic dump so a long reply cannot flood the logs.
func truncateForLog(text string, limit int) string {
	if len(text) <= limit {
		return text
	}
	return text[:limit] + "..."
}

// describeImageSchemes summarises image references for diagnostics without
// leaking image payloads into the logs.
func describeImageSchemes(images []string) string {
	if len(images) == 0 {
		return "none"
	}
	schemes := make([]string, 0, len(images))
	for _, image := range images {
		switch {
		case strings.HasPrefix(image, "data:"):
			schemes = append(schemes, "inline")
		case strings.HasPrefix(image, "http://"), strings.HasPrefix(image, "https://"):
			if host := hostOfURL(image); host != "" {
				schemes = append(schemes, "url:"+host)
				continue
			}
			schemes = append(schemes, "url")
		case image == "":
			schemes = append(schemes, "empty")
		default:
			schemes = append(schemes, "other")
		}
	}
	return strings.Join(schemes, ",")
}

func hostOfURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return parsed.Host
}

// The upstream validates request bodies strictly and names the offending
// parameter in every rejection it produces, in one of these shapes:
//
//	Unrecognized keys: "reasoning", "enable_thinking"
//	Omit temperature for this model.
//	Specify either max_tokens or max_completion_tokens, not both.
//
// Clients keep sending parameters the upstream has not adopted, and each
// rejection names only one of them, so the caller drops the named parameters
// and replays until the request is accepted.

// rejectedParams reads the parameters an upstream rejection complains about.
// It prefers the structured `param` field and falls back to the names quoted or
// named in the message.
func rejectedParams(resp *http.Response) []string {
	if resp == nil || resp.StatusCode != http.StatusBadRequest {
		return nil
	}
	message, param, ok := readUpstreamError(resp)
	if !ok {
		return nil
	}

	found := make(map[string]struct{})
	var names []string
	add := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		if _, seen := found[name]; seen {
			return
		}
		found[name] = struct{}{}
		names = append(names, name)
	}

	// "Unrecognized keys: \"reasoning\", \"thinking\"" and friends.
	for _, quoted := range extractQuotedNames(message) {
		add(quoted)
	}
	// "Omit temperature for this model."
	if after, ok := strings.CutPrefix(message, "Omit "); ok {
		if name, _, found := strings.Cut(after, " "); found {
			add(name)
		}
	}
	// "Specify either max_tokens or max_completion_tokens, not both."
	if param != "" && strings.Contains(message, "not both") {
		add(param)
	}
	return names
}

// dropNamedKeys removes the given parameters from the payload. A rejected name
// may live at the top level or inside a message — clients replay the reasoning
// we hand back as message.reasoning_content, and the upstream refuses to accept
// it as input — so both places are cleaned. It reports false when nothing was
// present, so the caller stops retrying instead of looping.
func dropNamedKeys(requestBody []byte, names []string) ([]byte, bool) {
	var payload map[string]any
	if err := common.Unmarshal(requestBody, &payload); err != nil {
		return nil, false
	}
	dropped := false
	for _, name := range names {
		if _, exists := payload[name]; exists {
			delete(payload, name)
			dropped = true
		}
	}
	if messages, ok := payload["messages"].([]any); ok {
		for _, entry := range messages {
			message, ok := entry.(map[string]any)
			if !ok {
				continue
			}
			for _, name := range names {
				if _, exists := message[name]; exists {
					delete(message, name)
					dropped = true
				}
			}
		}
	}
	if !dropped {
		return nil, false
	}
	stripped, err := common.Marshal(payload)
	if err != nil {
		return nil, false
	}
	return stripped, true
}

// readUpstreamError peeks at the response body, then restores it so a request
// that is not retried still reports the original upstream error.
func readUpstreamError(resp *http.Response) (message, param string, ok bool) {
	if resp.Body == nil {
		return "", "", false
	}
	preview, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", "", false
	}
	rest, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", false
	}
	resp.Body = io.NopCloser(io.MultiReader(bytes.NewReader(preview), bytes.NewReader(rest)))

	var upstream struct {
		Error struct {
			Message string `json:"message"`
			Param   string `json:"param"`
		} `json:"error"`
		Message string `json:"message"`
	}
	if err := common.Unmarshal(preview, &upstream); err != nil {
		return "", "", false
	}
	message = upstream.Error.Message
	if message == "" {
		message = upstream.Message
	}
	if message == "" {
		return "", "", false
	}
	return message, upstream.Error.Param, true
}

// extractQuotedNames pulls the double-quoted identifiers out of an error such
// as `Unrecognized keys: "reasoning", "enable_thinking"`. Splitting on the
// quote character leaves the identifiers at odd indices.
func extractQuotedNames(message string) []string {
	segments := strings.Split(message, `"`)
	var names []string
	for i := 1; i < len(segments); i += 2 {
		if name := strings.TrimSpace(segments[i]); name != "" {
			names = append(names, name)
		}
	}
	return names
}

func replaceResponseBody(resp *http.Response, body []byte, contentType string) {
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Type", contentType)
	resp.StatusCode = http.StatusOK
}
