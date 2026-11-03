import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { DocsPage } from '@/features/docs'

/**
 * 站内配置文档。
 *
 * 以前「文档」是后台配置的一个外链，点击就离开本站；现在文档是本站的公开
 * 页面，`?tool=` 用来直达某个工具的接入步骤（首页的接入指南就是这么链过来的）。
 *
 * 公开可读：文档讲的是怎么接进来，不需要账号；真正的密钥在控制台里创建。
 */
const docsSearchSchema = z.object({
  tool: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/docs')({
  validateSearch: docsSearchSchema,
  component: function DocsRoute() {
    const { tool } = Route.useSearch()
    return <DocsPage initialTool={tool} />
  },
})
