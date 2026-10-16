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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useModelStatCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import {
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
} from '@/features/dashboard/lib'
import type {
  QuotaDataItem,
  DashboardFilters,
} from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange, formatChartTime, type TimeGranularity } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { StatCard } from '../ui/stat-card'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
}

const MAX_INLINE_STAT_CHARS = 9
/** Sparkline window: the last N time buckets of the fetched rows. */
const SPARKLINE_POINTS = 12

function formatStatNumber(value: number, locale: Intl.LocalesArgument) {
  const fullValue = formatNumber(value, locale)
  const displayValue =
    fullValue.length > MAX_INLINE_STAT_CHARS
      ? formatCompactNumber(value, locale)
      : fullValue

  return {
    displayValue,
    fullValue,
  }
}

/**
 * The cards carry NO period-over-period trend (this section has no previous
 * window to compare against), so the foot row shows a sparkline instead — the
 * same shape the console overview's KPIs draw. The series is bucketed from the
 * very rows the KPI totals are summed from, so the two can never disagree.
 */
function buildSparklines(
  rows: QuotaDataItem[],
  granularity: TimeGranularity
): { count: number[]; quota: number[]; tokens: number[] } {
  const buckets = new Map<
    string,
    { ts: number; count: number; quota: number; tokens: number }
  >()

  for (const row of rows) {
    const ts = Number(row.created_at) || 0
    if (!ts) continue
    const key = formatChartTime(ts, granularity)
    const bucket = buckets.get(key) ?? { ts, count: 0, quota: 0, tokens: 0 }
    bucket.ts = Math.min(bucket.ts, ts)
    bucket.count += Number(row.count) || 0
    bucket.quota += Number(row.quota) || 0
    bucket.tokens += Number(row.token_used) || 0
    buckets.set(key, bucket)
  }

  const tail = [...buckets.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-SPARKLINE_POINTS)

  return {
    count: tail.map((bucket) => bucket.count),
    quota: tail.map((bucket) => bucket.quota),
    tokens: tail.map((bucket) => bucket.tokens),
  }
}

/** Which sparkline a metric renders. Rates mirror the series they are derived from. */
const SERIES_BY_KEY: Record<string, 'count' | 'quota' | 'tokens'> = {
  count: 'count',
  quota: 'quota',
  tokens: 'tokens',
  avgRpm: 'count',
  avgTpm: 'tokens',
}

export function LogStatCards(props: LogStatCardsProps) {
  const { i18n } = useTranslation()
  const statCardsConfig = useModelStatCardsConfig()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = !!(user?.role && user.role >= 10)
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<QuotaDataItem[]>([])

  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)

  const filters = props.filters
  const onDataUpdate = props.onDataUpdate

  useEffect(() => {
    const abortController = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    setError(false)
    onDataUpdate?.([], true)

    const timeRange = computeTimeRange(
      getDefaultDays(filters?.time_granularity),
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const timeDiff = (timeRange.end_timestamp - timeRange.start_timestamp) / 60
    setTimeRangeMinutes(timeDiff)

    void getUserQuotaDates(buildQueryParams(timeRange, filters), isAdmin)
      .then((res) => {
        if (abortController.signal.aborted) return
        const data = res?.data || []
        setStats(calculateDashboardStats(data))
        setRows(data)
        onDataUpdate?.(data, false)
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setStats(null)
        setRows([])
        setError(true)
        onDataUpdate?.([], false)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [filters, isAdmin, onDataUpdate])

  const adaptedStats = {
    rpm: stats?.totalCount ?? 0,
    quota: stats?.totalQuota ?? 0,
    tpm: stats?.totalTokens ?? 0,
  }

  const granularity = filters?.time_granularity ?? DEFAULT_TIME_GRANULARITY
  const sparklines = useMemo(
    () => buildSparklines(rows, granularity),
    [rows, granularity]
  )

  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const items = statCardsConfig.map((config) => {
    const rawValue = config.getValue(adaptedStats, timeRangeMinutes)
    const formatted =
      config.key === 'quota'
        ? {
            displayValue: formatQuota(rawValue),
            fullValue: formatQuota(rawValue),
          }
        : formatStatNumber(rawValue, locale)

    return {
      key: config.key,
      title: config.title,
      value: formatted.displayValue,
      valueTitle: formatted.fullValue,
      description: config.description,
      icon: config.icon,
      sparkline: sparklines[SERIES_BY_KEY[config.key] ?? 'count'],
    }
  })

  return (
    <CardStaggerContainer className='grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5'>
      {items.map((item) => (
        <CardStaggerItem
          key={item.key}
          className='bg-card h-full rounded-2xl border p-4 shadow-xs'
        >
          <StatCard
            title={item.title}
            value={item.value}
            valueTitle={item.valueTitle}
            description={item.description}
            icon={item.icon}
            iconTone='neutral'
            sparkline={item.sparkline}
            sparklineVariant='line'
            loading={loading}
            error={error}
          />
        </CardStaggerItem>
      ))}
    </CardStaggerContainer>
  )
}
