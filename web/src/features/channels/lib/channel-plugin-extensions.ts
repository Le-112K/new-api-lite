// Stub: task plugin system removed in 二开精简
export function readTaskExtendPluginKeys(_setting: unknown): string[] {
  return []
}

export function isTaskPluginChannel(_type: number): boolean {
  return false
}

export function getTaskPluginDisplayName(_key: string): string {
  return ''
}

export function resolveTaskPluginOptions(): Array<{ key: string; name: string }> {
  return []
}

export function getChannelPluginExtensions(_channel: unknown): null {
  return null
}

export function supportsChannelPluginExtensions(_type: number): boolean {
  return false
}

export function supportsNewAPIUpstream(_type: number): boolean {
  return false
}

export const LEGACY_TASK_PLUGIN_KEYS: string[] = []
