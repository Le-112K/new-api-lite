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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'

import {
  EmptyState,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { PricingFilterBar } from './components/pricing-filter-bar'
import { EXCLUDED_GROUPS, FILTER_ALL } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import { buildGroupLabels } from './lib/group-labels'

/** Stable keys for the loading grid — one per card slot, never an index. */
const CARD_PLACEHOLDERS = [
  'slot-1',
  'slot-2',
  'slot-3',
  'slot-4',
  'slot-5',
  'slot-6',
  'slot-7',
  'slot-8',
] as const

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const { models, vendors, usableGroup, endpointMap, subscriptionPlans, isLoading } =
    usePricingData()

  const {
    vendorFilter,
    groupFilter,
    setVendorFilter,
    setGroupFilter,
    filteredModels,
    hasActiveFilters,
    clearFilters,
  } = useFilters(models || [])

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  // Group key -> label for each card's plan pills. Shared with the admin model
  // list so both sides print the same plan names.
  const groupLabels = useMemo(
    () => buildGroupLabels(usableGroup, subscriptionPlans),
    [usableGroup, subscriptionPlans]
  )

  const appliedPlanLabel =
    groupFilter !== FILTER_ALL
      ? (groupLabels[groupFilter] ?? groupFilter)
      : undefined

  const handleClearAll = useCallback(() => {
    clearFilters()
  }, [clearFilters])

  const renderPricingContent = () => {
    if (filteredModels.length === 0) {
      return (
        <EmptyState
          appliedPlanLabel={appliedPlanLabel}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    return (
      <ModelCardGrid
        models={filteredModels}
        onModelClick={handleModelClick}
        groupLabels={groupLabels}
      />
    )
  }

  if (isLoading) {
    // Frame-preserving placeholder. The old spinner swapped a whole page for
    // a single line of text, so the layout jumped twice: once into the void,
    // once back. Keeping the title and the two filter rows in place means the
    // cards only have to fill their own slots when the data lands.
    return (
      <PublicLayout
        showMainContainer={false}
        headerProps={{ variant: 'landing' }}
        wrapperClassName='bg-white dark:bg-[#0a0a0a]'
      >
        <div
          className='relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'
          aria-busy='true'
        >
          <header className='pt-5 text-center sm:pt-8'>
            <h1 className='text-foreground text-[clamp(1.75rem,2.6vw,2.25rem)] leading-tight font-bold'>
              {t('Model Square')}
            </h1>
          </header>

          <div className='space-y-3 pt-8'>
            {[
              ['tier-a', 'tier-b', 'tier-c', 'tier-d'],
              ['vendor-a', 'vendor-b', 'vendor-c', 'vendor-d', 'vendor-e'],
            ].map((row) => (
              <div key={row[0]} className='flex flex-wrap items-center gap-2'>
                <div className='bg-muted mr-1 h-3.5 w-14 rounded' />
                {row.map((chip) => (
                  <div
                    key={chip}
                    className='bg-muted h-9 w-[4.5rem] rounded-full'
                  />
                ))}
              </div>
            ))}
          </div>

          <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3 pt-8 sm:gap-4'>
            {CARD_PLACEHOLDERS.map((slot) => (
              <div
                key={slot}
                className='border-border bg-card min-h-[172px] rounded-2xl border'
              />
            ))}
          </div>

          <span className='sr-only'>{t('Loading...')}</span>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout
      showMainContainer={false}
      headerProps={{ variant: 'landing' }}
      wrapperClassName='bg-white dark:bg-[#0a0a0a]'
    >
      <PageTransition className='relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
        <header className='pt-5 text-center sm:pt-8'>
          <h1 className='text-foreground text-[clamp(1.75rem,2.6vw,2.25rem)] leading-tight font-bold'>
            {t('Model Square')}
          </h1>
        </header>

        <div className='pt-8'>
          <PricingFilterBar
            groupFilter={groupFilter}
            vendorFilter={vendorFilter}
            onGroupChange={setGroupFilter}
            onVendorChange={setVendorFilter}
            vendors={vendors || []}
            groups={availableGroups}
            groupLabels={groupLabels}
            models={models || []}
            subscriptionPlans={subscriptionPlans}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </div>

        <section className='pt-8 pb-10'>{renderPricingContent()}</section>

        {selectedModel && (
          <ModelDetailsDrawer
            open={Boolean(selectedModel)}
            onOpenChange={(open) => {
              if (!open) setSelectedModelName(null)
            }}
            model={selectedModel}
            usableGroup={usableGroup || {}}
            endpointMap={
              (endpointMap as Record<
                string,
                { path?: string; method?: string }
              >) || {}
            }
            groupLabels={groupLabels}
          />
        )}
      </PageTransition>
    </PublicLayout>
  )
}
