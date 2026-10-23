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
 * One container width (1200px), one vertical rhythm (py-24 on desktop) and one
 * hairline between blocks — the page reads as one grid rather than a stack of
 * separately-designed sections. Any block that needs to break the rhythm
 * (full-bleed terminal, dark CTA) passes `className` instead of forking the
 * container.
 */
export function SectionShell(props: {
  children: ReactNode
  className?: string
  innerClassName?: string
  id?: string
}) {
  return (
    <section
      id={props.id}
      className={cn('relative border-t border-border', props.className)}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-[1200px] px-6 py-16 md:px-12 md:py-24',
          props.innerClassName
        )}
      >
        {props.children}
      </div>
    </section>
  )
}

/**
 * Section header. Deliberately boring: a micro label, one sentence of claim,
 * one sentence of evidence, and an optional link pushed to the right edge —
 * the same shape apmix uses, because repeating it is what makes a long page
 * feel edited instead of assembled.
 */
export function SectionHeading(props: {
  label: string
  title: string
  lede?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between',
        props.className
      )}
    >
      <div className='max-w-[46rem]'>
        <p className='mb-4 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase'>
          {props.label}
        </p>
        <h2 className='text-[clamp(1.65rem,2.6vw,2.35rem)] leading-[1.12] font-semibold tracking-[-0.028em] text-foreground'>
          {props.title}
        </h2>
        {props.lede ? (
          <p className='mt-4 max-w-[38rem] text-[15px] leading-[1.6] text-muted-foreground'>
            {props.lede}
          </p>
        ) : null}
      </div>
      {props.action ? <div className='shrink-0'>{props.action}</div> : null}
    </div>
  )
}
