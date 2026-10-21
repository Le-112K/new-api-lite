package types

type RelayFormat string

const (
	RelayFormatOpenAI                    RelayFormat = "openai"
	RelayFormatClaude                                = "claude"
	RelayFormatGemini                                = "gemini"
	RelayFormatOpenAIResponses                       = "openai_responses"
	RelayFormatOpenAIResponsesCompaction             = "openai_responses_compaction"
	RelayFormatOpenAIAlphaSearch                     = "openai_alpha_search"
	RelayFormatOpenAIImage                           = "openai_image"

	RelayFormatTask    = "task"
	RelayFormatMjProxy = "mj_proxy"
)
