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
import { X } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  ENDPOINT_TYPES,
  FILTER_ALL,
  QUOTA_TYPES,
  getEndpointTypeLabels,
  getQuotaTypeLabels,
} from '../constants'
import { hasTaskUsageSchema } from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'
import { SearchBar } from './search-bar'

export interface PricingFilterBarProps {
  searchInput: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  tags: string[]
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

function formatGroupRatio(ratio: number | undefined): string | undefined {
  if (ratio == null) return undefined
  const formatted = Number.isInteger(ratio)
    ? ratio.toString()
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `x${formatted}`
}

function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value
}

/* One selectable filter value: a pill. Selected = inverted solid block (the
   design language is zero-colour, so "active" is carried by inversion, not
   hue). */
function Chip(props: {
  label: string
  active: boolean
  count?: number
  suffix?: string
  icon?: ReactNode
  onClick: () => void
}) {
  const badge = props.suffix ?? props.count
  return (
    <Button
      type='button'
      variant={props.active ? 'default' : 'outline'}
      size='sm'
      aria-pressed={props.active}
      title={props.label}
      onClick={props.onClick}
      className={cn(
        'h-auto max-w-full gap-1.5 rounded-full px-3 py-[5px] text-[0.8125rem] font-medium',
        !props.active &&
          'border-border bg-card text-muted-foreground hover:text-foreground'
      )}
    >
      {props.icon && <span className='shrink-0'>{props.icon}</span>}
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
   chip cluster. Below `sm` the label sits above the chips instead of beside
   them so the row never squeezes the pills. */
function FilterRow(props: { label: string; children: ReactNode }) {
  return (
    <div className='border-[var(--hairline)] mt-3 flex flex-col gap-2.5 border-t pt-3 sm:flex-row sm:items-start sm:gap-3'>
      <span className='text-muted-foreground shrink-0 pt-0.5 text-[0.8125rem] font-semibold tracking-[0.06em] sm:w-[58px]'>
        {props.label}
      </span>
      <div className='flex min-w-0 flex-1 flex-wrap gap-[7px]'>
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
  const quotaTypeLabels = getQuotaTypeLabels(t)
  const endpointTypeLabels = getEndpointTypeLabels(t)

  const counts = useMemo(() => {
    const vendors = new Map<string, number>()
    const tags = new Map<string, number>()
    const endpoints = new Map<string, number>()
    const quotas = { token: 0, request: 0, task: 0 }
    for (const model of props.models) {
      if (model.vendor_name) {
        vendors.set(
          model.vendor_name,
          (vendors.get(model.vendor_name) ?? 0) + 1
        )
      }
      for (const tag of new Set(
        parseTags(model.tags).map((tag) => tag.toLowerCase())
      )) {
        tags.set(tag, (tags.get(tag) ?? 0) + 1)
      }
      for (const endpoint of new Set(model.supported_endpoint_types ?? [])) {
        endpoints.set(endpoint, (endpoints.get(endpoint) ?? 0) + 1)
      }
      if (hasTaskUsageSchema(model)) {
        quotas.task++
      } else if (model.quota_type === 0) {
        quotas.token++
      } else if (model.quota_type === 1) {
        quotas.request++
      }
    }
    return { vendors, tags, endpoints, quotas }
  }, [props.models])

  const activeChips: Array<{
    key: string
    label: string
    onRemove: () => void
  }> = []
  if (props.groupFilter !== FILTER_ALL) {
    activeChips.push({
      key: 'group',
      label: `${t('Groups')}: ${props.groupFilter}`,
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
  if (props.tagFilter !== FILTER_ALL) {
    activeChips.push({
      key: 'tag',
      label: `${t('Model Tags')}: ${props.tagFilter}`,
      onRemove: () => props.onTagChange(FILTER_ALL),
    })
  }
  if (props.quotaTypeFilter !== QUOTA_TYPES.ALL) {
    activeChips.push({
      key: 'quota',
      label: labelFor(quotaTypeLabels, props.quotaTypeFilter),
      onRemove: () => props.onQuotaTypeChange(QUOTA_TYPES.ALL),
    })
  }
  if (props.endpointTypeFilter !== ENDPOINT_TYPES.ALL) {
    activeChips.push({
      key: 'endpoint',
      label: labelFor(endpointTypeLabels, props.endpointTypeFilter),
      onRemove: () => props.onEndpointTypeChange(ENDPOINT_TYPES.ALL),
    })
  }

  const endpointEntries = Object.entries(endpointTypeLabels).filter(
    ([value]) => value !== ENDPOINT_TYPES.ALL
  )

  return (
    <aside
      aria-label={t('Filter')}
      className={cn('bg-card rounded-xl border px-[18px] py-3.5', props.className)}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <SearchBar
          value={props.searchInput}
          onChange={props.onSearchChange}
          onClear={props.onClearSearch}
          placeholder={t('Search model name, provider, endpoint, or tag...')}
          className='max-w-[420px] min-w-0 flex-[1_1_320px]'
        />
        <div className='flex items-center gap-3.5'>
          {props.hasActiveFilters && (
            <Button
              type='button'
              variant='link'
              onClick={props.onClearFilters}
              className='h-auto p-1 text-sm font-semibold'
            >
              {t('Clear filters')}
            </Button>
          )}
        </div>
      </div>

      <FilterRow label={t('Groups')}>
        <Chip
          label={t('All Groups')}
          active={props.groupFilter === FILTER_ALL}
          onClick={() => props.onGroupChange(FILTER_ALL)}
        />
        {props.groups.map((group) => (
          <Chip
            key={group}
            label={group}
            suffix={formatGroupRatio(props.groupRatios?.[group])}
            active={props.groupFilter === group}
            onClick={() => props.onGroupChange(group)}
          />
        ))}
      </FilterRow>

      <FilterRow label={t('Provider')}>
        <Chip
          label={t('All Vendors')}
          count={props.models.length}
          active={props.vendorFilter === FILTER_ALL}
          onClick={() => props.onVendorChange(FILTER_ALL)}
        />
        {props.vendors.map((vendor) => {
          const count = counts.vendors.get(vendor.name) ?? 0
          if (count === 0) return null
          return (
            <Chip
              key={vendor.name}
              label={vendor.name}
              count={count}
              icon={vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined}
              active={props.vendorFilter === vendor.name}
              onClick={() => props.onVendorChange(vendor.name)}
            />
          )
        })}
      </FilterRow>

      <FilterRow label={t('Model Tags')}>
        <Chip
          label={t('All Tags')}
          count={props.models.length}
          active={props.tagFilter === FILTER_ALL}
          onClick={() => props.onTagChange(FILTER_ALL)}
        />
        {props.tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            count={counts.tags.get(tag.toLowerCase()) ?? 0}
            active={props.tagFilter === tag}
            onClick={() => props.onTagChange(tag)}
          />
        ))}
      </FilterRow>

      <FilterRow label={t('Pricing Type')}>
        {Object.entries(quotaTypeLabels).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            active={props.quotaTypeFilter === value}
            onClick={() => props.onQuotaTypeChange(value)}
          />
        ))}
      </FilterRow>

      <FilterRow label={t('Endpoint Type')}>
        {endpointEntries.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            count={counts.endpoints.get(value) ?? 0}
            active={props.endpointTypeFilter === value}
            onClick={() => props.onEndpointTypeChange(value)}
          />
        ))}
      </FilterRow>

      {activeChips.length > 0 && (
        <div className='border-[var(--hairline)] mt-4 flex flex-wrap items-center gap-2.5 border-t pt-4'>
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
