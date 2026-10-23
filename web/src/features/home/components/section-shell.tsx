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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Shared rhythm for every block below the hero.
 *
 * Numbers come straight from the reference page: 1328px content width inside
 * 48px gutters, 112px of vertical padding, and no borders between blocks —
 * the bands (white / grey / inverted) do the separating. Alternating the band
 * instead of drawing hairlines is what makes a long page read as sections
 * rather than as a table.
 */
export function SectionShell(props: {
  children: ReactNode
  className?: string
  innerClassName?: string
  id?: string
  /** 参考站的模型段是 80px 上下留白，其余四段才是 112px */
  tight?: boolean
}) {
  return (
    <section id={props.id} className={cn('lp bg-background', props.className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-[1424px] px-6 py-16 md:px-12',
          props.tight ? 'md:py-20' : 'md:py-28',
          props.innerClassName
        )}
      >
        {props.children}
      </div>
    </section>
  )
}

/**
 * Section header. Same shape in every block: an 11px label, a 44px Sora
 * sentence, one grey line of evidence, and an optional link pushed right.
 */
export function SectionHeading(props: {
  label: string
  title: string
  lede?: string
  action?: ReactNode
  className?: string
  /** The reference sets the catalog heading at 28px and the other four at 44px;
       that difference is what keeps the catalog looking like a table caption
      rather than a second hero. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10',
        props.compact ? 'mb-8' : 'mb-10 md:mb-14',
        props.className
      )}
    >
      <div className='max-w-[44rem]'>
        <p className='mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
          {props.label}
        </p>
        <h2
          className={cn(
            'lp-display font-semibold text-foreground',
            props.compact
              ? 'text-[24px] leading-[1.25] tracking-[-0.02em] md:text-[28px]'
              : 'text-[32px] leading-[1.08] tracking-[-0.025em] md:text-[44px]'
          )}
        >
          {props.title}
        </h2>
        {props.lede ? (
          <p className='mt-3 max-w-[34rem] text-[16px] leading-[1.62] text-muted-foreground'>
            {props.lede}
          </p>
        ) : null}
      </div>
      {props.action ? <div className='shrink-0'>{props.action}</div> : null}
    </div>
  )
}
