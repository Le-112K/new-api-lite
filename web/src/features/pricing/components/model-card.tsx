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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Card } from '@/components/ui/card'
import { getLobeIcon, getMonoLobeIcon } from '@/lib/lobe-icon'

import { formatModelDisplayName } from '../lib/model-display-name'
import type { PricingModel } from '../types'

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  /**
   * Group key -> human label ("default" -> "默认套餐"), used for the plan pills.
   * Falls back to the raw key when a group is not in the map.
   */
  groupLabels?: Record<string, string>
}

/**
 * Model card modelled on apmix.ai/models.
 *
 * The name block is two lines with different jobs:
 *
 * - line 1 (display name) — what the model is called. Content comes from the
 *   backend's model metadata (`display_name`, admin-configured); when that is
 *   empty the card derives a readable name from the id, so an unconfigured
 *   catalogue never renders blank titles. This line is display-only.
 * - line 2 (model id) — the callable identifier from the upstream channel
 *   (`model_name`). It is what users paste into an API call, so it is shown in
 *   mono and is copyable; the copy action always copies the full id, never the
 *   truncated text on screen.
 *
 * Both lines truncate to keep every card on one baseline; the untruncated value
 * stays reachable through `title`. Layout is otherwise vertical and sparse:
 * vendor mark + name, the two name lines, then the plans that include the model
 * as solid pills pinned to the bottom. A large vendor mark sits in the
 * bottom-right corner as a watermark (16% opacity, 28% on hover) and is clipped
 * by the card. The whole card is the click target; the copy button stops
 * propagation so it never opens the drawer.
 */
export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const modelName = props.model.model_name || ''
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const mark = modelIconKey ? getMonoLobeIcon(modelIconKey, 16) : null
  // The watermark keeps the brand palette: it is a background texture, and the
  // low opacity keeps it from competing with the black-and-white foreground.
  const watermark = modelIconKey ? getLobeIcon(modelIconKey, 160) : null
  const initial = (props.model.vendor_name || modelName)
    .charAt(0)
    .toUpperCase()
  // Backend-configured title wins; the derived name keeps unconfigured models
  // readable instead of leaving a blank line.
  const displayName =
    props.model.display_name?.trim() || formatModelDisplayName(modelName)

  // Plans that already include this model. Real data (enable_groups), shown as
  // solid pills the way the reference card shows its tiers.
  const plans = props.model.enable_groups ?? []

  const open = () => props.onClick(modelName)

  return (
    <Card
      role='button'
      tabIndex={0}
      aria-label={displayName}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      className='group relative flex min-h-[172px] min-w-0 cursor-pointer flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card ring-0 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none'
    >
      {/* Oversized vendor mark, clipped by the card; lifts on hover. */}
      {watermark && (
        <span
          aria-hidden
          className='pointer-events-none absolute -right-6 -bottom-8 size-40 opacity-[0.16] transition-[opacity,transform] duration-500 group-hover:scale-105 group-hover:opacity-[0.28] dark:opacity-[0.22] dark:group-hover:opacity-[0.36]'
        >
          {watermark}
        </span>
      )}

      {/* Vendor: 28px tinted circle + muted name. */}
      <div className='relative flex items-center gap-2.5'>
        <span className='bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded-full'>
          {mark ?? (
            <span className='text-muted-foreground text-[11px] font-semibold'>
              {initial}
            </span>
          )}
        </span>
        <span className='text-muted-foreground min-w-0 truncate text-xs font-semibold'>
          {props.model.vendor_name}
        </span>
      </div>

      {/* Line 1 — display name. Admin-configured, truncates with the full value
          on hover; the copy action belongs to the id below, not to this line. */}
      <h3
        className='relative mt-4 truncate text-lg leading-6 font-semibold tracking-tight'
        style={{ fontFamily: "'Sora', var(--font-sans)" }}
        title={displayName}
      >
        {displayName}
      </h3>

      {/* Line 2 — callable model id. The well hugs short ids and truncates long
          ones (`min-w-0` lets it shrink); the copy button is `shrink-0` so it
          always stays reachable. */}
      <div className='relative mt-1.5 flex min-w-0 items-center gap-2'>
        <code
          className='bg-muted text-foreground/85 min-w-0 truncate rounded-md px-2 py-1 font-mono text-[12px]'
          title={modelName}
        >
          {modelName}
        </code>
        <span
          className='shrink-0'
          onClick={(event) => event.stopPropagation()}
        >
          <CopyButton
            value={modelName}
            tooltip={t('Copy model name')}
            className='border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground size-8 shrink-0 rounded-md border'
            iconClassName='size-3.5'
          />
        </span>
      </div>

      {/* Plans pinned to the bottom, solid inverted pills. */}
      <div className='relative mt-auto flex flex-wrap items-center gap-1.5 pt-5'>
        {plans.length > 0 ? (
          plans.map((group) => (
            <span
              key={group}
              className='bg-foreground text-background rounded-full px-2 py-0.5 text-[11px] font-semibold'
            >
              {props.groupLabels?.[group] ?? group}
            </span>
          ))
        ) : (
          <span className='text-muted-foreground text-[11px] font-medium'>
            {t('No plan includes this model yet')}
          </span>
        )}
      </div>
    </Card>
  )
})
