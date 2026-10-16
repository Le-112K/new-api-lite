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
import { useId, useMemo } from 'react'

import { formatNumber } from '@/lib/format'

import { PanelWrapper } from '../ui/panel-wrapper'

export interface UsageTrendPoint {
  key: string
  label: string
  requests: number
}

export interface UsageTrendPanelProps {
  title: string
  subtitle: string
  loading: boolean
  points: UsageTrendPoint[]
  emptyMessage: string
}

const VIEW_W = 720
const VIEW_H = 224
const PAD_L = 48
const PAD_R = 18
const PAD_T = 16
const PAD_B = 30
const Y_TICKS = 3

interface PlottedPoint {
  x: number
  y: number
  value: number
}

/**
 * Hand-rolled SVG area chart.
 *
 * Deliberately not a chart library: the overview page ships no chart runtime
 * today (its sparklines are already inline SVG in `components/ui/stat-card`),
 * and inline SVG renders `--cat-*` / `--cx-*` tokens directly without needing
 * them resolved into JS colour strings. No third library is introduced.
 */
function plot(points: UsageTrendPoint[]): {
  plotted: PlottedPoint[]
  areaPath: string
  linePath: string
  max: number
  baseline: number
} | null {
  if (points.length < 2) return null

  const max = Math.max(...points.map((point) => point.requests), 1)
  const plotW = VIEW_W - PAD_L - PAD_R
  const plotH = VIEW_H - PAD_T - PAD_B
  const baseline = VIEW_H - PAD_B

  const plotted = points.map((point, index) => ({
    x: PAD_L + (index / (points.length - 1)) * plotW,
    y: baseline - (point.requests / max) * plotH,
    value: point.requests,
  }))

  const linePath = plotted
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const first = plotted.at(0)
  const last = plotted.at(-1)
  if (!first || !last) return null
  const areaPath = `${linePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`

  return { plotted, areaPath, linePath, max, baseline }
}

/**
 * Evenly spaced label indices, anchored on the most recent bucket so the newest
 * day is always labelled.
 */
function tickIndexes(count: number, wanted: number): number[] {
  if (count <= wanted) return Array.from({ length: count }, (_, i) => i)
  const step = Math.max(1, Math.round((count - 1) / (wanted - 1)))
  const out: number[] = []
  for (let i = count - 1; i >= 0; i -= step) out.unshift(i)
  return out
}

export function UsageTrendPanel(props: UsageTrendPanelProps) {
  const rawId = useId()
  const gradientId = `overview-trend-${rawId.replaceAll(':', '')}`

  const chart = useMemo(() => plot(props.points), [props.points])
  const total = useMemo(
    () => props.points.reduce((sum, point) => sum + point.requests, 0),
    [props.points]
  )
  const isEmpty = !props.loading && (!chart || total <= 0)

  const xLabels = chart
    ? tickIndexes(chart.plotted.length, 5).map((index) => ({
        index,
        label: props.points[index].label,
      }))
    : []

  return (
    <PanelWrapper
      title={props.title}
      description={props.subtitle}
      loading={props.loading}
      empty={isEmpty}
      emptyMessage={props.emptyMessage}
      height='h-[224px]'
      contentClassName='p-3 sm:p-4'
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className='block h-auto w-full'
        role='img'
        aria-label={props.title}
      >
        <defs>
          <linearGradient id={gradientId} x1='0' x2='0' y1='0' y2='1'>
            <stop
              offset='0%'
              className='text-[var(--cat-1)]'
              stopColor='currentColor'
              stopOpacity='0.22'
            />
            <stop
              offset='100%'
              className='text-[var(--cat-1)]'
              stopColor='currentColor'
              stopOpacity='0.02'
            />
          </linearGradient>
        </defs>

        {/* Gridlines + y axis ticks (chart structure stays grayscale) */}
        {chart &&
          Array.from({ length: Y_TICKS + 1 }, (_, step) => {
            const value = (chart.max / Y_TICKS) * step
            const y =
              chart.baseline - (step / Y_TICKS) * (VIEW_H - PAD_T - PAD_B)
            return (
              <g key={`grid-${step}`}>
                <line
                  x1={PAD_L}
                  x2={VIEW_W - PAD_R}
                  y1={y}
                  y2={y}
                  className='stroke-[var(--cx-chart-grid)]'
                  strokeWidth='1'
                  vectorEffect='non-scaling-stroke'
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3}
                  textAnchor='end'
                  fontSize='10'
                  className='fill-[var(--cx-text-3)] tabular-nums'
                >
                  {formatNumber(Math.round(value))}
                </text>
              </g>
            )
          })}

        {chart && (
          <>
            <path d={chart.areaPath} fill={`url(#${gradientId})`} />
            <path
              d={chart.linePath}
              fill='none'
              className='stroke-[var(--cat-1)]'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              vectorEffect='non-scaling-stroke'
            />
            <circle
              cx={chart.plotted.at(-1)?.x}
              cy={chart.plotted.at(-1)?.y}
              r='3.5'
              className='fill-[var(--cat-1)]'
            />
          </>
        )}

        {xLabels.map((entry) => (
          <text
            key={entry.label + entry.index}
            x={chart?.plotted[entry.index].x}
            y={VIEW_H - 10}
            textAnchor='middle'
            fontSize='10'
            className='fill-[var(--cx-text-3)]'
          >
            {entry.label}
          </text>
        ))}
      </svg>
    </PanelWrapper>
  )
}
