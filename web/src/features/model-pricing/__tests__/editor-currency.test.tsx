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
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  type ModelRatioData,
} from '@/features/system-settings/models/model-pricing-sheet'
import { api } from '@/lib/api'
import { usePricingPreferencesStore } from '@/stores/pricing-preferences-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

const clients: QueryClient[] = []

beforeEach(() => {
  localStorage.clear()
  usePricingPreferencesStore.setState({ currency: 'USD' })
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CNY',
      usdExchangeRate: 7,
    },
  })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: [], vendors: [] },
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  usePricingPreferencesStore.setState({ currency: 'USD' })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  localStorage.clear()
})

function renderEditor(data: Partial<ModelRatioData> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], null)
  clients.push(client)
  const ref = createRef<ModelPricingEditorPanelHandle>()
  const dirty = vi.fn()
  const view = (entry: Partial<ModelRatioData>) => (
    <QueryClientProvider client={client}>
      <ModelPricingEditorPanel
        ref={ref}
        editData={{
          name: 'currency-model',
          price: '2',
          ...entry,
        }}
        onDirtyChange={dirty}
      />
    </QueryClientProvider>
  )
  const result = render(view(data))
  return {
    ...result,
    ref,
    dirty,
    reload: (entry: Partial<ModelRatioData>) => result.rerender(view(entry)),
  }
}

async function selectCurrency(label: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Pricing currency' }))
  await user.click(await screen.findByRole('option', { name: label }))
}

async function commit(
  ref: React.RefObject<ModelPricingEditorPanelHandle | null>
) {
  let result: ModelRatioData | null = null
  await act(async () => {
    result = (await ref.current?.commitDraft()) ?? null
  })
  return result as ModelRatioData | null
}

it('defaults to USD, remembers a currency choice and restores it when reopened', async () => {
  const editor = renderEditor()
  expect(
    screen.getByRole('combobox', { name: 'Pricing currency' })
  ).toHaveTextContent('US dollar (USD)')
  expect(screen.getByRole('textbox', { name: 'Fixed price' })).toHaveValue('2')
  await selectCurrency('Site currency (CNY)')
  expect(screen.getByRole('textbox', { name: 'Fixed price' })).toHaveValue('14')
  editor.unmount()
  // Rehydrate from browser storage, rather than relying on the live store.
  const stored = localStorage.getItem('model-pricing-preferences') ?? ''
  expect(stored).not.toBe('')
  usePricingPreferencesStore.setState({ currency: 'USD' })
  localStorage.setItem('model-pricing-preferences', stored)
  await usePricingPreferencesStore.persist.rehydrate()
  renderEditor()
  expect(
    screen.getByRole('combobox', { name: 'Pricing currency' })
  ).toHaveTextContent('Site currency (CNY)')
})

it('opens currency help by keyboard and restores focus after Escape', async () => {
  renderEditor()
  const user = userEvent.setup()
  const help = screen.getByRole('button', { name: 'About pricing currency' })
  help.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', {
    name: 'About pricing currency',
  })
  expect(
    within(dialog).getByText(/The system always bills in USD/)
  ).toBeVisible()
  expect(
    within(dialog).getByText('Current exchange rate: 1 USD = 7 CNY')
  ).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(help).toHaveFocus())
})

it('switches currencies and refreshes exchange rates without changing stored prices or dirty state', async () => {
  const editor = renderEditor({ price: '2' })
  const before = await commit(editor.ref)
  editor.dirty.mockClear()
  await selectCurrency('Site currency (CNY)')
  await selectCurrency('US dollar (USD)')
  await selectCurrency('Site currency (CNY)')
  act(() =>
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 3,
      },
    })
  )
  expect(await commit(editor.ref)).toEqual(before)
  expect(editor.dirty).not.toHaveBeenCalledWith(true)
  expect(screen.getByRole('textbox', { name: 'Fixed price' })).toHaveValue('6')
})

it.each(['0', '0.0000007', '14'])(
  'saves the CNY per-request price %s as USD without display rounding',
  async (price) => {
    const editor = renderEditor({ price: '1' })
    await selectCurrency('Site currency (CNY)')
    const fixed = screen.getByRole('textbox', { name: 'Fixed price' })
    fireEvent.change(fixed, { target: { value: price } })
    const expected = { '0': '0', '0.0000007': '0.0000001', '14': '2' }[price]
    expect(Number((await commit(editor.ref))?.price)).toBe(Number(expected))
    await selectCurrency('US dollar (USD)')
    expect(fixed).toHaveValue(expected)
  }
)

it('uses the custom currency exchange rate instead of the CNY exchange rate', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CUSTOM',
      usdExchangeRate: 7,
      customCurrencySymbol: '€',
      customCurrencyExchangeRate: 0.5,
    },
  })
  const editor = renderEditor({ price: '2' })
  await selectCurrency('Site currency (€)')
  const fixed = screen.getByRole('textbox', { name: 'Fixed price' })
  expect(fixed).toHaveValue('1')
  fireEvent.change(fixed, { target: { value: '7' } })
  expect(await commit(editor.ref)).toMatchObject({ price: '14' })
})

it.each([0, -1, Infinity, Number.NaN, undefined])(
  'disables site currency and falls back to USD for invalid rate %s',
  async (rate) => {
    usePricingPreferencesStore.setState({ currency: 'site' })
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CNY',
        usdExchangeRate: rate as number,
      },
    })
    renderEditor()
    expect(screen.getByRole('textbox', { name: 'Fixed price' })).toHaveValue(
      '2'
    )
    expect(
      screen.getByText(
        'The site exchange rate is invalid. Prices are shown in USD.'
      )
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Pricing currency' })
    )
    expect(
      await screen.findByRole('option', { name: 'Site currency (CNY)' })
    ).toHaveAttribute('aria-disabled', 'true')
  }
)

it.each(['USD', 'TOKENS'] as const)(
  'offers only USD when the site uses %s',
  async (type) => {
    usePricingPreferencesStore.setState({ currency: 'site' })
    useSystemConfigStore.getState().setConfig({
      currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: type },
    })
    renderEditor()
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Pricing currency' })
    )
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(
      screen.getByRole('option', { name: 'US dollar (USD)' })
    ).toBeVisible()
  }
)

it('blocks a non-finite conversion and allows saving after the amount is corrected', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CNY',
      usdExchangeRate: 1e-308,
    },
  })
  const editor = renderEditor({ price: '1' })
  await selectCurrency('Site currency (CNY)')
  const fixed = screen.getByRole('textbox', { name: 'Fixed price' })
  fireEvent.change(fixed, { target: { value: '14' } })
  expect(fixed).toHaveAttribute('aria-invalid', 'true')
  expect(await commit(editor.ref)).toBeNull()
  expect(
    screen.getByText(
      'The converted price must be a finite, non-negative number.'
    )
  ).toBeVisible()
  fireEvent.change(fixed, { target: { value: '0' } })
  expect(await commit(editor.ref)).toMatchObject({ price: '0' })
})

it('switches currency using the keyboard without changing the saved configuration', async () => {
  const editor = renderEditor()
  const original = await commit(editor.ref)
  const user = userEvent.setup()
  screen.getByRole('combobox', { name: 'Pricing currency' }).focus()
  await user.keyboard('{ArrowDown}{End}{Enter}')
  expect(
    screen.getByRole('combobox', { name: 'Pricing currency' })
  ).toHaveTextContent('Site currency (CNY)')
  expect(await commit(editor.ref)).toEqual(original)
})

it('keeps an empty amount empty when currencies change', async () => {
  const editor = renderEditor({ price: '1' })
  const fixed = screen.getByRole('textbox', { name: 'Fixed price' })
  fireEvent.change(fixed, { target: { value: '' } })
  await selectCurrency('Site currency (CNY)')
  expect(fixed).toHaveValue('')
  expect(await commit(editor.ref)).toMatchObject({ price: '' })
})

it('clears an invalid amount draft when pricing is reloaded with the same saved value', async () => {
  const saved: Partial<ModelRatioData> = { price: '1' }
  const editor = renderEditor(saved)
  await selectCurrency('Site currency (CNY)')
  fireEvent.change(screen.getByRole('textbox', { name: 'Fixed price' }), {
    target: { value: '9'.repeat(309) },
  })
  expect(await commit(editor.ref)).toBeNull()
  editor.reload({ ...saved })
  expect(screen.getByRole('textbox', { name: 'Fixed price' })).toHaveValue('7')
  expect(await commit(editor.ref)).toMatchObject({ price: '1' })
})
