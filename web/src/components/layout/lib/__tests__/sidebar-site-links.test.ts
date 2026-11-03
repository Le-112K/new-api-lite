import { ArrowLeft, BookOpen, Boxes } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { NavGroup } from '../../types'
import { toSiteNavItems, withSiteItems } from '../sidebar-site-links'

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
    const items = toSiteNavItems(LINKS)

    expect(items.map((item) => item.url)).toEqual(['/', '/pricing', '/docs'])
    expect(items.some((item) => item.url === '/subscribe')).toBe(false)
  })

  it('「首页」是返回站点的动作，用返回箭头而不是房子图标', () => {
    const home = toSiteNavItems(LINKS).find((item) => item.url === '/')

    expect(home?.icon).toBe(ArrowLeft)
  })

  it('模型与文档各自保留可辨识图标', () => {
    const items = toSiteNavItems(LINKS)

    expect(items.find((item) => item.url === '/pricing')?.icon).toBe(Boxes)
    expect(items.find((item) => item.url === '/docs')?.icon).toBe(BookOpen)
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

    const merged = withSiteItems(groups, toSiteNavItems(LINKS), false)

    expect(merged[0].items.map((item) => item.title)).toEqual([
      '首页',
      '模型',
      '文档',
      '概览',
    ])
    expect(merged[1]).toBe(groups[1])
    // 不原地改传入的数组：侧边栏有动画/缓存，改源对象会引发难查的重渲染。
    expect(groups[0].items).toHaveLength(1)
  })

  it('钻入式工作区不拼接站点入口', () => {
    const groups = [generalGroup()]

    expect(withSiteItems(groups, toSiteNavItems(LINKS), true)).toBe(groups)
  })

  it('站点入口全被模块开关关掉时，分组保持原样', () => {
    const groups = [generalGroup()]

    expect(withSiteItems(groups, [], false)).toBe(groups)
  })
})
