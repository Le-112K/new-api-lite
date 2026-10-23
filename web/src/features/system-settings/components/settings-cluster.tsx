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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

import { SettingsFormGrid } from './settings-form-layout'

type SettingsClusterGroupProps = {
  children: ReactNode
  className?: string
  /** Values of the clusters that should start expanded. */
  defaultOpen?: string[]
}

/**
 * Bucket for two to four clusters on a long pane.
 *
 * Heavy panes (basic authentication, channel health, SSRF) hold far more
 * controls than fit on one screen. Grouping them into named clusters keeps
 * every field reachable without turning the pane into a single wall of
 * toggles, and lets the rarely touched cluster stay folded.
 */
export function SettingsClusterGroup({
  children,
  className,
  defaultOpen,
}: SettingsClusterGroupProps) {
  return (
    <Accordion
      data-settings-form-span='full'
      defaultValue={defaultOpen}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </Accordion>
  )
}

type SettingsClusterProps = {
  value: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingsCluster({
  value,
  title,
  description,
  children,
  className,
}: SettingsClusterProps) {
  return (
    <AccordionItem
      value={value}
      className={cn(
        'bg-muted/20 rounded-xl border border-border px-4',
        className
      )}
    >
      <AccordionTrigger className='py-3 hover:no-underline'>
        <div className='flex min-w-0 flex-col gap-0.5 pr-3 text-left'>
          <span className='text-sm font-semibold'>{title}</span>
          {description ? (
            <span className='text-muted-foreground text-xs font-normal'>
              {description}
            </span>
          ) : null}
        </div>
      </AccordionTrigger>
      {/* keepMounted: collapsed fields stay registered with react-hook-form,
          otherwise a save from a half-expanded pane would drop them. */}
      <AccordionContent keepMounted className='pb-4'>
        <SettingsFormGrid>{children}</SettingsFormGrid>
      </AccordionContent>
    </AccordionItem>
  )
}
