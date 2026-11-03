import { ArrowLeft, BookOpen, Boxes, Link2 } from 'lucide-react'

import type { TopNavLink } from '@/hooks/use-top-nav-links'

import type { NavGroup, NavLink } from '../types'

/**
 * 站点入口 → 控制台侧边栏。
 *
 * 侧边栏顶部原来有个独立的 SITE 分组，列着首页/模型/订阅/文档。它和前台顶栏
 * 共用同一份数据（后端 HeaderNavModules），但在控制台里这四条的身份并不一致：
 *
 * - 订阅：控制台「个人」分组已经有「订阅套餐」，再来一条是重复。
 * - 首页：它是「回到站点」的动作，不是控制台的一个页面，所以用返回箭头。
 * - 模型 / 文档：属于站点导航，并进「常规」分组展示。
 *
 * 过滤只在这里做，不能去改数据源——那份数据同时喂给前台顶栏，删了前台也会少。
 */
const DROPPED_HREFS = new Set(['/subscribe'])

/** 站点入口用哪个图标。首页固定用返回箭头，其余按路径判断。 */
function iconForLink(href: string, external?: boolean) {
  if (external) return BookOpen
  if (href.startsWith('/pricing') || href.startsWith('/models')) return Boxes
  if (href.startsWith('/docs')) return BookOpen
  return Link2
}

export function toSiteNavItems(links: TopNavLink[]): NavLink[] {
  return links
    .filter((link) => !DROPPED_HREFS.has(link.href))
    .map<NavLink>((link) => ({
      title: link.title,
      url: link.href,
      external: link.external,
      icon:
        link.href === '/' ? ArrowLeft : iconForLink(link.href, link.external),
      activeUrls: [link.href],
    }))
}

/**
 * 把站点入口并进「常规」分组，放在该组最前面——返回首页和产品入口应该先于
 * 控制台功能被看到。
 *
 * 钻入式工作区（如系统设置）不拼接：那里有自己的上下文，站点入口会让人以为
 * 能在设置里直接跳产品页，点走就离开了当前工作区。
 */
export function withSiteItems(
  groups: NavGroup[],
  items: NavLink[],
  inNestedView: boolean
): NavGroup[] {
  if (inNestedView || items.length === 0) return groups
  return groups.map((group) =>
    group.id === 'general'
      ? { ...group, items: [...items, ...group.items] }
      : group
  )
}
