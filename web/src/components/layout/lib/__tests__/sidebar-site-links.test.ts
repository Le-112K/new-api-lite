import type { TFunction } from 'i18next'
import { BookOpen, Boxes, ChevronLeft } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { NavGroup } from '../../types'
import { toSiteNavItems, withSiteItems } from '../sidebar-site-links'

// 测试里不加载真实语言包：t 直接返回 key，断言的是「用了哪个 key」，
// 具体中文措辞由语言包保证。
const t = ((key: string) => key) as unknown as TFunction

const LINKS = [
  { title: '首页', href: '/' },
  { title: '模型', href: '/pricing' },
  { title: '订阅', href: '/subscribe' },
  { title: '文档', href: '/docs' },
]

function generalGroup(): NavGroup {
  return {
    id: 'general',
    title: '常规',
    items: [{ title: '概览', url: '/dashboard/overview' }],
  }
}

describe('站点入口并进控制台侧边栏', () => {
  it('丢弃「订阅」——控制台已有「订阅套餐」，顶部再来一条是重复', () => {
    const items = toSiteNavItems(LINKS, t)

    expect(items.map((item) => item.url)).toEqual(['/', '/pricing', '/docs'])
    expect(items.some((item) => item.url === '/subscribe')).toBe(false)
  })

  it('「首页」用 "<" 样式箭头，并改叫「返回首页」', () => {
    const home = toSiteNavItems(LINKS, t).find((item) => item.url === '/')

    expect(home?.icon).toBe(ChevronLeft)
    expect(home?.title).toBe('Back to home')
  })

  it('「模型」在控制台叫「模型广场」，图标用盒子', () => {
    const models = toSiteNavItems(LINKS, t).find(
      (item) => item.url === '/pricing'
    )

    expect(models?.title).toBe('Model plaza')
    expect(models?.icon).toBe(Boxes)
  })

  it('文档保持原样，仍用书图标', () => {
    const docs = toSiteNavItems(LINKS, t).find((item) => item.url === '/docs')

    expect(docs?.title).toBe('文档')
    expect(docs?.icon).toBe(BookOpen)
  })

  it('并进「常规」组且排在最前，其它分组不受影响', () => {
    const groups = [
      generalGroup(),
      {
        id: 'personal',
        title: '个人',
        items: [{ title: '钱包', url: '/wallet' }],
      },
    ]

    const merged = withSiteItems(groups, toSiteNavItems(LINKS, t), false)

    expect(merged[0].items.map((item) => item.title)).toEqual([
      'Back to home',
      'Model plaza',
      '文档',
      '概览',
    ])
    expect(merged[1]).toBe(groups[1])
    // 不原地改传入的数组：侧边栏有动画/缓存，改源对象会引发难查的重渲染。
    expect(groups[0].items).toHaveLength(1)
  })

  it('钻入式工作区不拼接站点入口', () => {
    const groups = [generalGroup()]

    expect(withSiteItems(groups, toSiteNavItems(LINKS, t), true)).toBe(groups)
  })

  it('站点入口全被模块开关关掉时，分组保持原样', () => {
    const groups = [generalGroup()]

    expect(withSiteItems(groups, [], false)).toBe(groups)
  })
})
