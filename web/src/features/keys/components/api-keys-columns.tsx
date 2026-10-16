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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { useMediaQuery } from '@/hooks'
import { getUserGroups } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import type { ApiKey } from '../types'
import { ApiKeyGroupCell } from './api-key-group-cell'
import { ApiKeyQuotaCell } from './api-key-quota-cell'
import { ApiKeyStatusPill } from './api-key-status-pill'
import { ApiKeyActivityCell } from './api-key-timestamp-cell'
import {
  ApiKeyCell,
  IpRestrictionsCell,
  ModelLimitsCell,
} from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

const EMPTY_GROUP_RATIOS: Record<string, number | string> = {}

export function useGroupRatios(): Record<string, number | string> {
  const { data } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    staleTime: 0,
    select: (res) => {
      if (!res.success || !res.data) return {}
      const ratios: Record<string, number | string> = {}
      for (const [group, info] of Object.entries(res.data)) {
        if (typeof info.ratio === 'number' || typeof info.ratio === 'string') {
          ratios[group] = info.ratio
        }
      }
      return ratios
    },
  })

  return data ?? EMPTY_GROUP_RATIOS
}

/**
 * Columns for the keys table, ordered the way the console design reads them:
 * identity → credential → budget → scope → dates → state → actions.
 *
 * `group`, `allow_ips` and `activity_time` are kept but default to hidden: the
 * approved design's card shows seven columns, yet the previous page surfaced
 * group, IP restrictions and created/last-used. Nothing was cut — the three are
 * one click away in the column chooser (see `api-keys-table.tsx`).
 */
export function useApiKeysColumns(now: number): ColumnDef<ApiKey>[] {
  const { t } = useTranslation()
  const groupRatios = useGroupRatios()
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  return useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ table }) => (
          <div className='flex min-w-0 items-center gap-2.5'>
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label={t('Select all')}
              className='translate-y-[1px]'
            />
            <span className='truncate'>{t('Name')}</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className='flex min-w-0 items-center gap-2.5'>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={t('Select row')}
              className='translate-y-[1px]'
            />
            <span className='truncate font-semibold'>{row.getValue('name')}</span>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 190,
        meta: { mobileTitle: true },
      },
      {
        id: 'key',
        accessorKey: 'key',
        header: () => t('API Key'),
        cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
        enableSorting: false,
        size: 180,
      },
      {
        id: 'quota',
        accessorKey: 'remain_quota',
        header: () => t('Quota'),
        cell: ({ row }) => <ApiKeyQuotaCell apiKey={row.original} now={now} />,
        size: 190,
        minSize: 180,
      },
      {
        id: 'model_limits',
        accessorKey: 'model_limits',
        header: () => t('Models'),
        cell: ({ row }) => <ModelLimitsCell apiKey={row.original} />,
        enableSorting: false,
        size: 190,
      },
      {
        accessorKey: 'group',
        header: () => t('Group'),
        cell: ({ row }) => {
          const apiKey = row.original
          const group = row.getValue('group') as string
          return (
            <ApiKeyGroupCell
              group={group}
              ratio={groupRatios[group]}
              crossGroupRetry={apiKey.cross_group_retry}
              shouldReduceMotion={shouldReduceMotion}
            />
          )
        },
        size: 180,
        meta: { mobileHidden: true },
      },
      {
        id: 'allow_ips',
        accessorKey: 'allow_ips',
        header: () => t('IP Restriction'),
        cell: ({ row }) => <IpRestrictionsCell apiKey={row.original} />,
        enableSorting: false,
        size: 180,
        meta: { mobileHidden: true },
      },
      {
        id: 'activity_time',
        accessorKey: 'created_time',
        header: () => t('Time'),
        cell: ({ row }) => (
          <ApiKeyActivityCell apiKey={row.original} now={now} />
        ),
        size: 200,
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'expired_time',
        header: () => t('Expires'),
        cell: ({ row }) => {
          const expiredTime = row.getValue('expired_time') as number
          if (expiredTime === -1) {
            return (
              <span className='text-muted-foreground text-xs'>
                {t('Never')}
              </span>
            )
          }
          const isPast = expiredTime * 1000 <= now
          const absolute = new Date(expiredTime * 1000)
          return (
            <time
              dateTime={absolute.toISOString()}
              title={`${formatTimestampToDate(expiredTime)}`}
              className={cn(
                'text-xs whitespace-nowrap tabular-nums',
                isPast
                  ? 'text-[var(--destructive-text)]'
                  : 'text-muted-foreground'
              )}
            >
              {dayjs(expiredTime * 1000).format('YYYY-MM-DD')}
            </time>
          )
        },
        size: 130,
      },
      {
        accessorKey: 'status',
        header: () => t('Status'),
        cell: ({ row }) => (
          <ApiKeyStatusPill status={row.getValue('status') as number} />
        ),
        filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
        size: 130,
        meta: { mobileBadge: true },
      },
      {
        id: 'actions',
        header: () => <span className='block text-right'>{t('Actions')}</span>,
        cell: ({ row }) => <DataTableRowActions row={row} />,
        enableHiding: false,
        size: 220,
        meta: { pinned: 'right' as const },
      },
    ],
    [t, now, groupRatios, shouldReduceMotion]
  )
}
