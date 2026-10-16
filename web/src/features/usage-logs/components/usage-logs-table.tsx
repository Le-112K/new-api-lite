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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { ColumnDef, Table } from '@tanstack/react-table'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  DataTablePagination,
  DataTableRow,
  useDataTable,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  getAdminPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  DEFAULT_LOGS_DATA,
  LOG_TYPE_ALL_VALUE,
  LOG_TYPE_ENUM,
} from '../constants'
import { shouldShowBillingSource } from '../lib/billing-source'
import { parseLogOther } from '../lib/format'
import { fetchUsageLogs, getDefaultTimeRange } from '../lib/utils'
import { useCommonLogsColumns } from './columns/common-logs-columns'
import { CommonLogsFilterBar } from './common-logs-filter-bar'
import { UsageLogsMobileList } from './usage-logs-mobile-card'
import { UsageLogsPageTotal } from './usage-logs-page-total'
import { useLogsViewScope, type LogsViewAccess } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

const logTypeRowTint: Record<number, string> = {
  [LOG_TYPE_ENUM.ERROR]: 'bg-rose-50/40 dark:bg-rose-950/20',
  [LOG_TYPE_ENUM.REFUND]: 'bg-blue-50/30 dark:bg-blue-950/15',
}

// Warning tint for logs where a quota conversion saturated (admin-only marker).
// Takes precedence over the per-type tint since it flags a billing anomaly.
const quotaSaturationRowTint = 'bg-amber-50/60 dark:bg-amber-950/25'

// Dense console table: 13px body, muted 12px header on the panel's hairline
// (design: small grey column labels, no zebra rows).
const usageTableFontClassName =
  '[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[12px] [&_[data-slot=table]_th]:font-semibold [&_[data-slot=table]_th]:text-muted-foreground [&_[data-slot=table]_th_*]:text-[12px]'

function getColumnVisibilityStorageKey(viewAccess: LogsViewAccess): string {
  return `usage-logs:common:${viewAccess}:column-visibility`
}

function deserializeLogTypeFilter(value: unknown): unknown[] {
  let values: unknown[] = []
  if (Array.isArray(value)) {
    values = value
  } else if (value) {
    values = [value]
  }
  return values.filter((item) => String(item) !== LOG_TYPE_ALL_VALUE)
}

export function UsageLogsTable(props: {
  /**
   * Hands the TanStack table instance to the page header so the "导出 CSV"
   * action can export exactly the rows on screen. The table lives here, the
   * button lives in the page head — this is the one wire between them.
   */
  onTableReady?: (table: Table<Record<string, unknown>>) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const getColumnClassName = useCallback(() => 'py-1.5', [])
  const {
    isAdminView: isAdmin,
    isRootView: isRoot,
    viewAccess,
  } = useLogsViewScope()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const searchParams = route.useSearch()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const { data: showBillingSource = false } = useQuery({
    queryKey: ['usage-log-billing-source', isAdmin, userId],
    enabled: userId != null,
    queryFn: async () => {
      if (isAdmin) {
        const plansResult = await getAdminPlans()
        return shouldShowBillingSource({
          isAdmin,
          plans: plansResult.success ? plansResult.data : undefined,
          subscriptions: undefined,
        })
      }

      const selfResult = await getSelfSubscriptionFull()
      return shouldShowBillingSource({
        isAdmin,
        plans: undefined,
        subscriptions: selfResult.success
          ? selfResult.data?.subscriptions
          : undefined,
      })
    },
  })

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 20 : 100 },
    globalFilter: { enabled: false },
    columnFilters: [
      {
        columnId: 'created_at',
        searchKey: 'type',
        type: 'array' as const,
        deserialize: deserializeLogTypeFilter,
      },
      { columnId: 'model_name', searchKey: 'model', type: 'string' as const },
      { columnId: 'token_name', searchKey: 'token', type: 'string' as const },
      { columnId: 'group', searchKey: 'group', type: 'string' as const },
      ...(isAdmin
        ? [
            {
              columnId: 'channel',
              searchKey: 'channel',
              type: 'string' as const,
            },
            {
              columnId: 'username',
              searchKey: 'username',
              type: 'string' as const,
            },
          ]
        : []),
    ],
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'logs',
      viewAccess,
      pagination.pageIndex + 1,
      pagination.pageSize,
      columnFilters,
      searchParams,
      t,
    ],
    queryFn: async () => {
      const result = await fetchUsageLogs({
        isAdmin,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchParams,
        columnFilters,
      })

      if (!result?.success) {
        throw createServerError(result, t('Failed to load logs'))
      }

      return result.data || DEFAULT_LOGS_DATA
    },
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery?.queryKey[1] === viewAccess) {
        return previousData
      }
      return undefined
    },
  })

  const logs = data?.items || []
  const columns = useCommonLogsColumns(isAdmin, isRoot, showBillingSource)
  const isLoadingData = isLoading || (isFetching && !data)

  const { table } = useDataTable({
    data: logs as Record<string, unknown>[],
    columns: columns as ColumnDef<Record<string, unknown>>[],
    columnFilters,
    columnVisibilityStorageKey: getColumnVisibilityStorageKey(viewAccess),
    pagination,
    enableRowSelection: false,
    onPaginationChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const onTableReady = props.onTableReady
  useEffect(() => {
    onTableReady?.(table)
  }, [onTableReady, table])

  // Empty-state CTA. Mirrors the filter bar's Reset so the always-visible
  // "重置" button and this button cannot drift apart.
  const handleClearFilters = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        page: 1,
        type: [LOG_TYPE_ALL_VALUE],
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [navigate, queryClient])

  // The design's `本页合计 / Page total` — summed from the rows on screen, so
  // the strip and the table can always be checked against each other.
  const pageRows = table.getRowModel().rows
  let pageInputTokens = 0
  let pageOutputTokens = 0
  let pageQuota = 0
  let pageSuccessCount = 0
  for (const row of pageRows) {
    const log = row.original
    pageInputTokens += Number(log.prompt_tokens) || 0
    pageOutputTokens += Number(log.completion_tokens) || 0
    pageQuota += Number(log.quota) || 0
    if (Number(log.type) === LOG_TYPE_ENUM.CONSUME) pageSuccessCount += 1
  }
  const showPageFooter = pageRows.length > 0

  return (
    <div className='bg-card shadow-xs flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border'>
      <DataTablePage
        table={table}
        columns={columns as ColumnDef<Record<string, unknown>>[]}
        isLoading={isLoadingData}
        isFetching={isFetching}
        emptyTitle={t('No Logs Found')}
        emptyDescription={t(
          'No usage logs available. Logs will appear here once API calls are made.'
        )}
        emptyAction={
          <Button type='button' variant='outline' onClick={handleClearFilters}>
            {t('Reset')}
          </Button>
        }
        skeletonKeyPrefix='usage-log-skeleton'
        applyHeaderSize
        // Pagination moves inside the panel (design's pager bar), so the shared
        // page-footer portal is not used here.
        showPagination={false}
        className='min-h-0 flex-1 gap-0'
        // The shared table draws its own rounded, bordered frame; inside the
        // console panel only the panel's chrome should show.
        tableClassName={cn('rounded-none border-0', usageTableFontClassName)}
        mobile={<UsageLogsMobileList table={table} isLoading={isLoadingData} />}
        toolbar={<CommonLogsFilterBar table={table} />}
        renderRow={(row) => {
          const logType = (row.original as Record<string, unknown>).type as
            | number
            | undefined
          let tintClass = logType != null ? (logTypeRowTint[logType] ?? '') : ''
          if (isAdmin) {
            const other = parseLogOther(
              ((row.original as Record<string, unknown>).other as string) ?? ''
            )
            if (other?.admin_info?.quota_saturation) {
              tintClass = quotaSaturationRowTint
            }
          }

          return (
            <DataTableRow
              key={row.id}
              row={row}
              className={cn('transition-colors', tintClass)}
              getColumnClassName={getColumnClassName}
              cellRenderColumns={table.options.columns}
            />
          )
        }}
      />

      {showPageFooter && (
        <UsageLogsPageTotal
          inputTokens={pageInputTokens}
          outputTokens={pageOutputTokens}
          quota={pageQuota}
          successCount={pageSuccessCount}
          rowCount={pageRows.length}
        />
      )}

      <div className='shrink-0 border-t px-4 py-2'>
        <DataTablePagination table={table} compact={isMobile} />
      </div>
    </div>
  )
}
