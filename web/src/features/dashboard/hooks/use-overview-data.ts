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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getUserQuotaDates } from '@/features/dashboard/api'
import { getAllLogs, getUserLogs } from '@/features/usage-logs/api'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import {
  formatLogQuota,
  formatNumber,
  formatQuota,
  formatTimeStr,
} from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Window the overview reports on. The KPI row, the model-share donut and the
 * recent-calls table all read from this single window; only the trend chart
 * narrows it (7 or 30 days), so the page never shows two contradictory totals.
 */
export const OVERVIEW_RANGE_DAYS = 30
const RECENT_CALL_LIMIT = 8
/** Series beyond this are folded into the neutral "Other / Unknown" slice. */
const SLICE_LIMIT = 6
/** Period-over-period delta: the last N days against the N days before them. */
const DELTA_WINDOW_DAYS = 7

export interface OverviewPoint {
  key: string
  label: string
  requests: number
}

export interface OverviewSlice {
  key: string
  name: string
  count: number
  percent: number
}

export interface OverviewRow {
  id: number
  time: string
  model: string
  token: string
  tokens: string
  cost: string
  ok: boolean
  statusLabel: string
}

export interface OverviewDelta {
  value: string
  direction: 'up' | 'down' | 'flat'
}

export interface OverviewData {
  loading: boolean
  hasData: boolean
  balanceDisplay: string
  spendDisplay: string
  requestsDisplay: string
  spendDelta: OverviewDelta
  requestsDelta: OverviewDelta
  balanceTrend: number[]
  spendTrend: number[]
  requestsTrend: number[]
  dailyPoints: OverviewPoint[]
  totalRequests: number
  slices: OverviewSlice[]
  rows: OverviewRow[]
}

interface DailyBucket {
  key: string
  label: string
  requests: number
  quota: number
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Bucket key + axis label for a timestamp, in the viewer's local timezone —
 * the same granularity `default_time: 'day'` asks the backend for.
 */
function dayBucket(timestamp: number): { key: string; label: string } {
  const date = new Date(timestamp * 1000)
  return {
    key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    label: `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
  }
}

function directionOf(change: number): OverviewDelta['direction'] {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'flat'
}

/**
 * Last N days against the N days before them. Returns a flat, empty marker when
 * the baseline is missing, so we never print an invented percentage.
 */
function periodDelta(
  buckets: DailyBucket[],
  pick: (bucket: DailyBucket) => number
): OverviewDelta {
  const length = buckets.length
  if (length < DELTA_WINDOW_DAYS * 2) return { value: '', direction: 'flat' }

  const recent = buckets
    .slice(length - DELTA_WINDOW_DAYS)
    .reduce((total, bucket) => total + pick(bucket), 0)
  const previous = buckets
    .slice(length - DELTA_WINDOW_DAYS * 2, length - DELTA_WINDOW_DAYS)
    .reduce((total, bucket) => total + pick(bucket), 0)
  if (previous <= 0) return { value: '', direction: 'flat' }

  const change = ((recent - previous) / previous) * 100
  let sign = ''
  if (change > 0) sign = '+'
  else if (change < 0) sign = '−'
  return {
    value: `${sign}${Math.abs(change).toFixed(1)}%`,
    direction: directionOf(change),
  }
}

function buildDailyBuckets(
  items: { created_at: number; count?: number; quota?: number }[]
): DailyBucket[] {
  const map = new Map<string, DailyBucket>()
  for (const item of items) {
    const timestamp = Number(item.created_at)
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue
    const { key, label } = dayBucket(timestamp)
    const bucket = map.get(key) ?? { key, label, requests: 0, quota: 0 }
    bucket.requests += Number(item.count) || 0
    bucket.quota += Number(item.quota) || 0
    map.set(key, bucket)
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
}

function buildSlices(
  items: { model_name?: string; count?: number }[],
  totalRequests: number,
  otherLabel: string
): OverviewSlice[] {
  const byModel = new Map<string, number>()
  for (const item of items) {
    const name = item.model_name?.trim() ?? ''
    byModel.set(name, (byModel.get(name) ?? 0) + (Number(item.count) || 0))
  }

  const ranked = [...byModel.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
  if (!ranked.length) return []

  const toSlice = (
    name: string,
    count: number,
    index: number
  ): OverviewSlice => ({
    key: name || `other-${index}`,
    name: name || otherLabel,
    count,
    percent: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
  })

  if (ranked.length <= SLICE_LIMIT) {
    return ranked.map(([name, count], index) => toSlice(name, count, index))
  }

  // Never invent an 8th colour: fold the tail into the neutral catch-all.
  const head = ranked.slice(0, SLICE_LIMIT - 1)
  const tail = ranked
    .slice(SLICE_LIMIT - 1)
    .reduce((total, [, count]) => total + count, 0)
  return [
    ...head.map(([name, count], index) => toSlice(name, count, index)),
    {
      key: 'other',
      name: otherLabel,
      count: tail,
      percent: totalRequests > 0 ? (tail / totalRequests) * 100 : 0,
    },
  ]
}

function toRow(
  log: UsageLog,
  successLabel: string,
  failedLabel: string
): OverviewRow {
  const ok = log.type !== LOG_TYPE_ENUM.ERROR
  return {
    id: log.id,
    time: formatTimeStr(new Date(log.created_at * 1000)),
    model: log.model_name || '—',
    token: log.token_name || '—',
    tokens: `${formatNumber(log.prompt_tokens)} → ${formatNumber(log.completion_tokens)}`,
    cost: formatLogQuota(log.quota),
    ok,
    statusLabel: ok ? successLabel : failedLabel,
  }
}

/**
 * Single source of truth for the overview page.
 *
 * `hasData` is what switches the page between the analytics layout and the
 * first-run guide, and it is driven by real data: the request count summed from
 * `/api/data/self` — the same rows the trend chart and the donut read — with the
 * recent-calls list as a second signal so an instance that only just started
 * routing still counts as "has data".
 */
export function useOverviewData(): OverviewData {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const range = useMemo(
    () => computeTimeRange(OVERVIEW_RANGE_DAYS, undefined, undefined, true),
    []
  )

  const quotaQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'quota',
      range.start_timestamp,
      range.end_timestamp,
      isAdmin,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({ ...range, default_time: 'day' }, isAdmin)
      ),
    staleTime: 60 * 1000,
  })

  const logsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'recent-calls', isAdmin],
    queryFn: async () =>
      requireServerSuccess(
        isAdmin
          ? await getAllLogs({ p: 1, page_size: RECENT_CALL_LIMIT })
          : await getUserLogs({ p: 1, page_size: RECENT_CALL_LIMIT })
      ),
    staleTime: 60 * 1000,
  })


  return useMemo<OverviewData>(() => {
    const items = quotaQuery.data?.data ?? []
    const logs = logsQuery.data?.data?.items ?? []

    const totalRequests = items.reduce(
      (total, item) => total + (Number(item.count) || 0),
      0
    )
    const totalQuota = items.reduce(
      (total, item) => total + (Number(item.quota) || 0),
      0
    )

    const buckets = buildDailyBuckets(items)
    const dailyPoints: OverviewPoint[] = buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      requests: bucket.requests,
    }))

    // Balance walked backwards from today's remaining credit.
    const balance = Number(user?.quota ?? 0)
    const balanceTrend: number[] = Array.from(
      { length: buckets.length },
      () => 0
    )
    let running = balance
    for (let i = buckets.length - 1; i >= 0; i--) {
      balanceTrend[i] = Math.max(0, running)
      running += buckets[i].quota
    }


    return {
      loading: quotaQuery.isLoading || logsQuery.isLoading,
      hasData: totalRequests > 0 || logs.length > 0,
      // These two are monetary figures inside a data display, not glanceable
      // quota readouts, so they keep their cents: $42.80, not $42.8.
      balanceDisplay: formatQuota(balance, { keepTrailingZeros: true }),
      spendDisplay: formatQuota(totalQuota, { keepTrailingZeros: true }),
      requestsDisplay: formatNumber(totalRequests),
      spendDelta: periodDelta(buckets, (bucket) => bucket.quota),
      requestsDelta: periodDelta(buckets, (bucket) => bucket.requests),
      balanceTrend,
      spendTrend: buckets.map((bucket) => bucket.quota),
      requestsTrend: buckets.map((bucket) => bucket.requests),
      dailyPoints,
      totalRequests,
      slices: buildSlices(items, totalRequests, t('Other / Unknown')),
      rows: logs.map((log) => toRow(log, t('Success'), t('Failed'))),
    }
  }, [
    logsQuery.data,
    logsQuery.isLoading,
    quotaQuery.data,
    quotaQuery.isLoading,
    t,
    user?.quota,
  ])
}
