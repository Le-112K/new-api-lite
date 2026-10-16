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
import type { TFunction } from 'i18next'

import { LOG_TYPE_ENUM } from '../constants'
import type { UsageLog } from '../data/schema'
import { getResponseTimeColor, parseLogOther } from './format'
import { getLogTypeConfig, isTimingLogType } from './utils'

/**
 * The console spec's soft-badge tones (console-tokens.css §1). Colour is always
 * paired with an icon and a label on screen, so the state never rides on colour
 * alone (spec §10).
 */
export type UsageLogStatusTone =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'neutral'

export interface ResolvedUsageLogStatus {
  tone: UsageLogStatusTone
  /** The state the table shows: 成功 / 失败 / 较慢, or the log's own type name. */
  label: string
  /** The log's raw type label — kept as the pill's title so nothing is lost. */
  typeLabel: string
  /** Localized failure reason, when the row carries one. */
  reason?: string
}

/**
 * `LOG_TYPES[].color` (constants.ts) is a plain palette name. Map it onto the
 * console's semantic tones so non-request logs (top-up / refund / audit / …)
 * keep their own label but still read as a state badge.
 */
const TONE_BY_TYPE_COLOR: Record<string, UsageLogStatusTone> = {
  default: 'neutral',
  neutral: 'neutral',
  green: 'success',
  red: 'destructive',
  orange: 'warning',
  yellow: 'warning',
  blue: 'info',
  cyan: 'info',
  teal: 'info',
  purple: 'neutral',
  pink: 'neutral',
  violet: 'neutral',
}

/**
 * Single source of truth for the design's "状态" cell, shared by the status
 * pill and the CSV export so the two can never disagree.
 *
 * Request logs carry the outcome the design labels — 成功 / 失败 / 较慢 — and
 * every other log type keeps its own name, so no information is lost; the raw
 * type label stays reachable as the pill's `title`.
 */
export function resolveUsageLogStatus(
  log: UsageLog,
  t: TFunction,
  exists: (key: string) => boolean
): ResolvedUsageLogStatus {
  const config = getLogTypeConfig(log.type)
  const typeLabel = t(config.label)

  if (log.type === LOG_TYPE_ENUM.CONSUME) {
    // Reuses the page's existing latency heuristics rather than a second,
    // hand-tuned threshold, so the pill and the timing cell always agree.
    const slow =
      isTimingLogType(log.type) &&
      getResponseTimeColor(log.use_time, log.completion_tokens) === 'warning'
    return {
      tone: slow ? 'warning' : 'success',
      label: slow ? t('Slow') : t('Success'),
      typeLabel,
    }
  }

  if (log.type === LOG_TYPE_ENUM.ERROR) {
    const raw =
      parseLogOther(log.other)?.admin_info?.reject_reason || log.content
    // `reject_reason` is free-form backend text, but well-known values are
    // localizable keys — `exists` keeps unknown text from being mangled.
    let reason: string | undefined
    if (raw && raw.length > 0) {
      reason = exists(raw) ? t(raw) : raw
    }
    return { tone: 'destructive', label: t('Failed'), typeLabel, reason }
  }

  return {
    tone: TONE_BY_TYPE_COLOR[config.color] ?? 'neutral',
    label: typeLabel,
    typeLabel,
  }
}
