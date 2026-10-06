// Stub: 任务插件系统在二开精简中移除，这里只保留被渠道表单依赖的类型契约。
// 行为恒为「空/不支持」，但签名与调用点保持一致，避免类型检查失败。
import type { TaskPluginOption } from '../api'
import type { ChannelSettings } from '../types'

export const LEGACY_TASK_PLUGIN_KEYS: Readonly<
  Partial<Record<number, string>>
> = {}

export function supportsChannelPluginExtensions(_channelType: number): boolean {
  return false
}

export function readTaskExtendPluginKeys(
  _channelType: number,
  _setting:
    | Pick<ChannelSettings, 'task_plugin_key' | 'task_extend_plugin_keys'>
    | null
    | undefined
): string[] {
  return []
}

export function supportsNewAPIUpstream(
  _plugin: Pick<TaskPluginOption, 'upstreams'>
): boolean {
  return false
}

export function getChannelPluginExtensions(
  _channelType: number,
  _plugins: TaskPluginOption[],
  _extendPluginKeys: readonly string[] = []
): TaskPluginOption[] {
  return []
}
