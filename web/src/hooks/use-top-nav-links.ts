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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

/**
 * Generate top navigation links based on HeaderNavModules configuration from backend /api/status
 * Backend format example (stringified JSON):
 * {
 *   home: true,
 *   pricing: { enabled: true, requireAuth: false },
 *   docs: true
 * }
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  // Parse HeaderNavModules
  const modules = useMemo(() => {
    return parseHeaderNavModulesFromStatus(
      status as Record<string, unknown> | null
    )
  }, [status])

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  // Home
  if (modules?.home !== false) {
    links.push({ title: t('Home'), href: '/' })
  }

  // The centre nav no longer carries a console entry: the console is reached
  // from the header's own "Console" button, which opens the auth dialog first
  // when the visitor is not signed in.

  // Pricing
  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const requiresAuth = pricing.requireAuth && !isAuthed
    links.push({ title: t('Models'), href: '/pricing', requiresAuth })
  }

  // 订阅：紧跟在模型之后、文档之前 —— 与「看产品」的两个入口相邻，
  // 文档作为辅助说明留在最后。
  //
  // 指向 /subscribe 而不是控制台的 /plans：后者套着控制台外壳，
  // 从前台点进去会突然出现侧边栏，不像产品页。
  //
  // 不再设 requiresAuth：价格是公开信息，未登录也应能直接看；登录只在
  // 真正点「立即订阅」时发生，由该页自己带 redirect 跳登录。
  links.push({
    title: t('Subscription'),
    href: '/subscribe',
  })

  // 文档是站内页面：不再读后台配置的外链，也不再标 external。
  if (modules?.docs !== false) {
    links.push({ title: t('Docs'), href: '/docs' })
  }

  return links
}
