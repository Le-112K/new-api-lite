// Stub: 任务插件系统在二开精简中移除，渠道抽屉不再渲染插件扩展区块。
import type { TaskPluginOption } from '../api'

export function ChannelPluginExtensions(_props: {
  plugins?: TaskPluginOption[]
  selected?: string[]
  onConfigure?: (pluginKey: string) => void
}) {
  return null
}
