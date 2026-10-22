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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { CachedPriceCell } from '../components/cached-price-cell'
import { ModelCard } from '../components/model-card'
import { ModelCardGrid } from '../components/model-card-grid'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default', 'premium'],
    group_ratio: { default: 1, premium: 3 },
    ...overrides,
  }
}

let queryClient: QueryClient
const originalStorage = useSystemConfigStore.persist.getOptions().storage
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
})
afterEach(() => {
  queryClient.clear()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
})

describe('model cards', () => {
  it('renders the cached input price derived from the configured cache ratio', () => {
    render(
      <CachedPriceCell
        model={pricingModel({ cache_ratio: 0.25 })}
        options={{ tokenUnit: 'M' }}
      />
    )
    expect(screen.getByText(/\$0\.5/)).toBeVisible()
    expect(screen.getByText(/\/ 1M/)).toBeVisible()
  })

  it('shows fixed prices per request in both token display units', () => {
    const model = pricingModel({ quota_type: 1, model_price: 0.01 })
    const { rerender } = render(
      <ModelCard model={model} onClick={vi.fn()} tokenUnit='K' />
    )
    expect(screen.getByText('$0.01')).toBeVisible()
    expect(screen.getByText('/request')).toBeVisible()
    rerender(<ModelCard model={model} onClick={vi.fn()} tokenUnit='M' />)
    expect(screen.getByText('$0.01')).toBeVisible()
    expect(screen.queryByText('/1M')).not.toBeInTheDocument()
  })
  it('copies the complete long model name without opening details', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const name = 'provider/model-with-a-long-name-and-a-version-suffix-20260906'
    render(
      <ModelCard model={pricingModel({ model_name: name })} onClick={onClick} />
    )
    // The heading carries the brand-cased display name and keeps the raw API id
    // on its title, so hovering reveals the exact machine string.
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveAttribute('title', name)
    expect(heading).not.toHaveTextContent(name)
    // The raw identifier is still rendered on the card (mono, selectable), so it
    // survives even without the clipboard button.
    expect(screen.getByText(name)).toHaveClass('font-mono')
    await user.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(await navigator.clipboard.readText()).toBe(name)
    expect(onClick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(name)
  })

  it('always renders four fixed spec columns in order, dashing the cache slot without a cache price', () => {
    render(
      <ModelCard
        model={pricingModel({ context_length: 128000, cache_ratio: null })}
        onClick={vi.fn()}
      />
    )
    const specRow = screen.getByText('Input').closest('dl')
    if (!specRow) {
      throw new Error('Expected a spec row')
    }
    expect(
      within(specRow)
        .getAllByRole('term')
        .map((el) => el.textContent)
    ).toEqual(['Context', 'Input', 'Output', 'Cache'])
    expect(within(specRow).getAllByRole('definition')).toHaveLength(4)
    expect(screen.getByText('Context').parentElement).toHaveTextContent('128K')
    expect(screen.getByText('Input').parentElement).toHaveTextContent('$2')
    expect(screen.getByText('Output').parentElement).toHaveTextContent('$6')
    // The cache slot must never be dropped: a missing column would silently
    // shift its neighbours, so an unconfigured cache stays as an em dash.
    expect(screen.getByText('Cache').parentElement).toHaveTextContent('—')
  })

  it('keeps the vendor on the meta line and the context size in the spec row', () => {
    const { rerender } = render(
      <ModelCard
        model={pricingModel({
          vendor_name: 'Anthropic',
          context_length: 200000,
        })}
        onClick={vi.fn()}
      />
    )
    // The meta line carries the vendor alone; the context size reads as a spec.
    const meta = screen.getByText('Anthropic')
    expect(meta).not.toHaveTextContent('Context')
    expect(screen.getByText('Context').parentElement).toHaveTextContent('200K')
    rerender(
      <ModelCard
        model={pricingModel({ vendor_name: 'Anthropic' })}
        onClick={vi.fn()}
      />
    )
    // A missing context length must not fabricate a value, and must not drop
    // the column — it dashes in place so its neighbours keep their positions.
    expect(screen.getByText('Context').parentElement).toHaveTextContent('—')
  })

  it('keeps the spec row intact for a model with no vendor', () => {
    render(
      <ModelCard
        model={pricingModel({ vendor_name: '', context_length: 200000 })}
        onClick={vi.fn()}
      />
    )
    // No vendor means no meta line at all — never an empty row or a dangling
    // separator. The context size is unaffected: it lives in the spec row.
    expect(screen.queryByText('·')).not.toBeInTheDocument()
    expect(screen.getByText('Context').parentElement).toHaveTextContent('200K')
  })

  it('keeps description, tags, groups and endpoints off the card', () => {
    render(
      <ModelCard
        model={pricingModel({
          description: 'Flagship multimodal model.',
          enable_groups: ['default', 'premium'],
          supported_endpoint_types: ['openai-response', 'openai', 'claude'],
          tags: 'vision,tools',
        })}
        onClick={vi.fn()}
      />
    )
    expect(
      screen.queryByText('Flagship multimodal model.')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Groups')).not.toBeInTheDocument()
    expect(screen.queryByText('Endpoints')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Tags' })).not.toBeInTheDocument()
    expect(screen.getByText('vision')).toBeVisible()
  })

  it('renders the brand-cased display name in sans, keeping the raw id in mono on the meta line', () => {
    const name = 'deepseek-reasoner'
    render(
      <ModelCard
        model={pricingModel({ model_name: name })}
        onClick={vi.fn()}
      />
    )
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('DeepSeek Reasoner')
    expect(heading).toHaveAttribute('title', name)
    expect(heading).not.toHaveClass('font-mono')
    expect(screen.getByText(name)).toHaveClass('font-mono')
  })

  it('keeps group and recharge pricing correct when changing the token unit, including a free cache price', () => {
    const props = {
      model: pricingModel({ cache_ratio: 0 }),
      onClick: vi.fn(),
      selectedGroup: 'premium',
      showRechargePrice: true,
      priceRate: 3,
      usdExchangeRate: 6,
    }
    const { rerender } = render(<ModelCard {...props} tokenUnit='M' />)
    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      /\$3\s*\/\s*1M/
    )
    expect(screen.getByText('Output').parentElement).toHaveTextContent(
      /\$9\s*\/\s*1M/
    )
    expect(screen.getByText('Cache').parentElement).toHaveTextContent(
      /\$0\s*\/\s*1M/
    )
    rerender(<ModelCard {...props} tokenUnit='K' />)
    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      /\$0.003\s*\/\s*1K/
    )
    expect(screen.getByText('Output').parentElement).toHaveTextContent(
      /\$0.009\s*\/\s*1K/
    )
    expect(screen.getByText('Cache').parentElement).toHaveTextContent(
      /\$0\s*\/\s*1K/
    )
  })

  it('shows a per-request price with the selected group and recharge multiplier without a token unit', () => {
    render(
      <ModelCard
        model={pricingModel({ quota_type: 1, model_price: 0.4 })}
        onClick={vi.fn()}
        selectedGroup='premium'
        showRechargePrice
        priceRate={3}
        usdExchangeRate={6}
        tokenUnit='K'
      />
    )
    expect(screen.getByText(/\$0.6/)).toHaveTextContent(/\$0.6\s*\/\s*request/)
    expect(screen.queryByText(/1K|1M/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Per Request')).toHaveLength(1)
    expect(screen.queryByText('Per-request')).not.toBeInTheDocument()
  })

  it('paginates the model cards and disables navigation at both boundaries', async () => {
    queryClient.setQueryData(['perf-metrics-summary', 24], {
      success: true,
      data: { models: [] },
    })
    const models = Array.from({ length: 21 }, (_, index) =>
      pricingModel({ id: index + 1, model_name: `model-${index + 1}` })
    )
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={models} onModelClick={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Model 21' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('heading', { name: 'Model 1' })).toBeVisible()
  })

  it('switches the card grid to three columns at the xl breakpoint instead of 2xl', () => {
    queryClient.setQueryData(['perf-metrics-summary', 24], {
      success: true,
      data: { models: [] },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={[pricingModel()]} onModelClick={vi.fn()} />
      </QueryClientProvider>
    )
    const grid = screen
      .getByRole('heading', { name: 'Example Model' })
      .closest('.grid-cols-1')
    expect(grid).toHaveClass('xl:grid-cols-3')
    expect(grid).not.toHaveClass('2xl:grid-cols-3')
    expect(grid).not.toHaveClass('min-[1440px]:grid-cols-3')
  })
})
