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
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { Users, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTheme } from '@/context/theme-provider'
import { getUserQuotaDataByUsers } from '@/features/dashboard/api'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import { useConsoleChartTheme } from '@/features/dashboard/hooks/use-console-chart-theme'
import {
  getDefaultDays,
  saveGranularity,
  processUserChartData,
} from '@/features/dashboard/lib'
import { consoleOrdinalPalette } from '@/features/dashboard/lib/console-chart-colors'
import type {
  ProcessedUserChartData,
  UserChartsFilters,
} from '@/features/dashboard/types'
import { formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

import { PanelWrapper } from '../ui/panel-wrapper'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const USER_CHARTS: {
  value: string
  labelKey: string
  specKey: keyof ProcessedUserChartData
}[] = [
  {
    value: 'rank',
    labelKey: 'User Consumption Ranking',
    specKey: 'spec_user_rank',
  },
  {
    value: 'trend',
    labelKey: 'User Consumption Trend',
    specKey: 'spec_user_trend',
  },
]

const TOP_USER_LIMIT_OPTIONS = [5, 10, 20, 50]

interface UserChartsProps {
  filters: UserChartsFilters
  onFiltersChange: (filters: UserChartsFilters) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VChartSpec = Record<string, any>

function specValues(spec: VChartSpec): Array<Record<string, unknown>> {
  const values = spec?.data?.[0]?.values
  return Array.isArray(values) ? values : []
}

/** `axis.label` arrives as `unknown` from the untyped spec — widen it safely. */
function axisLabelRecord(axis: Record<string, unknown>): Record<string, unknown> {
  const label = axis.label
  return label && typeof label === 'object'
    ? (label as Record<string, unknown>)
    : {}
}

export function UserCharts(props: UserChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { tokens } = useConsoleChartTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  // The selection is owned by the dashboard parent so it persists across
  // sub-section switches; the rolling window is derived from the chosen range.
  const timeGranularity = props.filters.timeGranularity
  const selectedRange = props.filters.selectedRange
  const topUserLimit = props.filters.topUserLimit
  const onFiltersChange = props.onFiltersChange

  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(selectedRange)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  }, [selectedRange])

  const handleRangeChange = useCallback(
    (days: number) => {
      onFiltersChange({ ...props.filters, selectedRange: days })
    },
    [onFiltersChange, props.filters]
  )

  const handleGranularityChange = useCallback(
    (g: TimeGranularity) => {
      saveGranularity(g)
      onFiltersChange({
        ...props.filters,
        timeGranularity: g,
        selectedRange: getDefaultDays(g),
      })
    },
    [onFiltersChange, props.filters]
  )

  const handleTopUserLimitChange = useCallback(
    (limit: number) => {
      onFiltersChange({ ...props.filters, topUserLimit: limit })
    },
    [onFiltersChange, props.filters]
  )

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
  }, [resolvedTheme])

  const { data: userData, isLoading } = useQuery({
    queryKey: ['dashboard', 'user-quota', timeRange],
    queryFn: async () =>
      requireServerSuccess(await getUserQuotaDataByUsers(timeRange)),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const chartData = useMemo(
    () =>
      processUserChartData(
        isLoading ? [] : (userData ?? []),
        timeGranularity,
        t,
        topUserLimit
      ),
    [userData, isLoading, timeGranularity, t, topUserLimit]
  )

  /**
   * Re-skin only. `processUserChartData` (lib/charts.ts) keeps building the
   * series; we only replace the colours it hardcodes (its `USER_COLORS` ramp)
   * with the console token layer, and hide the in-chart title because the panel
   * header owns it now.
   *
   * · Ranking = one measure per user, ordered → a SINGLE hue from the ramp
   *   (`--cat-1`), matching the overview's one-hue trend/area chart.
   * · Trend = one series per user → the categorical ramp taken in order, with
   *   everything past the 7th folded into `--cat-7` (spec §2.4: never invent an
   *   8th hue).
   */
  const themedCharts = useMemo(() => {
    const rank = chartData.spec_user_rank as VChartSpec
    const trend = chartData.spec_user_trend as VChartSpec
    if (!tokens) {
      return {
        rank: { ...rank, title: { ...rank.title, visible: false } },
        trend: { ...trend, title: { ...trend.title, visible: false } },
        rankTotal: 0,
        seriesCount: 0,
      }
    }

    const primary = tokens.categorical[0]
    const rankValues = specValues(rank)
    const rankColors = Object.fromEntries(
      rankValues.map((row) => [String(row.User), primary])
    )
    const rankTotal = rankValues.reduce(
      (sum, row) => sum + (Number(row.rawQuota) || 0),
      0
    )

    const trendValues = specValues(trend)
    const seriesNames = [...new Set(trendValues.map((row) => String(row.User)))]
    const trendRange = consoleOrdinalPalette(tokens, seriesNames.length)

    return {
      rankTotal,
      seriesCount: seriesNames.length,
      rank: {
        ...rank,
        title: { ...rank.title, visible: false },
        color: { specified: rankColors },
        bar: {
          ...rank.bar,
          style: { fill: primary },
          state: { hover: { stroke: tokens.text, lineWidth: 1 } },
        },
        label: {
          ...rank.label,
          style: { ...rank.label?.style, fill: tokens.text3 },
        },
        axes: (rank.axes ?? []).map((axis: Record<string, unknown>) =>
          axis.orient === 'left'
            ? {
                ...axis,
                label: {
                  ...axisLabelRecord(axis),
                  style: { fill: tokens.text3 },
                },
              }
            : axis
        ),
      },
      trend: {
        ...trend,
        // Deliberate deviation from `processUserChartData`'s `type: 'area'`:
        // with up to ten series and `stack: false`, every area is filled from
        // zero, so the fills composite into an opaque mat and each later series
        // paints over the previous series' line — nothing is readable. A line
        // chart carries identical information (same series, legend, tooltip,
        // axes and window controls) and is the console's multi-series form
        // (spec §9.2: distinguish a line chart by colour + legend).
        type: 'line',
        title: { ...trend.title, visible: false },
        color: { type: 'ordinal', range: trendRange },
        line: { style: { lineWidth: 2 } },
        point: { visible: false },
        axes: (trend.axes ?? []).map((axis: Record<string, unknown>) => ({
          ...axis,
          label: { ...axisLabelRecord(axis), style: { fill: tokens.text3 } },
        })),
      },
    }
  }, [chartData, tokens])

  const chartReady = themeReady && tokens != null
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const emptyMessage = t('No usage in the selected range')
  const rankValues = specValues(chartData.spec_user_rank)
  const trendValues = specValues(chartData.spec_user_trend)
  const rankEmpty = !isLoading && (rankValues.length === 0 || themedCharts.rankTotal <= 0)
  const trendEmpty = !isLoading && trendValues.length === 0

  function renderBody(options: {
    chart: 'user-rank' | 'user-trend'
    spec: VChartSpec
    ariaLabel: string
    seriesCount?: number
    empty: boolean
  }) {
    if (isLoading) return <Skeleton className='h-full w-full' />
    if (options.empty) {
      return (
        <Empty className='h-full border-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Users />
            </EmptyMedia>
            {/* The panel header already names the chart, so the empty state
                carries the reason rather than repeating the title. */}
            <EmptyTitle>{emptyMessage}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )
    }
    if (!chartReady) return <Skeleton className='h-full w-full' />
    return (
      <div
        className='h-full w-full'
        role='img'
        aria-label={options.ariaLabel}
        data-chart={options.chart}
        data-series-count={options.seriesCount}
      >
        <VChart
          key={`${options.chart}-${topUserLimit}-${resolvedTheme}`}
          spec={{ ...options.spec, theme, background: 'transparent' }}
          option={VCHART_OPTION}
        />
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Time range')}
          </span>
          <Tabs
            value={String(selectedRange)}
            onValueChange={(value) => handleRangeChange(Number(value))}
            className='shrink-0'
          >
            <TabsList aria-label={t('Time range')}>
              {TIME_RANGE_PRESETS.map((preset) => (
                <TabsTrigger
                  key={preset.days}
                  value={String(preset.days)}
                  className='px-2.5 text-xs'
                >
                  {t(preset.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Granularity')}
          </span>
          <Tabs
            value={timeGranularity}
            onValueChange={(value) =>
              handleGranularityChange(value as TimeGranularity)
            }
            className='shrink-0'
          >
            <TabsList aria-label={t('Granularity')}>
              {TIME_GRANULARITY_OPTIONS.map((opt) => (
                <TabsTrigger
                  key={opt.value}
                  value={opt.value}
                  className='px-2.5 text-xs'
                >
                  {t(opt.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Top Users')}
          </span>
          <Tabs
            value={String(topUserLimit)}
            onValueChange={(value) => handleTopUserLimitChange(Number(value))}
            className='shrink-0'
          >
            <TabsList aria-label={t('Top Users')}>
              {TOP_USER_LIMIT_OPTIONS.map((limit) => (
                <TabsTrigger
                  key={limit}
                  value={String(limit)}
                  className='px-2.5 text-xs'
                >
                  {t('Top {{count}}', { count: limit })}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {isLoading && (
          <Loader2 className='text-muted-foreground mb-2 size-4 animate-spin' />
        )}
      </div>

      <div className='grid gap-4'>
        {USER_CHARTS.map((chart) => {
          const isRank = chart.value === 'rank'
          const spec = isRank
            ? themedCharts.rank
            : themedCharts.trend
          const ariaLabel = t(chart.labelKey)
          return (
            <PanelWrapper
              key={chart.value}
              title={
                <span className='flex min-w-0 items-center gap-2'>
                  <IconBadge tone='info' size='sm'>
                    <Users />
                  </IconBadge>
                  <span className='text-sm font-semibold'>{ariaLabel}</span>
                </span>
              }
              headerActions={
                isRank ? (
                  <span className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'>
                    {t('Total:')} {formatQuota(themedCharts.rankTotal)}
                  </span>
                ) : undefined
              }
              contentClassName='p-1.5 sm:p-2'
            >
              <div className='h-[300px] w-full sm:h-96'>
                {renderBody({
                  chart: isRank ? 'user-rank' : 'user-trend',
                  spec,
                  ariaLabel,
                  seriesCount: isRank ? undefined : themedCharts.seriesCount,
                  empty: isRank ? rankEmpty : trendEmpty,
                })}
              </div>
            </PanelWrapper>
          )
        })}
      </div>
    </div>
  )
}
