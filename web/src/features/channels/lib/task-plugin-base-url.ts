// Stub: task plugin system removed in 二开精简
export function resolveTaskPluginBaseURL(_key: string, _channelBaseURL?: string): string {
  return ''
}

export function validateTaskPluginBaseURL(_value: string): string | null {
  return null
}

export function assessBaseUrlTrust(_url: string): 'trusted' | 'untrusted' | 'unknown' {
  return 'unknown'
}

export function nextTaskPluginBaseUrl(_current: string, _key: string): string {
  return ''
}
