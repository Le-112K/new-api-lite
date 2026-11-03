import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SubscribePage } from '@/features/plans/subscribe-page'

/**
 * 前台独立订阅页。
 *
 * 它不是「登录后才能看」的页面：价格与权益本来就是公开信息（模型广场的
 * 档位胶囊用的也是同一份套餐数据），把浏览锁在登录之后只会让用户先交账号
 * 才知道值不值。这里不再做会话解析与重定向 —— 未登录直接渲染，点「立即
 * 订阅」时才去登录，登录后带 `?plan=<id>` 回来自动打开对应购买框。
 *
 * 需要鉴权的是交易与个人数据：`/api/subscription/self`、余额支付、ePay 都
 * 仍在 UserAuth 之下，进入控制台的 /plans 也仍然要登录。
 */
const subscribeSearchSchema = z.object({
  /** 登录回跳时带上用户点过的套餐，回来直接开购买框。 */
  plan: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/subscribe')({
  validateSearch: subscribeSearchSchema,
  component: function SubscribeRoute() {
    const { plan } = Route.useSearch()
    return <SubscribePage autoOpenPlanId={plan} />
  },
})
