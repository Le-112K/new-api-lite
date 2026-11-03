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
import { BookOpen, Boxes, Home, Link2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Sidebar, SidebarContent, SidebarRail } from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { MOTION_TRANSITION, MOTION_VARIANTS } from '@/lib/motion'

import type { NavGroup as NavGroupProps, NavLink } from '../types'
import { NavGroup } from './nav-group'
import { SidebarViewHeader } from './sidebar-view-header'

/**
 * 站点入口（首页 / 模型 / 文档）用哪个图标。
 *
 * 折叠态下侧边栏只留图标，所以每一项都必须有确定图标；
 * 认不出的链接回落到通用图标，而不是留空。
 */
function iconForLink(href: string, external?: boolean) {
  if (href === '/') return Home
  if (external) return BookOpen
  if (href.startsWith('/pricing') || href.startsWith('/models')) return Boxes
  if (href.startsWith('/docs')) return BookOpen
  return Link2
}

/**
 * Application sidebar.
 *
 * Adopts the Vercel / Cloudflare "drill-in" pattern: the URL drives
 * which sidebar *view* is rendered. Clicking a top-level entry like
 * `System Settings` swaps the sidebar to a contextual workspace —
 * with a `← Back to Dashboard` affordance — instead of stacking the
 * sub-navigation inside the root tree.
 *
 * Architecture:
 *   - View resolution + filtering: {@link useSidebarView}
 *   - View registry: `layout/lib/sidebar-view-registry.ts`
 *   - Per-view header: {@link SidebarViewHeader}
 *
 * Adding a new nested view only requires registering a {@link SidebarView}
 * in the registry; this component requires no changes.
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const { key, view, navGroups } = useSidebarView()
  const shouldReduce = useReducedMotion()

  // 首页 / 模型 / 文档 原来挂在顶部导航，现在收进侧边栏。
  // 数据仍来自后端 HeaderNavModules 配置，这里的映射只负责把它渲染成纵向导航。
  const topLinks = useTopNavLinks()
  const siteNavGroup = useMemo<NavGroupProps | null>(() => {
    if (topLinks.length === 0) return null
    return {
      id: 'site-nav',
      title: t('Site'),
      items: topLinks.map<NavLink>((link) => ({
        title: link.title,
        url: link.href,
        external: link.external,
        icon: iconForLink(link.href, link.external),
        activeUrls: [link.href],
      })),
    }
  }, [topLinks, t])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      {view && <SidebarViewHeader view={view} />}

      <SidebarContent className='py-2'>
        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={key}
            initial={
              shouldReduce ? false : MOTION_VARIANTS.sidebarSlide.initial
            }
            animate={MOTION_VARIANTS.sidebarSlide.animate}
            exit={shouldReduce ? undefined : MOTION_VARIANTS.sidebarSlide.exit}
            transition={MOTION_TRANSITION.fast}
            className='flex flex-col'
          >
            {/* 站点入口只属于根视图。设置这类「钻入式」工作区是独立上下文，
                这里再挂一份首页/模型/订阅/文档，会让侧边栏同时出现两套导航，
                用户以为设置页里能直接跳产品页，实际点走就离开了当前工作区。 */}
            {!view && siteNavGroup && (
              <NavGroup
                key={siteNavGroup.id || siteNavGroup.title}
                {...siteNavGroup}
              />
            )}
            {navGroups.map((props) => (
              <NavGroup key={props.id || props.title} {...props} />
            ))}
          </motion.div>
        </AnimatePresence>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
