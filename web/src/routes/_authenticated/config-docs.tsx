import { createFileRoute } from '@tanstack/react-router'

import { ConsoleDocsPage } from '@/features/docs/console-page'

/**
 * 控制台内的配置文档。
 *
 * 与前台 /docs 是两份路由、同一份内容：这里挂在 `_authenticated` 下，套控制台
 * 外壳，侧边栏点进来时留在控制台里，不跳转到公开站点。
 */
export const Route = createFileRoute('/_authenticated/config-docs')({
  component: ConsoleDocsPage,
})
