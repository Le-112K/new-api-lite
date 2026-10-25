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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  PricingFilterBar,
  type PricingFilterBarProps,
} from '../components/pricing-filter-bar'
import type { PricingModel, PricingSubscriptionPlan } from '../types'

function makeModel(id: number, groups: string[]): PricingModel {
  return {
    id,
    model_name: `model-${id}`,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: groups,
  }
}

function makePlan(
  title: string,
  upgradeGroup: string,
  price = 9.9
): PricingSubscriptionPlan {
  return {
    title,
    price_amount: price,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    upgrade_group: upgradeGroup,
  }
}

function filterBarProps(
  overrides: Partial<PricingFilterBarProps> = {}
): PricingFilterBarProps {
  return {
    groupFilter: 'all',
    vendorFilter: 'all',
    onGroupChange: vi.fn(),
    onVendorChange: vi.fn(),
    vendors: [
      { id: 1, name: 'DeepSeek' },
      { id: 2, name: '智谱' },
      { id: 3, name: 'Unused' },
    ],
    groups: ['default', 'vip', 'svip'],
    groupLabels: { default: '默认分组', vip: 'vip分组', svip: 'svip分组' },
    models: [
      { ...makeModel(1, ['vip']), vendor_name: 'DeepSeek' },
      { ...makeModel(2, ['vip']), vendor_name: 'DeepSeek' },
      { ...makeModel(3, ['svip']), vendor_name: '智谱' },
      { ...makeModel(4, ['default']), vendor_name: 'DeepSeek' },
    ],
    subscriptionPlans: [makePlan('Pro', 'vip'), makePlan('Max', 'svip', 19.9)],
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    ...overrides,
  }
}

describe('pricing subscription filter', () => {
  it('shows every option up front — no menu, no search, no extra filter row', () => {
    render(<PricingFilterBar {...filterBarProps()} />)

    // Subscription tiers are directly visible.
    expect(screen.getByRole('button', { name: /^All Models\s*4$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Pro/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Max/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^默认分组/ })).toBeVisible()

    // Vendors are directly visible too.
    expect(
      screen.getByRole('button', { name: /^All Vendors\s*4$/ })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /^DeepSeek\s*3$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^智谱\s*1$/ })).toBeVisible()

    // Nothing is hidden behind a collapsed control.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('menuitemradio')).toBeNull()
    expect(screen.queryByRole('button', { name: /Model Tags/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Pricing Type/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Endpoint Type/ })).toBeNull()
  })

  it('applies a subscription tier with one click', async () => {
    const props = filterBarProps()
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)

    await user.click(screen.getByRole('button', { name: /^Pro/ }))

    expect(props.onGroupChange).toHaveBeenCalledWith('vip')
  })

  it('applies a vendor with one click', async () => {
    const props = filterBarProps()
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)

    await user.click(screen.getByRole('button', { name: /^智谱/ }))

    expect(props.onVendorChange).toHaveBeenCalledWith('智谱')
  })

  it('marks the applied tier and resets through the All Models pill', async () => {
    const props = filterBarProps({ groupFilter: 'vip' })
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)

    expect(screen.getByRole('button', { name: /^Pro/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('button', { name: /^All Models\s*4$/ })
    ).toHaveAttribute('aria-pressed', 'false')

    await user.click(
      screen.getByRole('button', { name: /^All Models\s*4$/ })
    )
    expect(props.onGroupChange).toHaveBeenCalledWith('all')
  })

  it('collapses multiple plans sharing one upgrade group into a single pill', () => {
    render(
      <PricingFilterBar
        {...filterBarProps({
          subscriptionPlans: [
            makePlan('Pro', 'vip'),
            makePlan('Pro Yearly', 'vip', 99),
            makePlan('Max', 'svip', 19.9),
          ],
        })}
      />
    )

    expect(screen.getAllByRole('button', { name: /^Pro/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Pro Yearly/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Max/ })).toBeVisible()
  })

  it('hides a tier with no visible models unless it is the applied filter', () => {
    const props = filterBarProps({
      subscriptionPlans: [
        makePlan('Pro', 'vip'),
        makePlan('Ultimate', 'ghost'),
      ],
    })
    const { rerender } = render(<PricingFilterBar {...props} />)

    expect(screen.queryByRole('button', { name: /Ultimate/ })).toBeNull()

    // Applied from a deep link -> the pill must still show, and be selected.
    rerender(<PricingFilterBar {...props} groupFilter='ghost' />)
    expect(screen.getByRole('button', { name: /^Ultimate/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('falls back to the usable_group label for groups without a plan', () => {
    render(
      <PricingFilterBar
        {...filterBarProps({
          subscriptionPlans: [makePlan('Pro', 'vip')],
        })}
      />
    )

    // 'default' and 'svip' hold models but have no plan -> admin labels.
    expect(screen.getByRole('button', { name: /^默认分组/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^svip分组/ })).toBeVisible()
  })

  it('hides vendors that have no models in this catalog', () => {
    render(<PricingFilterBar {...filterBarProps()} />)

    expect(screen.queryByRole('button', { name: /Unused/ })).toBeNull()
  })

  it('names the applied tier (not the raw group key) in the active chip', () => {
    render(<PricingFilterBar {...filterBarProps({ groupFilter: 'vip' })} />)

    expect(screen.getByText('Subscription: Pro')).toBeVisible()
    expect(screen.queryByText('Groups: vip')).toBeNull()
  })
})
