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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModelCard } from '@/features/pricing/components/model-card'
import { ModelDetailsContent } from '@/features/pricing/components/model-details'
import type { PricingModel } from '@/features/pricing/types'
import { api } from '@/lib/api'

import { ModelPricingEditorPanel } from '../model-pricing-sheet'
import { ModelRatioForm } from '../model-ratio-form'
import { ModelRatioVisualEditor } from '../model-ratio-visual-editor'

/**
 * 验收清单的逐条断言。每条对应浏览器里一个可观察的界面事实：
 * 公开模型页不显示价格；后台定价编辑器只有「单次价格」一条路径。
 */

const MODEL_PRICE_JSON = JSON.stringify({
  'deepseek-v4-pro-ga-260813': 0.0128,
  'deepseek-v4-1-flash-260910': 0.0045,
})

let client: QueryClient | undefined

beforeEach(() => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/pricing') {
      return { data: { success: true, data: [], vendors: [] } }
    }
    return { data: { success: true, data: {} } }
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  client?.clear()
  client = undefined
  localStorage.clear()
  vi.restoreAllMocks()
})

function withClient(node: React.ReactNode) {
  return <QueryClientProvider client={client!}>{node}</QueryClientProvider>
}

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'deepseek-v4-pro-ga-260813',
    model_price: 0.0128,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

// ── 清单 1：公开模型广场与详情弹窗都不显示价格 ──────────────────────────────
describe('验收 1 · 公开模型页不显示价格', () => {
  it('模型广场卡片上没有任何价格、倍率或单位', () => {
    render(
      <ModelCard
        model={pricingModel({ context_length: 1000000 })}
        onClick={vi.fn()}
      />
    )
    // 先证明卡片确实渲染了（否则「查不到价格」会空跑）
    expect(
      screen.getAllByText('deepseek-v4-pro-ga-260813').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/request|\/1M|\/1K/)).not.toBeInTheDocument()
    expect(screen.queryByText('Input')).not.toBeInTheDocument()
    expect(screen.queryByText('Output')).not.toBeInTheDocument()
    expect(screen.queryByText('Cache')).not.toBeInTheDocument()
  })

  it('模型详情弹窗里也没有价格', () => {
    render(
      <ModelDetailsContent
        model={pricingModel()}
        usableGroup={{ default: { desc: '默认分组', ratio: 1 } }}
        endpointMap={{}}
      />
    )
    // 先证明详情确实渲染了（否则「查不到价格」会空跑）
    expect(
      screen.getAllByText(/deepseek-v4-pro-ga-260813/).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/request|\/1M|\/1K/)).not.toBeInTheDocument()
    expect(screen.queryByText('Input')).not.toBeInTheDocument()
    expect(screen.queryByText('Output')).not.toBeInTheDocument()
    expect(screen.queryByText('Cache')).not.toBeInTheDocument()
  })
})

// ── 清单 2：定价抽屉只剩「固定价格」 ───────────────────────────────────────
describe('验收 2 · 抽屉只有固定价格', () => {
  it('没有计费模式页签，只有一个固定价格输入框', () => {
    render(
      withClient(
        <ModelPricingEditorPanel
          editData={{ name: 'deepseek-v4-pro-ga-260813', price: '0.0128' }}
        />
      )
    )
    expect(screen.getByRole('textbox', { name: 'Fixed price' })).toBeVisible()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByText('Per-token (deprecated)')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Per-request (deprecated)')
    ).not.toBeInTheDocument()
  })

  it('没有 token 计价车道的输入框', () => {
    render(
      withClient(
        <ModelPricingEditorPanel
          editData={{ name: 'deepseek-v4-pro-ga-260813', price: '0.0128' }}
        />
      )
    )
    // 先证明抽屉确实渲染了（否则「查不到车道」会空跑）
    expect(screen.getByRole('textbox', { name: 'Fixed price' })).toBeVisible()
    for (const label of [
      'Input price',
      'Completion price',
      'Cache read price',
      'Cache write price',
      'Image input price',
      'Audio input price',
      'Audio output price',
    ]) {
      expect(screen.queryByRole('textbox', { name: label })).toBeNull()
      expect(screen.queryByText(label)).toBeNull()
    }
  })
})

// ── 清单 3：表格没有「模式」列，价格摘要按次展示 ───────────────────────────
describe('验收 3 · 表格没有模式列', () => {
  it('表头里没有 Mode，价格摘要是按次价', async () => {
    render(
      withClient(
        <ModelRatioVisualEditor
          savedModelPrice={MODEL_PRICE_JSON}
          modelPrice={MODEL_PRICE_JSON}
          onChange={vi.fn()}
          onSave={vi.fn()}
          isSaving={false}
        />
      )
    )
    const row = await screen.findByRole('row', { name: /deepseek-v4-pro-ga/ })
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent)
    expect(headers).not.toContain('Mode')
    expect(headers).toContain('Price summary')
    expect(within(row).getByText('$0.0128 / request')).toBeVisible()
    expect(within(row).getByText('Fixed request price')).toBeVisible()
  })
})

// ── 清单 4：JSON 模式只剩一个文本框 ───────────────────────────────────────
describe('验收 4 · JSON 模式只有一个字段', () => {
  it('切到 JSON 后只有「模型固定定价」一个文本框', async () => {
    function Harness() {
      const form = useForm<{ ModelPrice: string }>({
        defaultValues: { ModelPrice: MODEL_PRICE_JSON },
      })
      return (
        <ModelRatioForm
          form={form}
          savedValues={{ ModelPrice: MODEL_PRICE_JSON }}
          onSave={vi.fn()}
          onReset={vi.fn()}
          isSaving={false}
          isResetting={false}
        />
      )
    }
    const user = userEvent.setup()
    render(withClient(<Harness />))
    await user.click(screen.getByRole('button', { name: 'Switch to JSON' }))
    expect(screen.getByText('Model fixed pricing')).toBeVisible()
    const textboxes = screen.getAllByRole('textbox')
    expect(textboxes).toHaveLength(1)
    // 文本框里就是单次价的 JSON，不含任何倍率键
    expect((textboxes[0] as HTMLTextAreaElement).value).toContain(
      'deepseek-v4-pro-ga-260813'
    )
    expect((textboxes[0] as HTMLTextAreaElement).value).not.toMatch(
      /ModelRatio|CompletionRatio|CacheRatio|ImageRatio|AudioRatio/
    )
    for (const label of [
      'Model ratio',
      'Completion ratio',
      'Cache ratio',
      'Create cache ratio',
      'Image ratio',
      'Audio ratio',
      'Audio completion ratio',
    ]) {
      expect(screen.queryByText(label)).toBeNull()
    }
  })
})

// ── 清单 5：工具栏没有「模式」筛选器 ───────────────────────────────────────
describe('验收 5 · 工具栏没有模式筛选器', () => {
  it('筛选区不再出现 per-token / per-request 选项', async () => {
    render(
      withClient(
        <ModelRatioVisualEditor
          savedModelPrice={MODEL_PRICE_JSON}
          modelPrice={MODEL_PRICE_JSON}
          onChange={vi.fn()}
          onSave={vi.fn()}
          isSaving={false}
        />
      )
    )
    await screen.findByRole('row', { name: /deepseek-v4-pro-ga/ })
    // 先证明工具栏确实渲染了（否则「查不到筛选器」会空跑）
    expect(screen.getByPlaceholderText('Search models...')).toBeVisible()
    expect(screen.queryByText('Mode')).toBeNull()
    expect(screen.queryByText('Per-token (deprecated)')).toBeNull()
    expect(screen.queryByText('Per-request (deprecated)')).toBeNull()
  })
})
