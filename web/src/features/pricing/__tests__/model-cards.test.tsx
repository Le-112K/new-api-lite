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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

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
  it('carries no pay-per-use price anywhere on the card', () => {
    render(
      <ModelCard
        model={pricingModel({
          model_ratio: 37.5,
          completion_ratio: 3,
          cache_ratio: 0.1,
          model_price: 0.01,
          context_length: 200000,
        })}
        onClick={vi.fn()}
      />
    )
    // Input/output/cache rates, per-request prices and their units are gone.
    expect(screen.queryByText('Input')).not.toBeInTheDocument()
    expect(screen.queryByText('Output')).not.toBeInTheDocument()
    expect(screen.queryByText('Cache')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/1M|\/1K|\/request/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText('Per Request')).not.toBeInTheDocument()
  })

  it('keeps the spec numbers off the card (they live in the details drawer)', () => {
    render(
      <ModelCard
        model={pricingModel({
          context_length: 1000000,
          max_output_tokens: 384000,
          thinking_strength: 'high',
        })}
        onClick={vi.fn()}
      />
    )
    expect(screen.queryByText('Context')).not.toBeInTheDocument()
    expect(screen.queryByText('Max output')).not.toBeInTheDocument()
    expect(screen.queryByText('Thinking Strength')).not.toBeInTheDocument()
    expect(screen.queryByText('1M')).not.toBeInTheDocument()
    expect(screen.queryByText('384K')).not.toBeInTheDocument()
  })

  it('leaves capabilities to the details drawer', () => {
    render(
      <ModelCard
        model={pricingModel({
          capabilities: ['vision', 'tools', 'reasoning'],
        })}
        onClick={vi.fn()}
      />
    )
    expect(screen.queryByText('Vision')).not.toBeInTheDocument()
    expect(screen.queryByText('Tools')).not.toBeInTheDocument()
    expect(screen.queryByText('Reasoning')).not.toBeInTheDocument()
  })

  it('shows which plans already include the model', () => {
    render(
      <ModelCard
        model={pricingModel({ enable_groups: ['default', 'premium'] })}
        groupLabels={{ default: '默认分组', premium: 'Starter' }}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('默认分组')).toBeVisible()
    expect(screen.getByText('Starter')).toBeVisible()
  })

  it('falls back to the raw group key when a label is unknown', () => {
    render(
      <ModelCard
        model={pricingModel({ enable_groups: ['vip'] })}
        groupLabels={{ default: '默认分组' }}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('vip')).toBeVisible()
  })

  it('copies the complete long model name without opening details', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const name = 'provider/model-with-a-long-name-and-a-version-suffix-20260906'
    render(
      <ModelCard model={pricingModel({ model_name: name })} onClick={onClick} />
    )
    // The heading carries the display name (admin-configured or derived) and
    // repeats it on its title so a truncation still has a hover affordance.
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveAttribute('title', heading.textContent)
    expect(heading).not.toHaveTextContent(name)
    // The raw identifier is still rendered on the card (mono, selectable), so it
    // survives even without the clipboard button; its title exposes the full id
    // even when the line truncates.
    const idLine = screen.getByText(name)
    expect(idLine).toHaveClass('font-mono')
    expect(idLine).toHaveAttribute('title', name)
    await user.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(await navigator.clipboard.readText()).toBe(name)
    expect(onClick).not.toHaveBeenCalled()
    // The whole card is the click target (the reference has no details button).
    await user.click(
      screen.getByRole('button', { name: heading.textContent || '' })
    )
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(name)
  })

  it('puts the vendor on its own row and the raw id in a mono well', () => {
    render(
      <ModelCard
        model={pricingModel({ vendor_name: 'Anthropic' })}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Anthropic')).toBeVisible()
    const id = screen.getByText('example-model')
    expect(id).toHaveClass('font-mono')
    expect(id.tagName.toLowerCase()).toBe('code')
  })

  it('keeps description, endpoints and tags off the card', () => {
    render(
      <ModelCard
        model={pricingModel({
          description: 'Flagship multimodal model.',
          supported_endpoint_types: ['openai-response', 'openai', 'claude'],
          tags: 'vision,tools',
        })}
        onClick={vi.fn()}
      />
    )
    expect(
      screen.queryByText('Flagship multimodal model.')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Endpoints')).not.toBeInTheDocument()
    // Tags live in the details drawer; the card stays as sparse as the reference.
    expect(screen.queryByText('vision')).not.toBeInTheDocument()
    expect(screen.queryByText('tools')).not.toBeInTheDocument()
  })

  it('renders the brand-cased display name in sans, keeping the raw id in mono', () => {
    const name = 'deepseek-reasoner'
    render(
      <ModelCard
        model={pricingModel({ model_name: name })}
        onClick={vi.fn()}
      />
    )
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('DeepSeek Reasoner')
    expect(heading).toHaveAttribute('title', 'DeepSeek Reasoner')
    expect(heading).not.toHaveClass('font-mono')
    expect(screen.getByText(name)).toHaveClass('font-mono')
  })

  it('prefers the backend-configured display name and keeps the id copyable', async () => {
    const user = userEvent.setup()
    const name = 'deepseek-v4-1-flash-260910'
    render(
      <ModelCard
        model={pricingModel({
          model_name: name,
          display_name: 'DeepSeek V4.1 Flash 特调版',
        })}
        onClick={vi.fn()}
      />
    )
    // Line 1: whatever the admin configured.
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('DeepSeek V4.1 Flash 特调版')
    // Line 2: the callable id is untouched by the display name, and copying it
    // yields the exact upstream string rather than the title above.
    expect(screen.getByText(name)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(await navigator.clipboard.readText()).toBe(name)
  })

  it('falls back to the derived name when the configured one is blank', () => {
    render(
      <ModelCard
        model={pricingModel({
          model_name: 'glm-5-3-flash',
          display_name: '   ',
        })}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'GLM 5 3 Flash'
    )
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

  it('keeps every card inside the 320–360px target width band', () => {
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
      .closest('[data-slot="card"]')?.parentElement
    // auto-fill with a 320px floor: cards never stretch into wide columns,
    // and `min(100%, …)` keeps narrow screens from overflowing.
    expect(grid).toHaveClass(
      'grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]'
    )
  })
})
