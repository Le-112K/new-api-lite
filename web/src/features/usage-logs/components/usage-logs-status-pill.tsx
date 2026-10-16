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
import { Check, Clock, Info, XCircle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { UsageLog } from '../data/schema'
import {
  resolveUsageLogStatus,
  type UsageLogStatusTone,
} from '../lib/log-status'

const TONE_CLASSES: Record<UsageLogStatusTone, string> = {
  success: 'bg-[var(--success-soft)] text-[var(--success-on-soft)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-on-soft)]',
  destructive:
    'bg-[var(--destructive-soft)] text-[var(--destructive-on-soft)]',
  info: 'bg-[var(--info-soft)] text-[var(--info-on-soft)]',
  neutral: 'bg-[var(--neutral-soft)] text-[var(--neutral-on-soft)]',
}

const TONE_ICONS: Partial<Record<UsageLogStatusTone, LucideIcon>> = {
  success: Check,
  warning: Clock,
  destructive: XCircle,
  info: Info,
}

/**
 * The design's 状态 cell: a soft outcome pill (成功 / 失败 / 较慢, or the log's
 * own type name) with the failure reason appended in plain text, e.g.
 * `失败 · 上游超时`.
 */
export function UsageLogsStatusPill(props: { log: UsageLog }) {
  const { t, i18n } = useTranslation()
  const status = resolveUsageLogStatus(props.log, t, (key) => i18n.exists(key))
  const Icon = TONE_ICONS[status.tone]

  return (
    <span className='inline-flex max-w-[128px] min-w-0 items-center gap-1.5'>
      <span
        title={status.typeLabel}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
          TONE_CLASSES[status.tone]
        )}
      >
        {Icon != null && <Icon className='size-3 shrink-0' aria-hidden='true' />}
        {status.label}
      </span>
      {status.reason != null && (
        <span className='text-muted-foreground truncate text-[11px]'>
          · {status.reason}
        </span>
      )}
    </span>
  )
}
