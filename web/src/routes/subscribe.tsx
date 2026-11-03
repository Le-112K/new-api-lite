import { createFileRoute, redirect } from '@tanstack/react-router'

import { SubscribePage } from '@/features/plans/subscribe-page'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 前台独立订阅页。
 *
 * 它不在 `_authenticated` 布局下 —— 那套布局会渲染控制台侧边栏，
 * 与"独立页"的要求相悖。所以登录守卫在这里单独做：
 * 先等会话解析完成（带 10s 兜底，避免网络卡住时路由一直挂着），
 * 仍未登录就带回跳地址丢回首页的登录弹窗。
 */
export const Route = createFileRoute('/subscribe')({
  beforeLoad: async ({ location, preload }) => {
    if (preload) return

    await Promise.race([
      resolveAuthentication(),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ])

    const { auth } = useAuthStore.getState()
    if (!auth.user || !auth.accessToken) {
      const params = new URLSearchParams({ auth: 'signin' })
      params.set('redirect', location.href)
      throw redirect({ href: `/?${params.toString()}`, replace: true })
    }
  },
  component: SubscribePage,
})
