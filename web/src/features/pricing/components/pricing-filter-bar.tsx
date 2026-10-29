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
import { Crown, X } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { getMonoLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL } from '../constants'
import type {
  PricingModel,
  PricingSubscriptionPlan,
  PricingVendor,
} from '../types'

export interface PricingFilterBarProps {
  groupFilter: string
  vendorFilter: string
  onGroupChange: (value: string) => void
  onVendorChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupLabels: Record<string, string>
  models: PricingModel[]
  subscriptionPlans: PricingSubscriptionPlan[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

/* One filter value as a pill. Everything is on screen at once — no menu, no
   collapse: a category's options are always visible and one click applies the
   filter. Selected = inverted solid block (the design language is zero-colour,
   so "active" is carried by inversion, not hue). */
function Chip(props: {
  label: string
  active: boolean
  count?: number
  suffix?: string | number
  icon?: ReactNode
  onClick: () => void
}) {
  const badge = props.suffix ?? props.count
  return (
    <Button
      type='button'
      variant={props.active ? 'default' : 'outline'}
      // `.lp-shell` squares every button to 8px; this flag is the escape hatch
      // that restores the pill radius for these option chips.
      data-shape='pill'
      aria-pressed={props.active}
      title={props.label}
      onClick={props.onClick}
      className={cn(
        'h-9 max-w-full gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-medium shadow-none',
        !props.active &&
          'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
      )}
    >
      {props.icon && (
        <span
          className={cn(
            'shrink-0',
            props.active ? 'text-background' : 'text-foreground'
          )}
        >
          {props.icon}
        </span>
      )}
      <span className='truncate'>{props.label}</span>
      {badge != null && (
        <span
          className={cn(
            'tabular-nums',
            props.active ? 'opacity-80' : 'text-muted-foreground/70'
          )}
        >
          {badge}
        </span>
      )}
    </Button>
  )
}

/* A hairline-separated row: a fixed-width small-caps label plus a wrapping
   pill cluster. Below `sm` the label sits above the pills so the row never
   squeezes them. */
function FilterRow(props: {
  label: string
  first?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3',
        props.first
          ? ''
          : 'border-[var(--hairline)] mt-3 border-t pt-3'
      )}
    >
      <span className='text-muted-foreground shrink-0 pt-1.5 text-[0.8125rem] font-semibold tracking-[0.06em] sm:w-[72px]'>
        {props.label}
      </span>
      <div className='flex min-w-0 flex-1 flex-wrap gap-2'>
        {props.children}
      </div>
    </div>
  )
}

function ActiveChip(props: { label: string; onRemove: () => void }) {
  return (
    <span className='border-border bg-background text-foreground inline-flex items-center gap-2 rounded-full border py-[5px] pr-2 pl-3 text-[0.8125rem]'>
      <span>{props.label}</span>
      <button
        type='button'
        onClick={props.onRemove}
        aria-label={props.label}
        className='text-muted-foreground hover:text-foreground inline-flex'
      >
        <X className='size-3.5' />
      </button>
    </span>
  )
}

export const PricingFilterBar = memo(function PricingFilterBar(
  props: PricingFilterBarProps
) {
  const { t } = useTranslation()

  const vendorCounts = useMemo(() => {
    const vendors = new Map<string, number>()
    for (const model of props.models) {
      if (model.vendor_name) {
        vendors.set(
          model.vendor_name,
          (vendors.get(model.vendor_name) ?? 0) + 1
        )
      }
    }
    return vendors
  }, [props.models])

  // Subscription tiers: one pill per distinct upgrade group, labelled by its
  // plan title. Groups that hold models but no plan fall back to their
  // usable_group label so every selectable tier stays reachable. A tier with no
  // visible models cannot filter anything: it is kept only while it is the
  // applied filter so an active selection stays visible and clearable.
  const groupModelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      for (const group of model.enable_groups ?? []) {
        counts.set(group, (counts.get(group) ?? 0) + 1)
      }
    }
    return counts
  }, [props.models])

  const tierOptions = useMemo(() => {
    const options: Array<{
      group: string
      label: string
      price?: string
      count: number
    }> = []
    const seen = new Set<string>()
    for (const plan of props.subscriptionPlans) {
      const group = plan.upgrade_group
      if (!group || seen.has(group)) continue
      seen.add(group)
      const count = groupModelCounts.get(group) ?? 0
      if (count === 0 && props.groupFilter !== group) continue
      options.push({
        group,
        label: plan.title,
        price: formatBillingCurrencyFromUSD(plan.price_amount),
        count,
      })
    }
    // Groups the plan catalog does not cover (e.g. the default group when the
    // operator sells no plan for it) still deserve a pill while they hold
    // models.
    for (const group of props.groups) {
      if (seen.has(group)) continue
      seen.add(group)
      const count = groupModelCounts.get(group) ?? 0
      if (count === 0 && props.groupFilter !== group) continue
      options.push({
        group,
        label: props.groupLabels[group] ?? group,
        count,
      })
    }
    return options
  }, [
    props.subscriptionPlans,
    props.groups,
    props.groupLabels,
    props.groupFilter,
    groupModelCounts,
  ])

  const tierLabelFor = (group: string) =>
    tierOptions.find((tier) => tier.group === group)?.label ??
    props.groupLabels[group] ??
    group

  // Vendors with no models in this catalog are noise; the applied vendor is
  // never hidden so an active filter stays clearable.
  const vendorOptions = props.vendors
    .map((vendor) => ({
      vendor,
      count: vendorCounts.get(vendor.name) ?? 0,
    }))
    .filter(
      ({ vendor, count }) =>
        count > 0 || props.vendorFilter === vendor.name
    )

  const activeChips: Array<{
    key: string
    label: string
    onRemove: () => void
  }> = []
  if (props.groupFilter !== FILTER_ALL) {
    activeChips.push({
      key: 'group',
      label: `${t('Subscription')}: ${tierLabelFor(props.groupFilter)}`,
      onRemove: () => props.onGroupChange(FILTER_ALL),
    })
  }
  if (props.vendorFilter !== FILTER_ALL) {
    activeChips.push({
      key: 'vendor',
      label: `${t('Provider')}: ${props.vendorFilter}`,
      onRemove: () => props.onVendorChange(FILTER_ALL),
    })
  }

  return (
    <aside
      aria-label={t('Filter')}
      className={cn('bg-card rounded-xl border px-[18px] py-3.5', props.className)}
    >
      {tierOptions.length > 0 && (
        <FilterRow label={t('Subscription Type')} first>
          <Chip
            label={t('All plans')}
            count={props.models.length}
            active={props.groupFilter === FILTER_ALL}
            onClick={() => props.onGroupChange(FILTER_ALL)}
          />
          {tierOptions.map((tier) => (
            <Chip
              key={tier.group}
              label={tier.label}
              suffix={tier.price ?? tier.count}
              icon={
                tier.price ? (
                  <Crown className='size-3.5' aria-hidden='true' />
                ) : undefined
              }
              active={props.groupFilter === tier.group}
              onClick={() => props.onGroupChange(tier.group)}
            />
          ))}
        </FilterRow>
      )}

      <FilterRow label={t('Provider')} first={tierOptions.length === 0}>
        <Chip
          label={t('All Vendors')}
          count={props.models.length}
          active={props.vendorFilter === FILTER_ALL}
          onClick={() => props.onVendorChange(FILTER_ALL)}
        />
        {vendorOptions.map(({ vendor, count }) => (
          <Chip
            key={vendor.name}
            label={vendor.name}
            count={count}
            icon={vendor.icon ? getMonoLobeIcon(vendor.icon, 14) : undefined}
            active={props.vendorFilter === vendor.name}
            onClick={() => props.onVendorChange(vendor.name)}
          />
        ))}
      </FilterRow>

      {activeChips.length > 0 && (
        <div className='border-[var(--hairline)] mt-3 flex flex-wrap items-center gap-2.5 border-t pt-3'>
          <span className='text-muted-foreground shrink-0 text-[0.8125rem] font-semibold tracking-[0.06em]'>
            {t('Selected')}
          </span>
          <div className='flex min-w-0 flex-wrap gap-2'>
            {activeChips.map((chip) => (
              <ActiveChip
                key={chip.key}
                label={chip.label}
                onRemove={chip.onRemove}
              />
            ))}
          </div>
          <Button
            type='button'
            variant='link'
            onClick={props.onClearFilters}
            className='h-auto p-1 text-sm font-semibold'
          >
            {t('Clear filters')}
          </Button>
        </div>
      )}
    </aside>
  )
})
