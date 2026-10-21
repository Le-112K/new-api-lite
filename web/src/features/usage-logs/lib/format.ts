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
import type { StatusBadgeProps } from '@/components/status-badge'
import type { UsageLog } from '../data/schema'
import type { LogOtherData } from '../types'
import { buildQuotaAuditOperation } from './quota-audit-operation'

const PARAM_OVERRIDE_ACTION_MAP: Record<string, string> = {
  set: 'Set',
  delete: 'Delete',
  copy: 'Copy',
  move: 'Move',
  append: 'Append',
  prepend: 'Prepend',
  trim_prefix: 'Trim Prefix',
  trim_suffix: 'Trim Suffix',
  ensure_prefix: 'Ensure Prefix',
  ensure_suffix: 'Ensure Suffix',
  trim_space: 'Trim Space',
  to_lower: 'To Lower',
  to_upper: 'To Upper',
  replace: 'Replace',
  regex_replace: 'Regex Replace',
  set_header: 'Set Header',
  delete_header: 'Delete Header',
  copy_header: 'Copy Header',
  move_header: 'Move Header',
  pass_headers: 'Pass Headers',
  sync_fields: 'Sync Fields',
  return_error: 'Return Error',
}

/**
 * Get localized label for a param override action
 */
export function getParamOverrideActionLabel(
  action: string,
  t: (key: string) => string
): string {
  const key = PARAM_OVERRIDE_ACTION_MAP[action.toLowerCase()]
  return key ? t(key) : action
}

/**
 * Parse a param override audit line into action and content
 */
export function parseAuditLine(
  line: string
): { action: string; content: string } | null {
  if (typeof line !== 'string') return null
  const firstSpace = line.indexOf(' ')
  if (firstSpace <= 0) return { action: line, content: line }
  return {
    action: line.slice(0, firstSpace),
    content: line.slice(firstSpace + 1),
  }
}

/**
 * Parse the 'other' field from JSON string to object
 */
export function parseLogOther(other: string): LogOtherData | null {
  if (!other) return null
  try {
    return JSON.parse(other) as LogOtherData
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse log other field:', error)
    return null
  }
}

export function getReasoningEffortVariant(
  effort: string | undefined
): StatusBadgeProps['variant'] {
  switch (effort?.trim().toLowerCase()) {
    case 'max':
    case 'xhigh':
    case 'high':
      return 'orange'
    case 'medium':
      return 'yellow'
    case 'low':
    case 'minimal':
      return 'green'
    case 'none':
    default:
      return 'grey'
  }
}

/**
 * Get time color based on duration (in seconds)
 */
export function getTimeColor(
  seconds: number
): 'success' | 'warning' | 'danger' {
  if (seconds < 10) return 'success'
  if (seconds < 30) return 'warning'
  return 'danger'
}

/**
 * Get first-response-token color based on latency (in seconds)
 */
export function getFirstResponseTimeColor(
  seconds: number
): 'success' | 'warning' | 'danger' {
  if (seconds < 5) return 'success'
  if (seconds < 10) return 'warning'
  return 'danger'
}

/**
 * Get throughput color based on generated tokens per second
 */
export function getThroughputColor(
  tokensPerSecond: number
): 'success' | 'warning' | 'danger' {
  if (tokensPerSecond >= 30) return 'success'
  if (tokensPerSecond >= 15) return 'warning'
  return 'danger'
}

/**
 * Get response color using throughput only when enough output tokens exist.
 */
export function getResponseTimeColor(
  seconds: number,
  completionTokens: number
): 'success' | 'warning' | 'danger' {
  if (completionTokens < 100 || seconds <= 0) return getTimeColor(seconds)
  return getThroughputColor(completionTokens / seconds)
}

/**
 * Format model name with mapping indicator
 */
export function formatModelName(log: UsageLog): {
  name: string
  isMapped: boolean
  actualModel?: string
  responseModel?: LogOtherData['response_model']
} {
  const other = parseLogOther(log.other)
  const isMapped = !!(
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other.upstream_model_name !== ''
  )

  return {
    name: log.model_name,
    isMapped,
    actualModel: isMapped ? other.upstream_model_name : undefined,
    responseModel: other?.response_model,
  }
}

/**
 * Whether the request payload reports any cache-related token usage. Used to
 * suppress cache pricing rows from the breakdown when the request did not
 * exercise the cache path.
 */
export function hasAnyCacheTokens(
  other: LogOtherData | null | undefined
): boolean {
  if (!other) return false
  return (
    (other.cache_tokens || 0) > 0 ||
    (other.image_cache_tokens || 0) > 0 ||
    (other.cache_creation_tokens || 0) > 0 ||
    (other.cache_creation_tokens_5m || 0) > 0 ||
    (other.cache_creation_tokens_1h || 0) > 0
  )
}

/**
 * Calculate duration and return formatted result with color variant
 * @param submitTime - Submit timestamp
 * @param finishTime - Finish timestamp
 * @param unit - Unit of the timestamps ('seconds' or 'milliseconds')
 */
export function formatDuration(
  submitTime?: number,
  finishTime?: number,
  unit: 'seconds' | 'milliseconds' = 'milliseconds'
): { durationSec: number; variant: StatusBadgeProps['variant'] } | null {
  if (!submitTime || !finishTime) return null

  const durationSec =
    unit === 'milliseconds'
      ? (finishTime - submitTime) / 1000
      : finishTime - submitTime

  return { durationSec, variant: durationSec > 60 ? 'red' : 'green' }
}

/**
 * Maps a language-independent audit/login operation `action` to an i18n
 * template string (the template itself is the i18n key, with {{placeholders}}).
 *
 * The backend stores only `action` + structured `params` in `other.op`; the UI
 * renders localized content at display time so audit/login logs are fully
 * translatable instead of being frozen to whatever language was written to DB.
 */
const AUDIT_TEMPLATES: Record<string, string> = {
  'token.create': 'API token creation',
  'token.update': 'API token configuration update',
  'token.status_update': 'API token status update',
  'token.delete': 'API token deletion',
  'token.delete_batch': 'API token batch deletion',
  'token.key_view': 'API token key access',
  'token.key_view_batch': 'API token batch key access',
  'access_token.generate': 'Created an access token',
  'access_token.revoke': 'Revoked an access token',
  'access_token.rename': 'Renamed an access token',
  'access_token.update': 'Changed access token permissions',
  'user.security_verify': 'Completed security verification',
  'user.password_change': 'Account password change',
  'user.binding_start': 'Account binding request',
  'user.binding_bind': 'Account binding',
  'user.email_binding_resend': 'Email confirmation code resend',

  login: 'Logged in successfully via {{method}}',
  // User management
  'user.create': 'Created user {{username}} (role {{role}})',
  'user.update': 'Updated user {{username}} (ID: {{id}})',
  'user.delete': 'Deleted user {{username}} (ID: {{id}})',
  'user.account_delete': 'Account deletion',
  'user.manage': 'Performed {{action}} on user {{username}} (ID: {{id}})',
  'user.quota_add': 'Increased user quota by {{quota}}',
  'user.quota_subtract': 'Decreased user quota by {{quota}}',
  'user.quota_override': 'Overrode user quota from {{from}} to {{to}}',
  'user.topup_complete': 'Completed top-up order for the user',
  // System settings
  'option.update': 'Updated system setting {{key}}',
  'option.payment_compliance': 'Confirmed payment compliance',
  'option.reset_ratio': 'Reset model ratios',
  'option.clear_affinity_cache': 'Cleared channel affinity cache',
  // Performance / cache
  'performance.clear_disk_cache': 'Cleared disk cache',
  'performance.gc': 'Triggered garbage collection',
  'performance.clear_logs': 'Cleared log files',
  // Channel
  'channel.create': 'Created channel {{name}} (type {{type}}, count {{count}})',
  'channel.update': 'Updated channel {{name}} (ID: {{id}})',
  'channel.status_update': 'Updated channel status (ID: {{id}})',
  'channel.status_update_batch':
    'Batch updated channel status ({{count}}/{{total}} changed)',
  'channel.delete': 'Deleted channel {{name}} (ID: {{id}})',
  'channel.delete_batch': 'Batch deleted {{count}} channels',
  'channel.delete_disabled': 'Deleted all disabled channels ({{count}})',
  'channel.key_view': 'Viewed channel key {{name}} (ID: {{id}})',
  'channel.tag_disable': 'Disabled channels with tag {{tag}}',
  'channel.tag_enable': 'Enabled channels with tag {{tag}}',
  'channel.tag_edit': 'Edited channels with tag {{tag}}',
  'channel.tag_batch_set': 'Batch set tag for {{count}} channels',
  'channel.copy':
    'Copied channel (source ID: {{sourceId}}) to {{name}} (new ID: {{id}})',
  'channel.multi_key_manage':
    'Multi-key management {{action}} on channel (ID: {{id}})',
  'channel.upstream_apply':
    'Applied upstream model changes to channel (ID: {{id}})',
  'channel.upstream_apply_all':
    'Applied upstream model changes to {{count}} channels',
  // Redemption codes
  'redemption.create':
    'Created {{count}} redemption codes named {{name}} ({{quota}} each)',
  'redemption.update': 'Updated a redemption code',
  'redemption.delete': 'Deleted a redemption code',
  'redemption.delete_invalid': 'Deleted invalid redemption codes',
  // Prefill groups
  'prefill_group.create': 'Created a prefill group',
  'prefill_group.update': 'Updated a prefill group',
  'prefill_group.delete': 'Deleted a prefill group',
  // Vendors
  'vendor.create': 'Created a vendor',
  'vendor.update': 'Updated a vendor',
  'vendor.delete': 'Deleted a vendor',
  // Model metadata
  'model.create': 'Created a model',
  'model.update': 'Updated a model',
  'model.delete': 'Deleted a model',
  'model.sync_upstream': 'Synced upstream models',
  // Subscriptions
  'subscription.plan_create': 'Created a subscription plan',
  'subscription.plan_update': 'Updated a subscription plan',
  'subscription.bind': 'Bound a subscription',
  // Logs
  'log.cleanup_start': 'Log cleanup task started.',
  // Generic middleware fallback
  generic: '{{method}} {{route}}',
}

/**
 * Render the localized content of an operation log from its structured
 * `other.op` descriptor. Returns null when the log has no recognized action,
 * letting callers fall back to the raw `content` field.
 */
export function renderAuditContent(
  other: LogOtherData | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  const op = other?.op
  if (!op?.action) return null
  if (
    op.action === 'redemption.delete_batch' ||
    (op.action === 'redemption.delete' &&
      other?.audit_info?.route === '/api/redemption/batch')
  ) {
    if (other?.audit_info?.success === false) {
      return t('Failed to batch delete redemption codes')
    }
    const count = op.params?.count
    if (
      typeof count === 'number' &&
      Number.isSafeInteger(count) &&
      count >= 0
    ) {
      return t('Batch deleted {{count}} redemption codes', { count })
    }
    return t('Batch deleted redemption codes (count not recorded)')
  }
  const template = AUDIT_TEMPLATES[op.action]
  if (!template) return null
  const quotaOperation = buildQuotaAuditOperation(
    op.action,
    op.params ?? {},
    other?.audit_info?.success !== false,
    t
  )
  if (quotaOperation) {
    return `${quotaOperation.summary} · ${quotaOperation.description}`
  }
  const params = { ...op.params }
  return t(template, params)
}
