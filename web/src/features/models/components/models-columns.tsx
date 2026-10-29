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
import { TriangleAlert } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { BadgeListCell, TruncatedCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatModelDisplayName } from '@/features/pricing/lib/model-display-name'
import { formatTimestampToDate } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'

import { getNameRuleConfig } from '../constants'
import {
  getModelMetadataCompleteness,
  MODEL_METADATA_FIELD_LABELS,
  parseModelTags,
  formatEndpointsDisplay,
} from '../lib'
import type { Model, Vendor } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { DescriptionCell } from './description-cell'
import { ModelSquareStatus } from './model-square-status'
import { useModels } from './models-provider'

const EMPTY_VENDORS: Vendor[] = []

export function useModelsColumns(
  vendors: Vendor[] = EMPTY_VENDORS,
  /** 分组 key → 订阅套餐标题。与模型广场卡片底部的套餐胶囊同源，
   *  保证后台看到的名字和用户看到的一致。 */
  planLabels: Record<string, string> = {}
): ColumnDef<Model>[] {
  const { t } = useTranslation()
  const { setCurrentRow, setOpen } = useModels()
  const vendorMap = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  )
  return useMemo<ColumnDef<Model>[]>(() => {
    const rules = getNameRuleConfig(t)
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
            aria-label={t('Select all')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label={t('Select {{name}}', { name: row.original.model_name })}
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'model_name',
        header: t('Model'),
        size: 260,
        minSize: 220,
        enableHiding: false,
        meta: { mobileTitle: true },
        cell: ({ row }) => {
          const model = row.original
          const vendor = vendorMap.get(model.vendor_id ?? 0)
          const iconKey = model.icon || vendor?.icon || model.model_name[0]
          // 后台与模型广场共用同一套身份：第一行是运营配置的展示名（留空回落
          // 派生名），第二行才是可调用的模型 ID。两处名字必须一致，否则运营
          // 改完展示名也无从核对。
          const displayName =
            model.display_name?.trim() ||
            formatModelDisplayName(model.model_name)
          const completeness = getModelMetadataCompleteness(model)
          const missingLabels = completeness.missing
            .map((field) => t(MODEL_METADATA_FIELD_LABELS[field]))
            .join(' / ')
          const showIncomplete = model.id <= 0 || !completeness.complete
          return (
            <div className='flex max-w-[320px] min-w-0 items-start gap-2.5 py-1'>
              <span className='mt-1 flex size-6 shrink-0 items-center justify-center'>
                {getLobeIcon(iconKey, 24)}
              </span>
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 items-center gap-1'>
                  <Button
                    variant='link'
                    className='text-foreground h-auto min-w-0 shrink justify-start p-0 text-sm font-semibold'
                    title={displayName}
                    onClick={() => {
                      setCurrentRow(model)
                      setOpen('update-model')
                    }}
                  >
                    <span className='truncate'>{displayName}</span>
                  </Button>
                  <CopyButton
                    value={model.model_name}
                    className='size-6 shrink-0'
                  />
                </div>
                <div className='text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs'>
                  <span className='truncate font-mono' title={model.model_name}>
                    {model.model_name}
                  </span>
                  {vendor && (
                    <>
                      <span aria-hidden className='hidden shrink-0 xl:inline'>
                        ·
                      </span>
                      <span
                        className='hidden max-w-[45%] shrink-0 truncate xl:inline'
                        title={vendor.name}
                      >
                        {vendor.name}
                      </span>
                    </>
                  )}
                  {model.name_rule !== 0 && (
                    <span className='shrink-0'>
                      {rules[model.name_rule as 0 | 1 | 2 | 3]?.label} ·{' '}
                      {model.matched_count ?? 0}
                    </span>
                  )}
                </div>
                {showIncomplete && (
                  <div
                    className='text-warning mt-1 flex min-w-0 items-center gap-1 text-xs'
                    title={
                      missingLabels
                        ? t('Missing: {{fields}}', { fields: missingLabels })
                        : undefined
                    }
                  >
                    <TriangleAlert className='size-3.5 shrink-0' />
                    <span className='truncate'>
                      {model.id <= 0
                        ? t('Missing metadata')
                        : t('Metadata incomplete')}
                    </span>
                    {model.id > 0 && (
                      <span className='shrink-0 tabular-nums'>
                        {completeness.filled}/{completeness.total}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        // 订阅制下运营真正关心的是「这个模型被哪些套餐包含」——模型广场卡片
        // 底部展示的就是这些胶囊，后台必须用同一套名字，否则对不上账。
        id: 'plans',
        header: t('Plans'),
        meta: { label: t('Plans') },
        size: 160,
        minSize: 110,
        enableSorting: false,
        cell: ({ row }) => {
          // 只认真正绑定了套餐的分组：没绑过的分组没有套餐名，不能拿分组名顶上,
          // 否则运营看到「默认分组」会以为自己已经配好了。
          const groups = (row.original.enable_groups ?? []).filter(
            (group) => planLabels[group]
          )
          if (groups.length === 0) {
            return (
              <span className='text-muted-foreground text-xs'>
                {t('No plan includes this model yet')}
              </span>
            )
          }
          // 一列最多放一个胶囊：多套餐的模型靠「+N」+ 悬浮全量，避免行高
          // 随套餐数量跳动（列宽只够放 4 个中文字）。
          const [first, ...others] = groups
          const rest = others.length
          return (
            <div
              className='flex min-w-0 items-center gap-1'
              title={groups.map((group) => planLabels[group]).join(' / ')}
            >
              <span className='bg-foreground text-background max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold'>
                {planLabels[first]}
              </span>
              {rest > 0 && (
                <span className='text-muted-foreground shrink-0 text-[11px] font-medium'>
                  +{rest}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'square_state',
        header: t('Model square visibility'),
        size: 110,
        // 徽标不能被压到换行/截断（「无法展示」曾在此列被切成「无法展」）。
        minSize: 104,
        enableSorting: false,
        meta: { mobileBadge: true },
        cell: ({ row }) => <ModelSquareStatus model={row.original} />,
      },
      {
        accessorKey: 'tags',
        header: t('Tags'),
        size: 140,
        enableSorting: false,
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <BadgeListCell
            expandable
            max={1}
            items={parseModelTags(row.original.tags ?? '').map((tag) => (
              <StatusBadge key={tag} label={tag} variant='neutral' size='sm' />
            ))}
          />
        ),
      },
      {
        accessorKey: 'sync_official',
        header: () => (
          <TruncatedCell className='max-w-[120px]'>
            {t('Sync policy')}
          </TruncatedCell>
        ),
        size: 120,
        minSize: 100,
        enableSorting: false,
        meta: { mobileHidden: true, label: t('Sync policy') },
        cell: ({ row }) => (
          <TruncatedCell className='text-muted-foreground max-w-[120px] text-sm'>
            {row.original.id > 0 &&
              (row.original.sync_official
                ? t('Allow updates')
                : t('Keep local'))}
            {!row.original.id && '—'}
          </TruncatedCell>
        ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        enableSorting: false,
        enableHiding: false,
        size: 120,
        cell: ({ row }) => <DataTableRowActions row={row} />,
      },
      {
        accessorKey: 'status',
        header: t('Display policy'),
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 1 ? t('Allowed') : t('Not listed'),
      },
      {
        accessorKey: 'id',
        header: t('ID'),
        cell: ({ row }) => row.original.id || '—',
        size: 65,
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'vendor_id',
        header: t('Vendor'),
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <TruncatedCell>
            {vendorMap.get(row.original.vendor_id ?? 0)?.name ?? '—'}
          </TruncatedCell>
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'name_rule',
        header: t('Match Type'),
        size: 100,
        enableSorting: false,
        cell: ({ row }) =>
          rules[row.original.name_rule as 0 | 1 | 2 | 3]?.label,
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'description',
        header: t('Description'),
        size: 180,
        enableSorting: false,
        cell: ({ row }) => (
          <DescriptionCell
            modelName={row.original.model_name}
            description={row.original.description ?? ''}
          />
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'endpoints',
        header: t('Custom endpoints'),
        size: 180,
        enableSorting: false,
        cell: ({ row }) => (
          <BadgeListCell
            expandable
            expandLabel={t('Supported endpoints')}
            items={formatEndpointsDisplay(row.original.endpoints ?? '').map(
              (endpoint) => (
                <StatusBadge
                  key={endpoint}
                  label={endpoint}
                  variant='neutral'
                />
              )
            )}
          />
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'created_time',
        header: t('Created'),
        size: 160,
        cell: ({ row }) =>
          row.original.id
            ? formatTimestampToDate(row.original.created_time)
            : '—',
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'updated_time',
        header: t('Updated'),
        size: 160,
        cell: ({ row }) =>
          row.original.id
            ? formatTimestampToDate(row.original.updated_time)
            : '—',
        meta: { mobileHidden: true },
      },
    ]
  }, [t, vendorMap, planLabels, setCurrentRow, setOpen])
}
