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
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import type { ApiKey } from '../types'

type ApiKeyQuotaCellProps = {
  apiKey: ApiKey
  now: number
  variant?: 'table' | 'card'
}

/**
 * Quota cell.
 *
 * The table variant matches the console design: a burn meter plus
 * `used / total · share%`, where the meter and the share both describe the
 * USED share of the quota (spec §9.5 — normal fill, `-warn` from 80%,
 * `-over` at 100%). The mobile card variant keeps its labelled key/value
 * layout. All figures stay exact; only the presentation differs.
 */
export function ApiKeyQuotaCell(props: ApiKeyQuotaCellProps) {
  const { t, i18n } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)
  const { config, meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol
  const used = props.apiKey.used_quota
  const remaining = props.apiKey.remain_quota
  const unlimited = props.apiKey.unlimited_quota
  const total = used + remaining
  const hasProgress = !unlimited && total > 0
  const usedPercentage = hasProgress
    ? Math.min(100, Math.max(0, (used / total) * 100))
    : 0
  const remainingPercentage = hasProgress
    ? Math.min(100, Math.max(0, (remaining / total) * 100))
    : 0
  const formattedUsed = formatQuotaWithCurrency(used, { showSymbol: false })
  const formattedRemaining = formatQuotaWithCurrency(remaining, {
    showSymbol: false,
  })
  const formattedTotal = formatQuotaWithCurrency(total, { showSymbol: false })
  /* The desktop cell is the design's `$6.12 / $20.00 · 31%`: the currency rides
     in the cell (so the column header stays a bare「额度」) and money keeps its
     trailing zeros so the column lines up. `keepTrailingZeros` alone would print
     $0.4000 for a sub-dollar amount (its small-value branch keeps four decimals),
     so two decimals are requested whenever they survive rounding and the
     currency module's precise default is left alone below that. */
  const moneyCell = (quota: number) =>
    formatQuotaWithCurrency(
      quota,
      Math.abs(quota) / config.quotaPerUnit >= 0.01
        ? { keepTrailingZeros: true, digitsSmall: 2 }
        : { keepTrailingZeros: true }
    )
  const formattedUsedCell = moneyCell(used)
  const formattedTotalCell = moneyCell(total)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const formattedUsedPercentage = formatter.format(usedPercentage)
  const formattedRemainingPercentage = formatter.format(remainingPercentage)

  const usageDescription = `${t('Used amount')} ${formattedUsed}`
  const remainingDescription = hasProgress
    ? `${t('Remaining')} ${formattedRemaining}; ${t('Remaining percentage')} ${formattedRemainingPercentage}%`
    : `${t('Remaining')} ${formattedRemaining}`

  /* Burn tone per spec §9.5: grayscale until 80%, warning from 80%, the
     controlled red only at (or past) the limit. */
  let meterTone = 'text-[var(--cx-progress-fill)]'
  if (usedPercentage >= 100) meterTone = 'text-[var(--cx-progress-fill-over)]'
  else if (usedPercentage >= 80) meterTone = 'text-[var(--cx-progress-fill-warn)]'

  const details = []
  if (!unlimited) {
    details.push({ label: t('Remaining'), value: formattedRemaining })
  }
  details.push({ label: t('Used amount'), value: formattedUsed })
  if (!unlimited) {
    details.push({ label: t('Current total quota'), value: formattedTotal })
  }
  if (hasProgress) {
    details.push({
      label: t('Remaining percentage'),
      value: `${formattedRemainingPercentage}%`,
    })
  }

  if (props.variant === 'card') {
    const triggerLabel = unlimited
      ? `${t('Unlimited')}; ${usageDescription}`
      : `${remainingDescription}; ${usageDescription}`

    return (
      <QuotaDetailsPopover
        title={`${t('Quota')} (${quotaUnit})`}
        triggerLabel={`${t('Quota')} (${quotaUnit}); ${triggerLabel}`}
        details={details}
        description={
          unlimited
            ? t(
                'This API key has no quota limit. Requests still require available wallet or subscription quota.'
              )
            : t(
                'Total = used + remaining. It is not an initial allocation or a periodic budget; changing the remaining quota changes the total and percentage.'
              )
        }
        className='space-y-2.5'
        triggerClassName='py-0'
        afterTrigger={
          !unlimited && (
            <Progress
              value={usedPercentage}
              aria-label={t('Used amount')}
              className={cn(
                'w-full [&_[data-slot=progress-indicator]]:bg-current',
                meterTone
              )}
            />
          )
        }
      >
        <span
          data-slot='api-key-quota-values'
          className='grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 text-sm'
        >
          <span className='text-muted-foreground'>
            {t('Remaining')}
            <span className='ml-1'>({quotaUnit})</span>
          </span>
          <span
            className={cn(
              'min-w-0 truncate text-right text-sm leading-5 font-normal',
              !unlimited && 'tabular-nums',
              !unlimited && remaining < 0 && 'text-destructive',
              remaining === 0 && !unlimited && 'text-muted-foreground'
            )}
          >
            {unlimited ? t('Unlimited') : formattedRemaining}
          </span>
          <span className='text-muted-foreground'>{t('Used amount')}</span>
          <span className='text-muted-foreground min-w-0 truncate text-right text-sm leading-5 font-normal tabular-nums'>
            {formattedUsed}
          </span>
        </span>
      </QuotaDetailsPopover>
    )
  }

  const triggerLabel = unlimited
    ? t('Unlimited')
    : `${formattedUsedCell} / ${formattedTotalCell} · ${formattedUsedPercentage}%`

  return (
    <QuotaDetailsPopover
      title={`${t('Quota')} (${quotaUnit})`}
      triggerLabel={triggerLabel}
      details={details}
      description={
        unlimited
          ? t(
              'This API key has no quota limit. Requests still require available wallet or subscription quota.'
            )
          : t(
              'Total = used + remaining. It is not an initial allocation or a periodic budget; changing the remaining quota changes the total and percentage.'
            )
      }
      className='max-w-45 flex w-full flex-col-reverse gap-1.5'
      triggerClassName='py-0.5'
      afterTrigger={
        <Progress
          value={usedPercentage}
          aria-label={t('Used amount')}
          className={cn(
            'w-full [&_[data-slot=progress-indicator]]:bg-current',
            meterTone
          )}
        />
      }
    >
      <span
        data-slot='api-key-quota-values'
        className='min-w-0 truncate text-xs leading-none font-medium tabular-nums'
      >
        {unlimited ? (
          t('Unlimited')
        ) : (
          <>
            <span className='text-foreground'>{formattedUsedCell}</span>
            <span className='text-muted-foreground/60 mx-1'>/</span>
            <span className='text-muted-foreground'>{formattedTotalCell}</span>
            <span className='text-muted-foreground/60 mx-1'>·</span>
            <span className='text-muted-foreground'>
              {formattedUsedPercentage}%
            </span>
          </>
        )}
      </span>
    </QuotaDetailsPopover>
  )
}
