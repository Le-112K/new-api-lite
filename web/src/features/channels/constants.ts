/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// ============================================================================
// Channel Types (from constant/channel.go)
// All label/name values are i18n keys; use t(value) when displaying.
// ============================================================================

export const CHANNEL_TYPE_OLLAMA = 4

export const CHANNEL_TYPE_SUB2API = 59

export const CHANNEL_TYPE_NEW_API = 60

export const CHANNEL_TYPE_TASK_PLUGIN = 61

export const CHANNEL_TYPE_VLLM = 62

export const CHANNEL_TYPE_SGLANG = 63

/**
 * 二开保留的渠道类型：本 fork 只对接第三方中转站、少数官方厂商与自建网关。
 *
 * 其余类型依然保留数字常量与显示标签（存量渠道数据仍需要它们渲染名称），
 * 但不再出现在渠道类型下拉里；后端 validateChannel 会拒绝新建这些类型。
 */
export const RETAINED_CHANNEL_TYPES = [1, 14, 24, 40, 58, 59, 60] as const

/**
 * 二开精简中移除的渠道类型：后端不再有对应的 relay 适配器。
 * 数字常量保留（枚举位移会破坏存量渠道数据），但不再出现在渠道类型下拉里。
 */
export const REMOVED_CHANNEL_TYPES: ReadonlySet<number> = new Set([
  2, // MjProxy
  3, // Azure
  4, // Ollama
  5, // MjProxyPlus
  7, // OhMyGPT
  8, // Custom
  15, // Baidu
  16, // Zhipu
  17, // Ali
  18, // Xunfei
  19, // 360
  20, // OpenRouter
  22, // FastGPT
  23, // Tencent
  25, // Moonshot
  26, // Zhipu GLM
  27, // Perplexity
  31, // LingYiWanWu
  33, // AWS
  34, // Cohere
  35, // MiniMax
  36, // SunoAPI
  37, // Dify
  38, // Jina
  39, // Cloudflare
  41, // Vertex AI
  42, // Mistral
  43, // DeepSeek
  44, // MokaAI
  45, // VolcEngine
  46, // Baidu V2
  47, // Xinference
  48, // xAI
  49, // Coze
  50, // Kling
  51, // Jimeng
  52, // Vidu
  53, // Submodel
  54, // Doubao Video
  55, // Sora
  56, // Replicate
  57, // ChatGPT Subscription (Codex)
  61, // Task Plugin
  62, // vLLM
  63, // SGLang
])

export const CHANNEL_TYPES = {
  0: 'Unknown',
  1: 'OpenAI',
  2: 'MjProxy',
  3: 'Azure',
  4: 'Ollama',
  5: 'MjProxyPlus',
  // 6: 'OpenAIMax',
  7: 'OhMyGPT',
  8: 'Custom',
  // 9: 'AILS',
  // 10: 'AI Proxy',
  // 11: 'PaLM',
  // 12: 'API2GPT',
  // 13: 'AIGC2D',
  14: 'Anthropic',
  15: 'Baidu',
  16: 'Zhipu',
  17: 'Ali',
  18: 'Xunfei',
  19: '360',
  20: 'OpenRouter',
  // 21: 'AI Proxy Library',
  22: 'FastGPT',
  23: 'Tencent',
  24: 'Gemini',
  25: 'Moonshot',
  26: 'Zhipu GLM',
  27: 'Perplexity',
  31: 'LingYiWanWu',
  33: 'AWS',
  34: 'Cohere',
  35: 'MiniMax',
  36: 'SunoAPI',
  37: 'Dify',
  38: 'Jina',
  39: 'Cloudflare',
  40: 'SiliconFlow',
  41: 'Vertex AI',
  42: 'Mistral',
  43: 'DeepSeek',
  44: 'MokaAI',
  45: 'VolcEngine',
  46: 'Baidu V2',
  47: 'Xinference',
  48: 'xAI',
  49: 'Coze',
  50: 'Kling',
  51: 'Jimeng',
  52: 'Vidu',
  53: 'Submodel',
  54: 'Doubao',
  55: 'Sora',
  56: 'Replicate',
  57: 'ChatGPT Subscription (Codex)',
  58: 'Advanced Custom',
  59: 'Sub2API',
  60: 'New API',
  61: 'Task Plugin',
  62: 'vLLM',
  63: 'SGLang',
} as const

export type ChannelProviderPresentation = {
  descriptionKey: string
  detailKey?: string
  badge?: { labelKey: string; tone: 'warning' | 'primary' }
}

// Display copy only; channel routing, availability and ordering remain independent.
// Every retained channel type must carry presentation copy; the exported map stays
// loosely typed so consumers can look up by a runtime channel type.
const RETAINED_CHANNEL_PRESENTATION: Record<
  (typeof RETAINED_CHANNEL_TYPES)[number],
  ChannelProviderPresentation
> = {
  1: { descriptionKey: 'Connect to the OpenAI API or compatible services' },
  14: { descriptionKey: 'Connect to the Anthropic API or compatible services' },
  24: { descriptionKey: 'Connect to models through the Google Gemini API' },
  40: { descriptionKey: 'Connect to SiliconFlow model inference services' },
  58: {
    descriptionKey:
      'Configure endpoint routing, authentication and protocol conversion for different upstream services',
    detailKey:
      "New API's flexible channel lets you configure upstream addresses and authentication per endpoint, choose native forwarding or supported protocol conversions, and configure model listing and balance queries independently",
    badge: { labelKey: 'Flexible integration', tone: 'primary' },
  },
  59: { descriptionKey: 'Connect to model services through a Sub2API gateway' },
  60: {
    descriptionKey:
      'Connect to New API model services with support for multiple task plugins',
  },
}

export const CHANNEL_PROVIDER_PRESENTATION: Partial<
  Record<number, ChannelProviderPresentation>
> = RETAINED_CHANNEL_PRESENTATION

const CHANNEL_TYPE_DISPLAY_ORDER: number[] = [1, 14, 24, 40, 58, 59, 60]

export const CHANNEL_TYPE_OPTIONS: { value: number; label: string }[] = (() => {
  const ordered: { value: number; label: string }[] = []
  const seen = new Set<number>()
  for (const id of CHANNEL_TYPE_DISPLAY_ORDER) {
    if (REMOVED_CHANNEL_TYPES.has(id)) continue
    const label = CHANNEL_TYPES[id as keyof typeof CHANNEL_TYPES]
    if (label) {
      ordered.push({ value: id, label })
      seen.add(id)
    }
  }
  for (const [key, label] of Object.entries(CHANNEL_TYPES)) {
    const id = Number(key)
    if (id !== 0 && !seen.has(id) && !REMOVED_CHANNEL_TYPES.has(id)) {
      ordered.push({ value: id, label })
    }
  }
  return ordered
})()

// ============================================================================
// Channel Status (label values are i18n keys; use t(config.label) in components)
// ============================================================================

export const CHANNEL_STATUS = {
  UNKNOWN: 0,
  ENABLED: 1,
  MANUAL_DISABLED: 2,
  AUTO_DISABLED: 3,
} as const

export const CHANNEL_STATUS_LABELS = {
  [CHANNEL_STATUS.UNKNOWN]: 'Unknown',
  [CHANNEL_STATUS.ENABLED]: 'Enabled',
  [CHANNEL_STATUS.MANUAL_DISABLED]: 'Disabled',
  [CHANNEL_STATUS.AUTO_DISABLED]: 'Auto Disabled',
} as const

export const CHANNEL_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
] as const

export const CHANNEL_STATUS_CONFIG = {
  [CHANNEL_STATUS.UNKNOWN]: {
    variant: 'neutral' as const,
    label: 'Unknown',
  },
  [CHANNEL_STATUS.ENABLED]: {
    variant: 'success' as const,
    label: 'Enabled',
  },
  [CHANNEL_STATUS.MANUAL_DISABLED]: {
    variant: 'danger' as const,
    label: 'Disabled',
  },
  [CHANNEL_STATUS.AUTO_DISABLED]: {
    variant: 'warning' as const,
    label: 'Auto Disabled',
  },
}

// ============================================================================
// Multi-Key Status
// ============================================================================

export const MULTI_KEY_STATUS = {
  ENABLED: 1,
  MANUAL_DISABLED: 2,
  AUTO_DISABLED: 3,
} as const

export const MULTI_KEY_STATUS_LABELS = {
  [MULTI_KEY_STATUS.ENABLED]: 'Enabled',
  [MULTI_KEY_STATUS.MANUAL_DISABLED]: 'Manual Disabled',
  [MULTI_KEY_STATUS.AUTO_DISABLED]: 'Auto Disabled',
} as const

export const MULTI_KEY_STATUS_CONFIG = {
  [MULTI_KEY_STATUS.ENABLED]: {
    variant: 'success' as const,
    label: 'Enabled',
  },
  [MULTI_KEY_STATUS.MANUAL_DISABLED]: {
    variant: 'neutral' as const,
    label: 'Manual Disabled',
  },
  [MULTI_KEY_STATUS.AUTO_DISABLED]: {
    variant: 'danger' as const,
    label: 'Auto Disabled',
  },
}

// ============================================================================
// Multi-Key Modes
// ============================================================================

export const MULTI_KEY_MODES = [
  { value: 'random', label: 'Random' },
  { value: 'polling', label: 'Polling' },
] as const

export const ADD_MODE_OPTIONS = [
  { value: 'single', label: 'Single Key' },
  { value: 'batch', label: 'Batch Add (one key per line)' },
  {
    value: 'multi_to_single',
    label: 'Multi-Key Mode (multiple keys, one channel)',
  },
] as const

// ============================================================================
// Multi-Key Management
// ============================================================================

export const MULTI_KEY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: '1', label: 'Enabled' },
  { value: '2', label: 'Manual Disabled' },
  { value: '3', label: 'Auto Disabled' },
] as const

export const MULTI_KEY_CONFIRM_MESSAGES = {
  DELETE:
    'Are you sure you want to delete this key? This action cannot be undone.',
  ENABLE: 'Enable this key?',
  DISABLE: 'Disable this key?',
  ENABLE_ALL: 'Are you sure you want to enable all keys?',
  DISABLE_ALL: 'Are you sure you want to disable all enabled keys?',
  DELETE_DISABLED:
    'Are you sure you want to delete all auto-disabled keys? This action cannot be undone.',
} as const

// ============================================================================
// Auto Ban Options
// ============================================================================

export const AUTO_BAN_OPTIONS = [
  { value: 1, label: 'Enabled' },
  { value: 0, label: 'Disabled' },
] as const

// ============================================================================
// Error / Success Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  REQUIRED_NAME: 'Channel name is required',
  REQUIRED_TYPE: 'Channel type is required',
  REQUIRED_KEY: 'API key is required',
  REQUIRED_MODELS: 'Models are required',
  REQUIRED_GROUP: 'Group is required',
  INVALID_JSON: 'Invalid JSON format',
  INVALID_MODEL_MAPPING: 'Invalid model mapping format',
  INVALID_PROXY:
    'Proxy address must use HTTP, HTTPS, SOCKS5, or SOCKS5H and include a valid host',
  INVALID_HTTP_PROTOCOL: 'HTTP protocol must be Auto or HTTP/1.1',
  INVALID_HTTP2_CONNECTION_SHARDS:
    'HTTP/2 connection shards must be between 1 and 8',
  INVALID_HTTP1_WITH_SHARDS:
    'HTTP/2 connection shards must be 1 when HTTP/1.1 is selected',
  CREATE_FAILED: 'Failed to create channel',
  UPDATE_FAILED: 'Failed to update channel',
  DELETE_FAILED: 'Failed to delete channel',
  TEST_FAILED: 'Failed to test channel',
  BALANCE_QUERY_FAILED: 'Failed to query balance',
  FETCH_MODELS_FAILED: 'Failed to fetch models',
} as const

export const SUCCESS_MESSAGES = {
  CREATED: 'Channel created successfully',
  UPDATED: 'Channel updated successfully',
  DELETED: 'Channel deleted successfully',
  ENABLED: 'Channel enabled successfully',
  DISABLED: 'Channel disabled successfully',
  TESTED: 'Channel test completed',
  BALANCE_QUERIED: 'Balance queried successfully',
  MODELS_FETCHED: 'Models fetched successfully',
  COPIED: 'Channel copied successfully',
  TAG_SET: 'Tag set successfully',
  BATCH_DELETED: 'Channels deleted successfully',
} as const

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20

export const DEFAULT_CHANNEL_VALUES = {
  name: '',
  type: 0,
  base_url: '',
  key: '',
  models: '',
  group: 'default',
  status: CHANNEL_STATUS.ENABLED,
  priority: 0,
  weight: 0,
  auto_ban: 1,
  remark: '',
} as const

// ============================================================================
// Table Configuration
// ============================================================================

export const CHANNELS_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ============================================================================
// Sort Options (label values are i18n keys)
// ============================================================================

export const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority (Default)' },
  { value: 'id', label: 'ID' },
  { value: 'name', label: 'Name' },
  { value: 'balance', label: 'Balance' },
  { value: 'response_time', label: 'Response Time' },
] as const

// ============================================================================
// Balance Display
// ============================================================================

export const BALANCE_THRESHOLDS = {
  LOW: 1,
  MEDIUM: 10,
  HIGH: 100,
} as const

// ============================================================================
// Response Time Thresholds (in ms)
// ============================================================================

export const RESPONSE_TIME_THRESHOLDS = {
  EXCELLENT: 500,
  GOOD: 1000,
  FAIR: 2000,
  POOR: 5000,
} as const

export const RESPONSE_TIME_CONFIG = {
  EXCELLENT: { variant: 'success' as const, label: 'Excellent' },
  GOOD: { variant: 'success' as const, label: 'Good' },
  FAIR: { variant: 'warning' as const, label: 'Fair' },
  POOR: { variant: 'danger' as const, label: 'Poor' },
  UNKNOWN: { variant: 'neutral' as const, label: 'Not tested' },
} as const

// ============================================================================
// Field Hints and Placeholders (i18n keys; use t() when displaying)
// ============================================================================

export const FIELD_PLACEHOLDERS = {
  NAME: 'e.g., OpenAI GPT-4 Production',
  BASE_URL: 'Leave empty to use default',
  KEY: 'API Key (one per line for batch mode)',
  MODELS: 'Comma-separated model names, e.g., gpt-4,gpt-3.5-turbo',
  GROUP: 'Please Select user groups that can access this channel.',
  MODEL_MAPPING: '{"request_model": "actual_model"}',
  TEST_MODEL: 'Model to use for testing',
  TAG: 'Optional tag for grouping channels',
  REMARK: 'Optional notes about this channel',
  PARAM_OVERRIDE: '{"temperature": 0.7}',
  HEADER_OVERRIDE: '{"X-Custom-Header": "value"}',
  STATUS_CODE_MAPPING: '{"400": "500"}',
} as const

export const FIELD_DESCRIPTIONS = {
  NAME: 'Friendly name to identify this channel',
  TYPE: 'Provider type (OpenAI, Anthropic, etc.)',
  BASE_URL: 'Custom API base URL. Leave empty to use provider default.',
  KEY: 'API key from the provider',
  MODELS:
    'List of models supported by this channel. Use comma to separate multiple models.',
  GROUP: 'User groups that can access this channel. ',
  MODEL_MAPPING:
    'For this channel, map the model name in client requests to the model name sent upstream.',
  PRIORITY: 'Higher priority channels are selected first',
  WEIGHT: 'Used for load balancing. Higher weight = more requests',
  TEST_MODEL: 'Model to use when testing channel connectivity',
  AUTO_BAN: 'Automatically disable channel on repeated failures',
  STATUS_CODE_MAPPING: 'Map response status codes (JSON format)',
  TAG: 'Group channels by tag for batch operations',
  REMARK: 'Internal notes (not shown to users)',
  SETTING: 'Channel-specific settings (JSON format)',
  PARAM_OVERRIDE: 'Override request parameters (JSON format)',
  HEADER_OVERRIDE: 'Override request headers (JSON format)',
  MULTI_KEY_MODE: 'How to select keys: random or sequential polling',
  BATCH_ADD: 'Create multiple channels from multiple keys',
  OPENAI_ORG: 'OpenAI Organization ID (optional)',
} as const

// ============================================================================
// Channel Type Specific Configurations
// ============================================================================

export const MODEL_FETCHABLE_TYPES = new Set([
  1,
  4,
  14,
  17,
  20,
  23,
  24,
  25,
  26,
  27,
  31,
  34,
  35,
  40,
  42,
  43,
  47,
  48,
  57,
  58,
  59,
  60,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
])

export const FIELD_PASSTHROUGH_TYPES = new Set([
  1,
  14,
  57,
  58,
  59,
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
])

export const OPENAI_FIELD_PASSTHROUGH_TYPES = new Set([
  1,
  57,
  58,
  59,
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
])

export const CLAUDE_FIELD_PASSTHROUGH_TYPES = new Set([
  14,
  58,
  59,
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
])

export const TYPE_TO_KEY_PROMPT: Record<number, string> = {
  15: 'Format: APIKey|SecretKey',
  18: 'Format: APPID|APISecret|APIKey',
  22: 'Format: APIKey-AppId, e.g., fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041',
  23: 'Format: TokenHub API Key, or legacy AppId|SecretId|SecretKey',
  33: 'Format: Ak|Sk|Region',
  50: 'Format: AccessKey|SecretKey (or just ApiKey if upstream is New API)',
  51: 'Format: Access Key ID|Secret Access Key',
  57: 'Paste Codex OAuth JSON credential (access_token / refresh_token / account_id)',
  59: 'Enter API key for this channel',
  60: 'Enter API key for this channel',
  62: 'vLLM API key, or EMPTY if authentication is disabled',
  63: 'SGLang API key, or EMPTY if authentication is disabled',
}

export const CHANNEL_TYPE_WARNINGS: Record<number, string> = {
  3: 'For channels added after May 10, 2025, no need to remove "." from model names during deployment',
  8: 'If connecting to upstream One API or New API relay projects, use OpenAI type instead unless you know what you are doing',
  37: 'Dify channels only support chatflow and agent, and agent does not support images',
}
