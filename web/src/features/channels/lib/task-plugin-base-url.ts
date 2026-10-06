// Stub: 任务插件系统在二开精简中移除，这里只保留被渠道表单依赖的类型契约。
// assessBaseUrlTrust 保留真实返回结构（{ plainHttp, privateHost } | null），
// 调用点据此渲染明文 HTTP / 内网地址告警。
export type BaseUrlTrust = {
  plainHttp: boolean
  privateHost: boolean
}

export function assessBaseUrlTrust(
  _value: string | undefined
): BaseUrlTrust | null {
  return null
}

export function nextTaskPluginBaseUrl(
  _currentValue: string | undefined,
  _previousDefault: string | undefined,
  _nextDefault: string | undefined
): string | null {
  return null
}

export function resolveTaskPluginBaseURL(
  _key: string,
  _channelBaseURL?: string
): string {
  return ''
}

export function validateTaskPluginBaseURL(_value: string): string | null {
  return null
}
