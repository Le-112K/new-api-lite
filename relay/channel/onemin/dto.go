package onemin

import (
	"time"

	"github.com/QuantumNous/new-api/common"
)

// assetUploadTimeout bounds a single image upload to the asset API.
const assetUploadTimeout = 60 * time.Second

// payloadTooLargeMarker is how the OpenAI-compatible surface reports that the
// request as a whole — messages, tools and response format together — is over
// its 100,000 character budget. Nothing inside the request can fix that, so the
// request is replayed on the native surface, which has no such budget.
const payloadTooLargeMarker = "exceed the 100,000 character limit"

// stringTooLargeMarker is how the surface reports a single field — one message,
// most often — going over the 100,000 character ceiling. Nothing can be trimmed
// without losing what the client sent, so the request is replayed on the native
// surface, which has no per-field ceiling.
const stringTooLargeMarker = "expected string to have <=100000"

// numberTooLargeMarker precedes the cap in rejections such as
// `Too big: expected number to be <=32768`. Clients routinely ask for far more
// output tokens than 1min allows — ZCode asks for 128000. Dropping the field
// would leave the upstream to pick a much smaller default and truncate the
// answer, so the value is clamped to the ceiling instead.
const numberTooLargeMarker = "expected number to be <="

// maxRequestCorrections bounds how many times a rejected request is corrected
// and replayed. The upstream reports one problem per response, so a client that
// trips several checks needs one round each; the cap keeps a pathological
// request from retrying without limit.
const maxRequestCorrections = 8

// 1min exposes two distinct surfaces under one API root:
//   - OpenAI-compatible endpoints under /openai/v1, text only
//   - the native feature API under /api, which is the only one that accepts images
//
// Paths are absolute against the documented base URL (https://api.1min.ai), so
// the channel base URL stays the canonical API root and both surfaces resolve.
const (
	nativeChatPath   = "/api/chat-with-ai"
	nativeAssetPath  = "/api/assets"
	openAIChatPath   = "/openai/v1/chat/completions"
	nativeFeatureTag = "CHAT_WITH_AI"

	// ModelListPath is the OpenAI-compatible model catalogue.
	ModelListPath = "/openai/v1/models"
)

// nativeChatRequest is the payload for POST /api/chat-with-ai.
type nativeChatRequest struct {
	Type         string             `json:"type"`
	Model        string             `json:"model"`
	PromptObject nativePromptObject `json:"promptObject"`
}

type nativePromptObject struct {
	Prompt      string             `json:"prompt"`
	Attachments *nativeAttachments `json:"attachments,omitempty"`
}

// nativeAttachments carries images. The older imageList field is still accepted
// by the API and echoed back, but the model never receives those images; only
// attachments.images reaches the model.
type nativeAttachments struct {
	Images []string `json:"images"`
}

type nativeAiRecord struct {
	Uuid           string             `json:"uuid"`
	Model          string             `json:"model"`
	Type           string             `json:"type"`
	Status         string             `json:"status"`
	AiRecordDetail nativeRecordDetail `json:"aiRecordDetail"`
}

type nativeRecordDetail struct {
	ResultObject nativeResultObject `json:"resultObject"`
}

// nativeResultObject is normally the answer as a string array, but upstream
// swaps in an object when a generation fails (for example when an image cannot
// be fetched). Decoding tolerantly keeps the failure readable instead of
// surfacing a JSON type error.
type nativeResultObject []string

func (r *nativeResultObject) UnmarshalJSON(data []byte) error {
	var list []string
	if err := common.Unmarshal(data, &list); err == nil {
		*r = list
		return nil
	}
	var single string
	if err := common.Unmarshal(data, &single); err == nil {
		*r = []string{single}
		return nil
	}
	var detail struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	}
	if err := common.Unmarshal(data, &detail); err == nil {
		switch {
		case detail.Message != "":
			*r = []string{detail.Message}
		case detail.Code != "":
			*r = []string{detail.Code}
		default:
			*r = nil
		}
		return nil
	}
	*r = nil
	return nil
}

// nativeStreamEvent is one SSE "data:" payload from ?isStreaming=true.
// Content deltas arrive as {"content":"..."}; the terminal event carries the
// full aiRecord.
type nativeStreamEvent struct {
	Content  string          `json:"content"`
	AiRecord *nativeAiRecord `json:"aiRecord"`
}

// nativeError is the error shape both 1min surfaces return.
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
