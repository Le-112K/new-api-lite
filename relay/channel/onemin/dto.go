package onemin

// 1min exposes two distinct surfaces under one API root:
//   - OpenAI-compatible endpoints under /openai/v1, text only
//   - the native feature API under /api, which is the only one that accepts images
//
// Paths are absolute against the documented base URL (https://api.1min.ai), so
// the channel base URL stays the canonical API root and both surfaces resolve.
const (
	nativeChatPath   = "/api/chat-with-ai"
	openAIChatPath   = "/openai/v1/chat/completions"
	nativeFeatureTag = "CHAT_WITH_AI"

	// ModelListPath is the OpenAI-compatible model catalogue.
	ModelListPath = "/openai/v1/models"
)

// nativeChatRequest is the payload for POST /api/chat-with-ai.
type nativeChatRequest struct {
	Type         string               `json:"type"`
	Model        string               `json:"model"`
	PromptObject nativePromptObject   `json:"promptObject"`
}

type nativePromptObject struct {
	Prompt      string           `json:"prompt"`
	Attachments *nativeAttachments `json:"attachments,omitempty"`
}

// nativeAttachments carries images. The older imageList field is still accepted
// by the API and echoed back, but the model never receives those images; only
// attachments.images reaches the model.
type nativeAttachments struct {
	Images []string `json:"images"`
}

// nativeChatResponse is the envelope returned by the native endpoint. The
// answer lives in AiRecord.AiRecordDetail.ResultObject[0].
type nativeChatResponse struct {
	AiRecord nativeAiRecord `json:"aiRecord"`
}

type nativeAiRecord struct {
	Uuid           string             `json:"uuid"`
	Model          string             `json:"model"`
	Type           string             `json:"type"`
	Status         string             `json:"status"`
	AiRecordDetail nativeRecordDetail `json:"aiRecordDetail"`
}

type nativeRecordDetail struct {
	ResultObject []string `json:"resultObject"`
}

// nativeStreamEvent is one SSE "data:" payload from ?isStreaming=true.
// Content deltas arrive as {"content":"..."}; the terminal event carries the
// full aiRecord.
type nativeStreamEvent struct {
	Content  string              `json:"content"`
	AiRecord *nativeAiRecord     `json:"aiRecord"`
}

// openAIError is the error shape both 1min surfaces return.
type nativeError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

func (e *nativeError) text() string {
	if e.Error.Message != "" {
		return e.Error.Message
	}
	if e.Message != "" {
		return e.Message
	}
	if e.ErrorCode != "" {
		return e.ErrorCode
	}
	return ""
}
