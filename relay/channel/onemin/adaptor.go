package onemin

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// Adaptor serves 1min, which offers two surfaces with different capabilities.
//
// Text-only requests stay on the OpenAI-compatible /openai/v1 surface, which
// keeps tools and structured output intact and needs no translation at all.
// Requests carrying images must use the native /api/chat-with-ai surface: the
// OpenAI-compatible one rejects multimodal content outright, and on the native
// surface images are only delivered through promptObject.attachments.images
// (the imageList field is accepted and echoed back but never reaches the model).
//
// useNative is decided while converting the request and read again when the
// URL and headers are built, so a request never mixes the two surfaces.
type Adaptor struct {
	openaiAdaptor openai.Adaptor
	useNative     bool
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base := strings.TrimSuffix(info.ChannelBaseUrl, "/")
	if a.useNative {
		url := relaycommon.GetFullRequestURL(base, nativeChatPath, info.ChannelType)
		if info.IsStream {
			url += "?isStreaming=true"
		}
		return url, nil
	}
	return relaycommon.GetFullRequestURL(base, openAIChatPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	if a.useNative {
		// The native surface authenticates with API-KEY, not Bearer.
		req.Set("API-KEY", info.ApiKey)
		return nil
	}
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	payload, hasImages := buildNativePayload(request)
	if !hasImages {
		return request, nil
	}

	logger.LogDebug(c, "1min: routing to native surface, images=%d schemes=%s",
		len(payload.PromptObject.Attachments.Images), describeImageSchemes(payload.PromptObject.Attachments.Images))

	// Pasted images arrive as base64 data URIs, which the upstream cannot fetch.
	// Upload them first so the model actually receives the picture.
	resolved, err := resolveInlineImages(
		c.Request.Context(),
		strings.TrimSuffix(info.ChannelBaseUrl, "/"),
		info.ApiKey,
		payload.PromptObject.Attachments.Images,
	)
	if err != nil {
		return nil, fmt.Errorf("prepare image attachments: %w", err)
	}
	payload.PromptObject.Attachments.Images = resolved

	a.useNative = true
	return payload, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("1min channel does not support the responses API")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("1min channel does not support embeddings")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("1min channel does not support the Claude messages API")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("1min channel does not support the Gemini generateContent API")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("1min channel does not support image generation")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("1min channel does not support rerank")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("1min channel does not support audio")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	body, readErr := io.ReadAll(requestBody)
	if readErr != nil {
		// Fall back to streaming the original reader; the retry shim needs a
		// buffered payload, but a read failure here should not change behaviour.
		return channel.DoApiRequest(a, c, info, requestBody)
	}

	resp, err := channel.DoApiRequest(a, c, info, bytes.NewReader(body))
	if err != nil || resp == nil {
		return resp, err
	}
	if a.useNative {
		return resp, nil
	}

	// The OpenAI-compatible surface reports one problem per response, and fixing
	// it usually reveals the next one — a request carrying both a rejected
	// parameter and a tool call that needs reasoning_effort takes two rounds.
	// Each round therefore re-decides which correction applies instead of
	// running the two rules once in a fixed order.
	payload := body
	for range maxRequestCorrections {
		corrected, reason, ok := correctRequest(resp, payload)
		if !ok {
			break
		}
		next, retryErr := channel.DoApiRequest(a, c, info, bytes.NewReader(corrected))
		if retryErr != nil || next == nil {
			break
		}
		logger.LogDebug(c, "1min: %s", reason)
		service.CloseResponseBodyGracefully(resp)
		resp = next
		payload = corrected
	}
	return resp, nil
}

// correctRequest applies whichever correction the upstream error calls for and
// returns the payload to replay.
func correctRequest(resp *http.Response, payload []byte) (corrected []byte, reason string, ok bool) {
	// Some reasoning models reject tool calling unless reasoning_effort is
	// explicitly "none"; others reject the field outright. Which is which cannot
	// be told from the request, so this follows the error.
	if detectReasoningEffortShim(resp, payload) {
		if retried, applied := withReasoningEffortNone(payload); applied {
			return retried, "retried with reasoning_effort=none for tool calling", true
		}
	}

	// The surface also rejects the whole request over any parameter it does not
	// accept, naming the offender.
	names := rejectedParams(resp)
	if len(names) == 0 {
		return nil, "", false
	}
	retried, applied := dropNamedKeys(payload, names)
	if !applied {
		return nil, "", false
	}
	return retried, fmt.Sprintf("dropped parameters the upstream rejects: %v", names), true
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if !a.useNative {
		return a.openaiAdaptor.DoResponse(c, resp, info)
	}
	if info.IsStream {
		return a.doNativeStreamResponse(c, resp, info)
	}
	return a.doNativeResponse(c, resp, info)
}

func (a *Adaptor) doNativeResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	if resp.StatusCode != http.StatusOK {
		var upstream nativeError
		if common.Unmarshal(body, &upstream) == nil {
			if msg := upstream.text(); msg != "" {
				return nil, types.NewOpenAIError(fmt.Errorf("1min: %s", msg), types.ErrorCodeBadResponse, resp.StatusCode)
			}
		}
		return nil, types.NewOpenAIError(fmt.Errorf("1min returned status %d", resp.StatusCode), types.ErrorCodeBadResponse, resp.StatusCode)
	}

	converted, nativeErr := nativeToOpenAIResponse(body, info.UpstreamModelName)
	if nativeErr != nil {
		return nil, types.NewOpenAIError(fmt.Errorf("1min: %s", nativeErr.text()), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	encoded, marshalErr := common.Marshal(converted)
	if marshalErr != nil {
		return nil, types.NewOpenAIError(marshalErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	replaceResponseBody(resp, encoded, "application/json")
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) doNativeStreamResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp.StatusCode != http.StatusOK {
		return a.doNativeResponse(c, resp, info)
	}
	resp.Body = io.NopCloser(nativeStreamToOpenAI(resp.Body, info.UpstreamModelName))
	resp.Header.Set("Content-Type", "text/event-stream")
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
