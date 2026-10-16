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
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useOverviewData } from '../../hooks/use-overview-data'
import { FirstRunGuide } from './first-run-guide'
import { ModelSharePanel } from './model-share-panel'
import { OverviewMetrics } from './overview-metrics'
import { RecentCallsPanel } from './recent-calls-panel'
import { UsageTrendPanel } from './usage-trend-panel'

/**
 * Trend-chart window. Only the trend narrows: the KPI row and the donut always
 * report the full 30-day window, so the page cannot contradict itself.
 */
const RANGE_OPTIONS = [7, 30] as const

function OverviewSkeleton() {
  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      <div className='grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className='bg-card flex flex-col gap-3 rounded-2xl border p-4'
          >
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-7 w-28' />
            <Skeleton className='h-8 w-full' />
          </div>
        ))}
      </div>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]'>
        <Skeleton className='h-[280px] w-full rounded-2xl' />
        <Skeleton className='h-[280px] w-full rounded-2xl' />
      </div>
      <Skeleton className='h-72 w-full rounded-2xl' />
    </div>
  )
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const data = useOverviewData()
  const [rangeDays, setRangeDays] = useState<number>(RANGE_OPTIONS[0])

  const trendPoints = useMemo(
    () =>
      data.dailyPoints.length <= rangeDays
        ? data.dailyPoints
        : data.dailyPoints.slice(-rangeDays),
    [data.dailyPoints, rangeDays]
  )

  const trendPanel = (
    <div className='grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]'>
      <UsageTrendPanel
        title={t('Usage trend')}
        subtitle={t('Daily aggregated requests')}
        loading={data.loading}
        points={trendPoints}
        emptyMessage={t('No usage in the selected range')}
      />
      <ModelSharePanel
        title={t('Model call share')}
        subtitle={t('Grouped by model, last 30 days')}
        loading={data.loading}
        total={data.totalRequests}
        totalLabel={t('Calls')}
        slices={data.slices}
        emptyMessage={t('No data available')}
      />
    </div>
  )

  const recentCallsPanel = (
    <RecentCallsPanel
      title={t('Recent calls')}
      subtitle={t('Last 8 requests')}
      loading={data.loading}
      columns={{
        time: t('Time'),
        model: t('Model'),
        token: t('Token'),
        tokens: t('Tokens'),
        cost: t('Cost'),
        status: t('Status'),
      }}
      rows={data.rows}
      viewAllLabel={t('View all')}
      viewAllTo='/usage-logs'
      emptyMessage={t('No data available')}
    />
  )

  const analytics = (
    <>
      <FadeIn>
        <OverviewMetrics data={data} />
      </FadeIn>
      <FadeIn delay={0.05}>{trendPanel}</FadeIn>
      <FadeIn delay={0.1}>{recentCallsPanel}</FadeIn>
    </>
  )

  // Analytics and the first-run guide are mutually exclusive. The swap is driven
  // purely by `hasData` — the request count summed from /api/data/self (plus the
  // recent-calls list) — never by a manual toggle.
  const showSkeleton = data.loading && !data.hasData
  let body: ReactNode
  if (showSkeleton) {
    body = <OverviewSkeleton />
  } else if (data.hasData) {
    body = analytics
  } else {
    body = (
      <FadeIn>
        <FirstRunGuide />
      </FadeIn>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Overview')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4 sm:gap-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='text-muted-foreground text-sm'>
              {t('Balance, usage trend, and recent calls.')}
            </p>
            {data.hasData && (
              <Tabs
                value={String(rangeDays)}
                onValueChange={(value) => setRangeDays(Number(value))}
              >
                <TabsList>
                  <TabsTrigger value='7'>{t('Last 7 days')}</TabsTrigger>
                  <TabsTrigger value='30'>{t('Last 30 days')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          {body}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
