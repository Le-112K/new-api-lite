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
import { Ban, Check, Clock, XCircle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { API_KEY_STATUS, API_KEY_STATUSES } from '../constants'

/**
 * Soft state badge for the keys table (console spec §1 / §9.5).
 *
 * The shared `StatusBadge` renders colour + label only — no surface — so it
 * cannot express the `--<sem>-soft` ground + `--<sem>-on-soft` ink the console
 * design asks for. This is the surface-bearing variant, scoped to this page,
 * and it always carries an icon so the state is never encoded by colour alone
 * (spec §10, colour-blind + i18n redundancy).
 */
const STATUS_ICON: Record<number, LucideIcon> = {
  [API_KEY_STATUS.ENABLED]: Check,
  [API_KEY_STATUS.DISABLED]: Ban,
  [API_KEY_STATUS.EXPIRED]: Clock,
  [API_KEY_STATUS.EXHAUSTED]: XCircle,
}

const STATUS_TONE: Record<number, string> = {
  [API_KEY_STATUS.ENABLED]:
    'bg-[var(--success-soft)] text-[var(--success-on-soft)]',
  [API_KEY_STATUS.DISABLED]:
    'bg-[var(--neutral-soft)] text-[var(--neutral-on-soft)]',
  [API_KEY_STATUS.EXPIRED]:
    'bg-[var(--warning-soft)] text-[var(--warning-on-soft)]',
  [API_KEY_STATUS.EXHAUSTED]:
    'bg-[var(--destructive-soft)] text-[var(--destructive-on-soft)]',
}

export function ApiKeyStatusPill(props: { status: number; className?: string }) {
  const { t } = useTranslation()
  const config = API_KEY_STATUSES[props.status]
  if (!config) return null

  const Icon = STATUS_ICON[props.status] ?? Check

  return (
    <span
      data-slot='api-key-status-pill'
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        STATUS_TONE[props.status] ?? STATUS_TONE[API_KEY_STATUS.DISABLED],
        props.className
      )}
    >
      <Icon className='size-3 shrink-0' aria-hidden='true' />
      {t(config.label)}
    </span>
  )
}
