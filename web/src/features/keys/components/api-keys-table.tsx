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
import { getRouteApi } from '@tanstack/react-router'
import {
  flexRender,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DISABLED_ROW_MOBILE,
  DataTableViewOptions,
  useDebouncedColumnFilter,
  useDataTable,
} from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getApiKeys, searchApiKeys } from '../api'
import {
  API_KEY_STATUS,
  API_KEY_STATUS_OPTIONS,
  API_KEY_STATUSES,
  ERROR_MESSAGES,
} from '../constants'
import type { ApiKey } from '../types'
import { ApiKeysConsole } from './api-keys-console'
import { ApiKeyGroupCell } from './api-key-group-cell'
import { ApiKeyQuotaCell } from './api-key-quota-cell'
import { ApiKeyActivityCell } from './api-key-timestamp-cell'
import {
  ApiKeyCell,
  IpRestrictionsCell,
  ModelLimitsCell,
} from './api-keys-cells'
import { useApiKeysColumns, useGroupRatios } from './api-keys-columns'
import { useApiKeys } from './api-keys-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { DataTableRowActions } from './data-table-row-actions'

const route = getRouteApi('/_authenticated/keys/')
const API_KEYS_COLUMN_VISIBILITY_STORAGE_KEY = 'api-keys:column-visibility'
const API_KEYS_MOBILE_SKELETON_IDS = Array.from(
  { length: 5 },
  (_, index) => `api-key-mobile-skeleton-${index + 1}`
)

/**
 * Columns that existed before the console redraw but that the approved design's
 * seven-column card has no room for. They are hidden, not removed: the toolbar's
 * column chooser (`DataTableViewOptions`) turns them back on per user, and the
 * choice persists in localStorage like every other table on the site.
 */
const DEFAULT_HIDDEN_COLUMNS = {
  group: false,
  allow_ips: false,
  activity_time: false,
}

function isDisabledApiKeyRow(apiKey: ApiKey) {
  return apiKey.status !== API_KEY_STATUS.ENABLED
}

function CreateKeyButton() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  return (
    <Button size='sm' onClick={() => setOpen('create')}>
      <Plus className='size-4' />
      {t('Create API Key')}
    </Button>
  )
}

function ApiKeysMobileSkeleton() {
  return (
    <div className='min-w-0 space-y-3'>
      {API_KEYS_MOBILE_SKELETON_IDS.map((id) => (
        <div
          key={id}
          className='border-border/60 bg-card space-y-2 rounded-xl border p-3.5'
        >
          <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-7 w-44' />
            <Skeleton className='h-8 w-16' />
          </div>
          <Skeleton className='h-3 w-28' />
        </div>
      ))}
    </div>
  )
}

/**
 * Mobile cards keep the full information set the previous page showed — group,
 * models, IP restrictions, created/last-used and expiry — even though the
 * desktop card hides the first four behind the column chooser. On a phone there
 * is no column chooser to reach for, so nothing is withheld here.
 */
function ApiKeysMobileList({
  table,
  isLoading,
  now,
}: {
  table: TanstackTable<ApiKey>
  isLoading: boolean
  now: number
}) {
  const { t } = useTranslation()
  const groupRatios = useGroupRatios()
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const rows = table.getRowModel().rows

  if (isLoading) return <ApiKeysMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='bg-card rounded-2xl border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Search className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No API Keys Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No API keys available. Create your first API key to get started.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='min-w-0 space-y-3'>
      {rows.map((row) => {
        const apiKey = row.original
        const statusConfig = API_KEY_STATUSES[apiKey.status]
        const expiryCell = row
          .getAllCells()
          .find((cell) => cell.column.id === 'expired_time')

        return (
          <div
            key={row.id}
            className={cn(
              'border-border/60 bg-card min-w-0 space-y-2 rounded-xl border p-3.5 text-xs leading-4',
              isDisabledApiKeyRow(apiKey) && DISABLED_ROW_MOBILE
            )}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='text-sm leading-5 font-semibold break-words'>
                  {apiKey.name}
                </div>
              </div>
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.label)}
                  variant={statusConfig.variant}
                  copyable={false}
                  className='shrink-0 px-0 text-xs font-normal'
                />
              )}
            </div>

            <div className='flex min-w-0 items-center justify-between gap-2'>
              <div className='min-w-0 flex-1 [&_button:first-child]:max-w-full [&_button:first-child]:truncate [&_button:first-child]:px-0'>
                <ApiKeyCell apiKey={apiKey} />
              </div>
              <DataTableRowActions row={row} />
            </div>

            <div className='min-w-0 space-y-3 py-1'>
              <div className='min-w-0'>
                <ApiKeyGroupCell
                  group={apiKey.group ?? ''}
                  ratio={groupRatios[apiKey.group ?? '']}
                  crossGroupRetry={apiKey.cross_group_retry}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </div>
              <ApiKeyQuotaCell apiKey={apiKey} now={now} variant='card' />
            </div>

            <div className='flex flex-wrap items-center gap-x-5 gap-y-1'>
              <ModelLimitsCell apiKey={apiKey} detailsTrigger='click' />
              <IpRestrictionsCell apiKey={apiKey} detailsTrigger='click' />
            </div>

            <div className='grid grid-cols-3 items-start gap-3 border-t pt-2'>
              <div className='col-span-2 min-w-0'>
                <ApiKeyActivityCell
                  apiKey={apiKey}
                  now={now}
                  layout='columns'
                />
              </div>
              <div className='min-w-0 space-y-1 [&_[data-slot=status-badge]]:text-xs [&_[data-slot=status-badge]]:font-normal'>
                <div className='text-muted-foreground'>{t('Expires')}</div>
                {expiryCell &&
                  flexRender(
                    expiryCell.column.columnDef.cell,
                    expiryCell.getContext()
                  )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApiKeysToolbar({
  table,
  globalFilter,
  onGlobalFilterChange,
  tokenFilterInput,
  onTokenFilterInputChange,
  total,
}: {
  table: TanstackTable<ApiKey>
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  tokenFilterInput: string
  onTokenFilterInputChange: (value: string) => void
  total: number
}) {
  const { t } = useTranslation()
  const statusColumn = table.getColumn('status')
  const statusFilter = (
    statusColumn?.getFilterValue() as string[] | undefined
  )?.[0]
  const statusItems = [
    { value: 'all', label: t('All') },
    ...API_KEY_STATUS_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.label),
    })),
  ]

  return (
    <div className='flex flex-wrap items-center gap-2.5 px-4 pt-4 pb-4 sm:px-5'>
      <div className='relative w-full sm:w-[230px]'>
        <Search
          className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2'
          aria-hidden='true'
        />
        <Input
          value={globalFilter}
          onChange={(event) => onGlobalFilterChange(event.target.value)}
          placeholder={t('Filter by name...')}
          aria-label={t('Filter by name...')}
          className='h-9 pl-8'
        />
      </div>

      <Input
        value={tokenFilterInput}
        onChange={(event) => onTokenFilterInputChange(event.target.value)}
        placeholder={t('Filter by API key...')}
        aria-label={t('Filter by API key...')}
        className='h-9 w-full sm:w-[190px]'
      />

      <Select
        items={statusItems}
        value={statusFilter ?? 'all'}
        onValueChange={(value) =>
          statusColumn?.setFilterValue(value === 'all' ? undefined : [value])
        }
      >
        <SelectTrigger
          className='text-foreground h-9 w-[128px]'
          aria-label={t('Status')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <span className='flex-1' />

      <span className='text-muted-foreground text-xs tabular-nums'>
        {t('{{count}} keys', { count: total })}
      </span>
      <DataTableViewOptions table={table} />
    </div>
  )
}

export function ApiKeysTable() {
  const { t } = useTranslation()
  const { refreshTrigger } = useApiKeys()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [now, setNow] = useState(() => Date.now())
  const columns = useApiKeysColumns(now)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: '_tokenSearch', searchKey: 'token', type: 'string' },
    ],
  })

  const {
    value: tokenFilter,
    inputValue: tokenFilterInput,
    setInputValue: setTokenFilterInput,
  } = useDebouncedColumnFilter({
    columnFilters,
    columnId: '_tokenSearch',
    onColumnFiltersChange,
  })
  const shouldSearch = Boolean(globalFilter?.trim() || tokenFilter.trim())

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'keys',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      tokenFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = shouldSearch
        ? await searchApiKeys({
            keyword: globalFilter,
            token: tokenFilter,
            p: pagination.pageIndex + 1,
            size: pagination.pageSize,
          })
        : await getApiKeys({
            p: pagination.pageIndex + 1,
            size: pagination.pageSize,
          })

      if (!result.success) {
        throw createServerError(
          result,
          t(
            shouldSearch
              ? ERROR_MESSAGES.SEARCH_FAILED
              : ERROR_MESSAGES.LOAD_FAILED
          )
        )
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const apiKeys = data?.items || []
  const total = data?.total || 0

  const { table } = useDataTable({
    data: apiKeys,
    columns,
    enableRowSelection: true,
    initialColumnVisibility: DEFAULT_HIDDEN_COLUMNS,
    columnFilters,
    columnVisibilityStorageKey: API_KEYS_COLUMN_VISIBILITY_STORAGE_KEY,
    globalFilter,
    pagination,
    globalFilterFn: () => true,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    totalCount: total,
    ensurePageInRange,
  })

  if (isMobile) {
    return <ApiKeysMobileList table={table} isLoading={isLoading} now={now} />
  }

  return (
    <ApiKeysConsole
      table={table}
      total={total}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyAction={<CreateKeyButton />}
      toolbar={
        <ApiKeysToolbar
          table={table}
          total={total}
          globalFilter={globalFilter ?? ''}
          onGlobalFilterChange={(value) => onGlobalFilterChange?.(value)}
          tokenFilterInput={tokenFilterInput}
          onTokenFilterInputChange={setTokenFilterInput}
        />
      }
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
