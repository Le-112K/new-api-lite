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
import { Link } from '@tanstack/react-router'
import { Check, XCircle } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { PanelWrapper } from '../ui/panel-wrapper'

export interface RecentCallRow {
  id: number | string
  time: string
  model: string
  token: string
  tokens: string
  cost: string
  ok: boolean
  statusLabel: string
}

export interface RecentCallsPanelProps {
  title: string
  subtitle: string
  loading: boolean
  columns: {
    time: string
    model: string
    token: string
    tokens: string
    cost: string
    status: string
  }
  rows: RecentCallRow[]
  viewAllLabel: string
  viewAllTo: string
  emptyMessage: string
}

const COLUMN_KEYS = [
  'time',
  'model',
  'token',
  'tokens',
  'cost',
  'status',
] as const

/**
 * Status pill.
 *
 * The shared `StatusBadge` renders a label + colour only (no surface), so it
 * cannot express the soft state badge the console spec asks for (§9.5:
 * `--<sem>-soft` ground + `--<sem>-on-soft` ink). This is the surface-bearing
 * variant, scoped to this table, and it still carries an icon so the state is
 * never encoded by colour alone (§10).
 */
function StatusPill(props: { ok: boolean; label: string }) {
  const Icon = props.ok ? Check : XCircle
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        props.ok
          ? 'bg-[var(--success-soft)] text-[var(--success-on-soft)]'
          : 'bg-[var(--destructive-soft)] text-[var(--destructive-on-soft)]'
      )}
    >
      <Icon className='size-3 shrink-0' aria-hidden='true' />
      {props.label}
    </span>
  )
}

export function RecentCallsPanel(props: RecentCallsPanelProps) {
  const isEmpty = !props.loading && props.rows.length === 0

  return (
    <PanelWrapper
      title={props.title}
      description={props.subtitle}
      loading={props.loading}
      empty={isEmpty}
      emptyMessage={props.emptyMessage}
      height='h-64'
      contentClassName='p-0'
      headerActions={
        <Link
          to={props.viewAllTo}
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-md text-xs font-medium underline-offset-4 transition-colors outline-none focus-visible:ring-2',
            'hover:underline'
          )}
        >
          {props.viewAllLabel}
        </Link>
      }
    >
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            {COLUMN_KEYS.map((key) => (
              <TableHead
                key={key}
                className={cn(
                  'text-muted-foreground h-9 text-[11px] font-semibold whitespace-nowrap',
                  (key === 'tokens' || key === 'cost') && 'text-right',
                  key === 'status' && 'text-right'
                )}
              >
                {props.columns[key]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id} className='h-11'>
              <TableCell className='text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums'>
                {row.time}
              </TableCell>
              <TableCell className='max-w-[16rem] truncate'>
                {row.model}
              </TableCell>
              <TableCell className='text-muted-foreground max-w-[12rem] truncate font-mono text-xs'>
                {row.token}
              </TableCell>
              <TableCell className='text-right text-xs whitespace-nowrap tabular-nums'>
                {row.tokens}
              </TableCell>
              <TableCell className='text-right font-mono text-xs whitespace-nowrap tabular-nums'>
                {row.cost}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                <StatusPill ok={row.ok} label={row.statusLabel} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PanelWrapper>
  )
}
