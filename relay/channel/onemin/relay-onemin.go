package onemin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/url"
	"regexp"
	"sort"
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

// staleImageMarker replaces a picture that belongs to an earlier turn. The
// transcript has to stay readable, but the image itself cannot be replayed:
// keeping it would force the whole conversation onto the native surface.
const staleImageMarker = "[用户此前发送了一张图片，现在无法再次查看其内容]"

// nativePlan is the outcome of deciding how a request should reach 1min.
type nativePlan struct {
	payload nativeChatRequest
	// hasImages reports whether the current turn carries pictures, which is
	// what sends the request to the native surface.
	hasImages bool
	// toolAware reports whether the request carries tools that the native
	// surface cannot express, so they were described in the prompt instead.
	toolAware bool
}

// buildNativePayload flattens an OpenAI chat request into the native feature
// payload.
//
// Only a picture carried by the newest message counts towards routing. Older
// ones become a marker, because a client replays the whole conversation on
// every request: if any earlier turn carried an image, treating it as current
// would pin the entire conversation to the native surface, where tools are
// unavailable and the folded transcript makes the model answer an old question.
// Reading only the newest message also keeps a tool-result turn — whose newest
// message is `tool`, not `user` — on the surface that understands it.
func buildNativePayload(request *dto.GeneralOpenAIRequest) nativePlan {
	var prompt strings.Builder
	var images []string
	current := len(request.Messages) - 1

	for i := range request.Messages {
		message := &request.Messages[i]
		contents := message.ParseContent()
		isCurrent := i == current
		var textParts []string
		for j := range contents {
			switch contents[j].Type {
			case dto.ContentTypeText:
				if contents[j].Text != "" {
					textParts = append(textParts, contents[j].Text)
				}
			case dto.ContentTypeImageURL:
				if image := contents[j].GetImageMedia(); image != nil && image.Url != "" {
					if isCurrent {
						images = append(images, image.Url)
					} else {
						textParts = append(textParts, staleImageMarker)
					}
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

	plan := nativePlan{payload: payload, hasImages: len(images) > 0}
	// The native surface has no tools field, so any request that may end up
	// here with tools gets them described in the prompt. That covers vision
	// requests, and also requests too large for the OpenAI-compatible surface
	// that get replayed on this one — those may carry no picture at all.
	if len(request.Tools) > 0 {
		payload.PromptObject.Prompt = toolScriptFor(request.Tools) + "\n" + payload.PromptObject.Prompt
		plan.payload = payload
		plan.toolAware = true
	}
	return plan
}

// toolScriptFor describes the tools in a form the native prompt can carry.
func toolScriptFor(tools []dto.ToolCallRequest) string {
	var script strings.Builder
	script.WriteString("You have access to the following tools:\n")
	described := 0
	for _, tool := range tools {
		name := strings.TrimSpace(tool.Function.Name)
		if name == "" {
			continue
		}
		described++
		description := strings.TrimSpace(tool.Function.Description)
		if description == "" {
			description = "no description provided"
		}
		script.WriteString("- ")
		script.WriteString(name)
		script.WriteString("(")
		script.WriteString(describeToolParameters(tool.Function.Parameters))
		script.WriteString("): ")
		script.WriteString(description)
		script.WriteString("\n")
	}
	if described == 0 {
		return ""
	}
	script.WriteString("\nIf you need to call one or more tools, reply with ONLY a JSON object")
	script.WriteString(" in this exact format and nothing else:\n")
	script.WriteString(`{"tool_calls":[{"name":"<tool name>","arguments":{<arguments as a JSON object>}}]}`)
	script.WriteString("\nIf no tool is needed, reply normally in plain text.\n")
	return script.String()
}

// describeToolParameters renders a JSON Schema parameter object as a compact
// signature such as `city: string, required`.
func describeToolParameters(params any) string {
	if params == nil {
		return ""
	}
	raw, err := common.Marshal(params)
	if err != nil {
		return ""
	}
	var schema struct {
		Properties map[string]any `json:"properties"`
		Required   []string       `json:"required"`
	}
	if err := common.Unmarshal(raw, &schema); err != nil {
		return ""
	}
	names := make([]string, 0, len(schema.Properties))
	for name := range schema.Properties {
		names = append(names, name)
	}
	sort.Strings(names)
	required := make(map[string]struct{}, len(schema.Required))
	for _, name := range schema.Required {
		required[name] = struct{}{}
	}
	parts := make([]string, 0, len(names))
	for _, name := range names {
		if _, needed := required[name]; needed {
			parts = append(parts, name+": required")
		} else {
			parts = append(parts, name)
		}
	}
	return strings.Join(parts, ", ")
}

// sanitizeMessagesForOpenAI strips image content out of a request that is
// staying on the OpenAI-compatible surface. That surface rejects multimodal
// content outright, so a transcript that once carried pictures needs them
// replaced before it can be replayed there.
func sanitizeMessagesForOpenAI(request *dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	messages := make([]dto.Message, len(request.Messages))
	copy(messages, request.Messages)
	changed := false
	for i := range messages {
		text, replaced := textWithImagesMarked(messages[i].ParseContent())
		if !replaced {
			continue
		}
		messages[i].Content = text
		changed = true
	}
	if !changed {
		return request
	}
	cleaned := *request
	cleaned.Messages = messages
	return &cleaned
}

// textWithImagesMarked renders a message's text with every picture replaced by
// the stale-image marker.
func textWithImagesMarked(contents []dto.MediaContent) (string, bool) {
	var parts []string
	replaced := false
	for i := range contents {
		switch contents[i].Type {
		case dto.ContentTypeText:
			if contents[i].Text != "" {
				parts = append(parts, contents[i].Text)
			}
		case dto.ContentTypeImageURL:
			if image := contents[i].GetImageMedia(); image != nil && image.Url != "" {
				parts = append(parts, staleImageMarker)
				replaced = true
			}
		}
	}
	return strings.Join(parts, "\n"), replaced
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

// nativeToolScript is the shape the model answers with when tools were
// described in the native prompt. The native surface has no tools field, so
// this is how a vision request can still ask for a tool.
type nativeToolScript struct {
	ToolCalls []struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	} `json:"tool_calls"`
}

// newToolCallID mints an id in the shape OpenAI clients expect.
func newToolCallID() string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
	var id strings.Builder
	id.WriteString("call_")
	for i := 0; i < 24; i++ {
		id.WriteByte(alphabet[rand.Intn(len(alphabet))])
	}
	return id.String()
}

// parseToolScript reads a tool-call script out of a reply. It reports false
// when the reply is ordinary prose, so a model that ignores the instructions
// simply falls back to a normal answer instead of failing the request.
func parseToolScript(text string) ([]dto.ToolCallResponse, bool) {
	trimmed := stripCodeFence(strings.TrimSpace(text))
	if trimmed == "" || !strings.Contains(trimmed, "tool_calls") {
		return nil, false
	}
	// The model often appends a remark after the script ("... in JSON
	// format."), so the object is lifted out of the reply instead of
	// demanding that the whole reply be JSON.
	candidate, ok := extractJSONObject(trimmed)
	if !ok {
		return nil, false
	}
	var script nativeToolScript
	if err := common.Unmarshal([]byte(candidate), &script); err != nil {
		return nil, false
	}
	if len(script.ToolCalls) == 0 {
		return nil, false
	}
	calls := make([]dto.ToolCallResponse, 0, len(script.ToolCalls))
	for i, entry := range script.ToolCalls {
		name := strings.TrimSpace(entry.Name)
		if name == "" {
			return nil, false
		}
		arguments := strings.TrimSpace(string(entry.Arguments))
		if arguments == "" {
			arguments = "{}"
		}
		call := dto.ToolCallResponse{ID: newToolCallID(), Type: "function"}
		call.SetIndex(i)
		call.Function = dto.FunctionResponse{Name: name, Arguments: arguments}
		calls = append(calls, call)
	}
	return calls, true
}

// stripCodeFence removes a markdown fence the model may wrap the JSON in.
func stripCodeFence(text string) string {
	if !strings.HasPrefix(text, "```") {
		return text
	}
	trimmed := strings.TrimPrefix(text, "```")
	trimmed = strings.TrimPrefix(strings.TrimSpace(trimmed), "json")
	trimmed = strings.TrimSpace(trimmed)
	if end := strings.Index(trimmed, "```"); end >= 0 {
		trimmed = trimmed[:end]
	}
	return strings.TrimSpace(trimmed)
}

// extractJSONObject returns the first complete {...} block of a reply, so a
// script that carries an extra remark before or after it is still readable.
// Strings and escapes are tracked so braces inside values do not end the block.
func extractJSONObject(text string) (string, bool) {
	start := strings.Index(text, "{")
	if start < 0 {
		return "", false
	}
	depth := 0
	inString := false
	escaped := false
	for i := start; i < len(text); i++ {
		switch c := text[i]; {
		case escaped:
			escaped = false
		case c == '\\' && inString:
			escaped = true
		case c == '"':
			inString = !inString
		case inString:
			// Braces inside a string are content, not structure.
		case c == '{':
			depth++
		case c == '}':
			depth--
			if depth == 0 {
				return text[start : i+1], true
			}
		}
	}
	return "", false
}

// toolScriptStart reports whether a reply is opening a tool-call script rather
// than prose, which is what decides how a streamed reply is handled.
func toolScriptStart(text string) bool {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "```") {
		return true
	}
	// A short preamble before the script ("Sure: ") still counts. A reply that
	// only mentions tool_calls in prose is recognised as text later, when the
	// script fails to parse.
	return strings.Contains(trimmed, "tool_calls")
}

// toolSniffLookahead is how much of a reply is read before deciding whether it
// is prose. A script announces itself in its first character, so this only has
// to be long enough not to mistake a short answer for one.
const toolSniffLookahead = 64

const (
	splitterUndecided = iota
	splitterText
	splitterTool
)

// replySplitter decides whether a reply to a prompt that carried tool
// descriptions is a tool-call script or ordinary prose. A script has to be read
// in full before it can be parsed, so it is withheld until the reply ends;
// prose is released as soon as it is recognised, keeping the stream live.
type replySplitter struct {
	pending strings.Builder
	mode    int
}

func (s *replySplitter) feed(chunk string) string {
	if s.mode == splitterText {
		return chunk
	}
	s.pending.WriteString(chunk)
	if s.mode == splitterTool {
		return ""
	}
	head := strings.TrimSpace(s.pending.String())
	if toolScriptStart(head) {
		s.mode = splitterTool
		return ""
	}
	if len(head) >= toolSniffLookahead {
		s.mode = splitterText
		return s.release()
	}
	return ""
}

// finish returns what is still withheld and whether to read it as a script.
func (s *replySplitter) finish() (string, bool) {
	if s.mode == splitterTool {
		return s.pending.String(), true
	}
	return s.release(), false
}

func (s *replySplitter) release() string {
	text := s.pending.String()
	s.pending.Reset()
	s.mode = splitterText
	return text
}

// nativeToOpenAIResponse converts the native envelope into an OpenAI chat
// completion so the shared OpenAI response handling (billing, format
// conversion, rendering) can be reused verbatim.
func nativeToOpenAIResponse(body []byte, model string, toolAware bool) (*dto.OpenAITextResponse, *nativeError) {
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
	content = stripCrawlingReply(content)
	message := dto.Message{Role: "assistant"}
	finishReason := "stop"
	// When tools were described in the prompt, a reply that opens as JSON is a
	// tool request rather than an answer.
	if toolAware {
		if calls, ok := parseToolScript(content); ok {
			if encoded, err := common.Marshal(calls); err == nil {
				message.ToolCalls = encoded
				finishReason = "tool_calls"
				content = ""
			}
		}
	}
	message.Content = content

	response := &dto.OpenAITextResponse{
		Id:      "chatcmpl-" + record.Uuid,
		Model:   responseModel,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: []dto.OpenAITextResponseChoice{{
			Index:        0,
			Message:      message,
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
func nativeStreamToOpenAI(body io.Reader, model string, toolAware bool, onComplete func(transcript, events string)) io.Reader {
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
		splitter := &replySplitter{}

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

		sendText := func(text string) error {
			content := text
			delta := dto.ChatCompletionsStreamResponseChoiceDelta{Content: &content}
			if !sentRole {
				delta.Role = "assistant"
				sentRole = true
			}
			return writeChunk(delta, nil)
		}

		// The native surface cannot express tool calls, so a tool request built
		// from the prompt arrives as one script and is emitted as a single chunk
		// that already carries the finish reason.
		sendToolCalls := func(calls []dto.ToolCallResponse) error {
			delta := dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: calls}
			if !sentRole {
				delta.Role = "assistant"
				sentRole = true
			}
			finish := "tool_calls"
			return writeChunk(delta, &finish)
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
			if toolAware {
				// A tool script only makes sense once it is complete, so it is
				// held back; prose is released as soon as it is recognised.
				sanitized = splitter.feed(sanitized)
				if sanitized == "" {
					continue
				}
			}
			if onComplete != nil {
				rawEvents.WriteString(fmt.Sprintf("[%s]%s | ", eventName, truncateForLog(sanitized, 120)))
				transcript.WriteString(sanitized)
			}
			if err := sendText(sanitized); err != nil {
				pw.CloseWithError(err)
				return
			}
		}

		if err := scanner.Err(); err != nil {
			pw.CloseWithError(err)
			return
		}

		// Whatever the stripper withheld still belongs to the reply, and it has
		// to go through the splitter too, since the opening is what decides
		// whether this was a tool request.
		tail := stripper.flush()
		emittedToolCalls := false
		if toolAware {
			if emit := splitter.feed(tail); emit != "" {
				if err := sendText(emit); err != nil {
					pw.CloseWithError(err)
					return
				}
			}
			text, isScript := splitter.finish()
			if isScript {
				if calls, ok := parseToolScript(text); ok {
					if err := sendToolCalls(calls); err != nil {
						pw.CloseWithError(err)
						return
					}
					emittedToolCalls = true
				} else if text != "" {
					// Not a usable script after all; fall back to plain text.
					if err := sendText(text); err != nil {
						pw.CloseWithError(err)
						return
					}
				}
			} else if text != "" {
				if err := sendText(text); err != nil {
					pw.CloseWithError(err)
					return
				}
			}
		} else if tail != "" {
			if err := sendText(tail); err != nil {
				pw.CloseWithError(err)
				return
			}
		}

		if !emittedToolCalls {
			stop := "stop"
			finalDelta := dto.ChatCompletionsStreamResponseChoiceDelta{}
			if !sentRole {
				finalDelta.Role = "assistant"
			}
			if err := writeChunk(finalDelta, &stop); err != nil {
				pw.CloseWithError(err)
				return
			}
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
