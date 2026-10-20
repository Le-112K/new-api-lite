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
import {
  flexRender,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, KeyRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, getPageNumbers } from '@/lib/utils'

import type { ApiKey } from '../types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 100] as const
const PAGE_SIZE_SELECT_ITEMS = PAGE_SIZE_OPTIONS.map((pageSize) => ({
  value: `${pageSize}`,
  label: pageSize,
}))
const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => `keys-skeleton-${i}`)

/**
 * The keys panel: one card that owns the toolbar, the frozen table, the
 * selection bar and the pager — the console design's "flush panel" structure
 * (spec §9.1). It replaces `DataTablePage`'s toolbar + bordered table + footer
 * portal triplet for this page only, so no other table changes shape.
 */
type ApiKeysConsoleProps = {
  table: TanstackTable<ApiKey>
  total: number
  isLoading: boolean
  isFetching: boolean
  toolbar: ReactNode
  bulkActions?: ReactNode
  emptyAction?: ReactNode
}

export function ApiKeysConsole(props: ApiKeysConsoleProps) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows
  const columns = props.table.getVisibleLeafColumns()
  const dimmed = props.isFetching && !props.isLoading

  return (
    <div className='bg-card flex min-h-0 flex-col overflow-hidden rounded-[20px] border shadow-xs'>
      {props.toolbar}

      <div className='min-h-0 flex-1 overflow-x-auto'>
        <Table withContainer={false} className='min-w-[880px]'>
          <TableHeader>
            {props.table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='hover:bg-transparent'>
                {headerGroup.headers.map((header) => {
                  const isPinnedLeft = header.column.id === 'name'
                  const isPinnedRight = header.column.id === 'actions'
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'text-muted-foreground h-9 bg-[var(--cx-fill-1)] px-3 text-[11px] font-semibold whitespace-nowrap',
                        isPinnedLeft && 'sticky left-0 z-20',
                        isPinnedRight && 'sticky right-0 z-20 text-right'
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className={cn(
              'transition-opacity duration-150',
              dimmed && 'pointer-events-none opacity-60'
            )}
          >
            {props.isLoading && (
              <SkeletonRows columnCount={columns.length} />
            )}

            {!props.isLoading && rows.length === 0 && (
              <TableRow className='hover:bg-transparent'>
                <TableCell colSpan={columns.length} className='p-0'>
                  <EmptyState action={props.emptyAction} />
                </TableCell>
              </TableRow>
            )}

            {!props.isLoading &&
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className='h-11'
                >
                  {row.getVisibleCells().map((cell) => {
                    const isPinnedLeft = cell.column.id === 'name'
                    const isPinnedRight = cell.column.id === 'actions'
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'px-3 whitespace-nowrap',
                          isPinnedLeft &&
                            'bg-card sticky left-0 z-10 group-data-[state=selected]:bg-[var(--emphasis-soft)]',
                          isPinnedRight &&
                            'bg-card sticky right-0 z-10 group-data-[state=selected]:bg-[var(--emphasis-soft)]'
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {props.bulkActions}

      <Pager table={props.table} total={props.total} />

      <span className='sr-only'>
        {props.isLoading ? t('Loading...') : String(props.total)}
      </span>
    </div>
  )
}

function SkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {SKELETON_ROWS.map((id) => (
        <TableRow key={id} className='hover:bg-transparent'>
          {Array.from({ length: columnCount }, (_, index) => (
            <TableCell key={`${id}-${index}`} className='px-3'>
              <Skeleton className='h-4 w-full max-w-28' />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({ action }: { action?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col items-center justify-center gap-3 px-4 py-16 text-center'>
      <span className='bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full'>
        <KeyRound className='size-5' aria-hidden='true' />
      </span>
      <div className='flex flex-col gap-1'>
        <h3 className='text-sm font-semibold'>{t('No API Keys Found')}</h3>
        <p className='text-muted-foreground max-w-sm text-xs leading-relaxed'>
          {t(
            'No API keys available. Create your first API key to get started.'
          )}
        </p>
      </div>
      {action}
    </div>
  )
}

function Pager(props: { table: TanstackTable<ApiKey>; total: number }) {
  const { t } = useTranslation()
  const pagination = props.table.getState().pagination
  const pageIndex = pagination.pageIndex
  const pageSize = pagination.pageSize
  const pageCount = Math.max(1, props.table.getPageCount())
  const start = props.total === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(props.total, (pageIndex + 1) * pageSize)
  const pageNumbers = getPageNumbers(pageIndex + 1, pageCount)
  const pageItems = pageNumbers.map((page, index) => ({
    page,
    key: page === '...' ? `gap-after-${pageNumbers[index - 1]}` : String(page),
  }))

  return (
    <div className='text-[var(--cx-text-3)] flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-xs sm:px-5'>
      <span className='tabular-nums'>
        {t('{{start}}–{{end}} of {{total}} keys', {
          start,
          end,
          total: props.total,
        })}
      </span>
      <span className='flex-1' />

      <div className='flex items-center gap-1.5'>
        <span className='hidden sm:inline'>{t('Rows per page')}</span>
        <Select
          items={PAGE_SIZE_SELECT_ITEMS}
          value={`${pageSize}`}
          onValueChange={(value) => props.table.setPageSize(Number(value))}
        >
          <SelectTrigger className='text-foreground h-7 w-[60px] text-xs font-medium tabular-nums'>
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side='top' alignItemWithTrigger={false}>
            <SelectGroup>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={`${option}`}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='flex items-center gap-1'>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() => props.table.previousPage()}
          disabled={!props.table.getCanPreviousPage()}
          aria-label={t('Go to previous page')}
          className='text-muted-foreground hover:text-foreground'
        >
          <ChevronLeft className='size-4' />
        </Button>

        {pageItems.map(({ page, key }) =>
          page === '...' ? (
            <span key={key} className='text-muted-foreground/60 px-1'>
              …
            </span>
          ) : (
            <Button
              key={key}
              variant={pageIndex + 1 === page ? 'default' : 'ghost'}
              size='sm'
              onClick={() => props.table.setPageIndex((page as number) - 1)}
              className={cn(
                'h-7 min-w-7 px-2 text-xs tabular-nums',
                pageIndex + 1 === page
                  ? 'font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className='sr-only'>
                {t('Go to page {{page}}', { page })}
              </span>
              {page}
            </Button>
          )
        )}

        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() => props.table.nextPage()}
          disabled={!props.table.getCanNextPage()}
          aria-label={t('Go to next page')}
          className='text-muted-foreground hover:text-foreground'
        >
          <ChevronRight className='size-4' />
        </Button>
      </div>
    </div>
  )
}
