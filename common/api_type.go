package common

import "github.com/QuantumNous/new-api/constant"

// ChannelType2APIType maps a channel type to the relay API type that serves it.
//
// This fork retains only a handful of adaptors (see relay.GetAdaptor). Channel
// types whose adaptor was removed intentionally have no case here: they fall
// through to the APITypeOpenAI default below, which keeps existing channels
// served by OpenAI-compatible upstreams working.
//
// The second return value reports whether the channel type has an explicit
// mapping. Callers that need to reject unknown input should check it.
func ChannelType2APIType(channelType int) (int, bool) {
	apiType := -1
	switch channelType {
	case constant.ChannelTypeOpenAI:
		apiType = constant.APITypeOpenAI
	case constant.ChannelTypeAnthropic:
		apiType = constant.APITypeAnthropic
	case constant.ChannelTypeGemini:
		apiType = constant.APITypeGemini
	case constant.ChannelTypeSiliconFlow:
		apiType = constant.APITypeSiliconFlow
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeVLLM, constant.ChannelTypeSGLang:
		apiType = constant.APITypeAdvancedCustom
	case constant.ChannelTypeSub2API:
		apiType = constant.APITypeSub2API
	case constant.ChannelTypeNewAPI:
		apiType = constant.APITypeNewAPI
	}
	if apiType == -1 {
		return constant.APITypeOpenAI, false
	}
	return apiType, true
}

func SupportsResponsesCompact(channelType, apiType int) bool {
	switch apiType {
	case constant.APITypeOpenAI,
		constant.APITypeAdvancedCustom,
		constant.APITypeSub2API,
		constant.APITypeNewAPI:
		return true
	default:
		return false
	}
}
