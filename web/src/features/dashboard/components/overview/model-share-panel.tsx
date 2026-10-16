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
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { PanelWrapper } from '../ui/panel-wrapper'

export interface ModelShareSlice {
  key: string
  name: string
  count: number
  percent: number
}

export interface ModelSharePanelProps {
  title: string
  subtitle: string
  loading: boolean
  total: number
  totalLabel: string
  /** Descending by count, at most 6 — the last one is the neutral catch-all. */
  slices: ModelShareSlice[]
  emptyMessage: string
}

const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Slices ≤ 5 take cat-1..cat-5; the 6th is always the neutral cat-7. */
const MAX_NAMED_SLICES = 5

// Literal class strings so Tailwind emits them; the palette itself lives only
// in `console-tokens.css`.
const STROKE_BY_SLOT: Record<number, string> = {
  1: 'stroke-[var(--cat-1)]',
  2: 'stroke-[var(--cat-2)]',
  3: 'stroke-[var(--cat-3)]',
  4: 'stroke-[var(--cat-4)]',
  5: 'stroke-[var(--cat-5)]',
  6: 'stroke-[var(--cat-6)]',
  7: 'stroke-[var(--cat-7)]',
}

const BG_BY_SLOT: Record<number, string> = {
  1: 'bg-[var(--cat-1)]',
  2: 'bg-[var(--cat-2)]',
  3: 'bg-[var(--cat-3)]',
  4: 'bg-[var(--cat-4)]',
  5: 'bg-[var(--cat-5)]',
  6: 'bg-[var(--cat-6)]',
  7: 'bg-[var(--cat-7)]',
}

function slotFor(index: number): number {
  return index < MAX_NAMED_SLICES ? index + 1 : 7
}

export function ModelSharePanel(props: ModelSharePanelProps) {
  const isEmpty =
    !props.loading && (props.total <= 0 || props.slices.length === 0)

  let offset = 0
  const arcs = props.slices.map((slice, index) => {
    const length = (Math.max(0, slice.percent) / 100) * CIRCUMFERENCE
    const arc = {
      key: slice.key,
      slot: slotFor(index),
      dashArray: `${length} ${Math.max(0, CIRCUMFERENCE - length)}`,
      dashOffset: -offset,
    }
    offset += length
    return arc
  })

  return (
    <PanelWrapper
      title={props.title}
      description={props.subtitle}
      loading={props.loading}
      empty={isEmpty}
      emptyMessage={props.emptyMessage}
      height='h-[224px]'
    >
      <div className='flex flex-wrap items-center gap-5 sm:gap-6'>
        <div className='relative size-[148px] shrink-0'>
          <svg
            viewBox='0 0 148 148'
            className='size-full -rotate-90'
            role='img'
            aria-label={props.title}
          >
            <circle
              cx='74'
              cy='74'
              r={RADIUS}
              fill='none'
              strokeWidth='18'
              className='stroke-[var(--cx-fill-1)]'
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx='74'
                cy='74'
                r={RADIUS}
                fill='none'
                strokeWidth='18'
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                className={STROKE_BY_SLOT[arc.slot]}
              />
            ))}
          </svg>
          <div className='absolute inset-0 grid place-content-center text-center'>
            <b className='font-mono text-xl font-semibold tabular-nums'>
              {formatNumber(props.total)}
            </b>
            <span className='text-muted-foreground text-[11px]'>
              {props.totalLabel}
            </span>
          </div>
        </div>

        <ul className='flex min-w-0 flex-1 flex-col gap-1.5'>
          {props.slices.map((slice, index) => (
            <li
              key={slice.key}
              className='flex items-center gap-2 text-xs'
              title={slice.name}
            >
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-[3px]',
                  BG_BY_SLOT[slotFor(index)]
                )}
                aria-hidden='true'
              />
              <span className='min-w-0 flex-1 truncate'>{slice.name}</span>
              <span className='text-muted-foreground shrink-0 tabular-nums'>
                {slice.percent.toFixed(0)}%
              </span>
              <span className='w-14 shrink-0 text-right font-mono tabular-nums'>
                {formatNumber(slice.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PanelWrapper>
  )
}
