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
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
  type DynamicPriceEntry,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import { taskUsageUnitLabel } from '../lib/task-price-display'
import type { PricingModel, PriceType, TokenUnit } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import type { ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
}

/**
 * Compact a token count for the spec row: 128000 -> "128K", 1500000 -> "1.5M".
 * Returns null when the backend did not supply a value, so the card can dash it
 * instead of synthesising a number.
 */
function formatContextLength(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  if (value >= 1_000_000) return `${trimDecimal(value / 1_000_000)}M`
  if (value >= 1000) return `${trimDecimal(value / 1000)}K`
  return String(value)
}

/** 1 -> "1", 1.5 -> "1.5", 128 -> "128" (never "128.0"). */
function trimDecimal(value: number): string {
  return Number(value.toFixed(1)).toString()
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const tags = parseTags(props.model.tags)
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 20) : null
  const markName = props.model.vendor_name || props.model.model_name
  const initial = markName?.charAt(0).toUpperCase() || '?'
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const dynamicPriceOptions = useMemo(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        props.selectedGroup
      ),
    }),
    [
      props.model,
      props.selectedGroup,
      billingTime,
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
    ]
  )
  const dynamicSummary = useMemo(
    () => getDynamicPricingSummary(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )

  // The unit rides with its price rather than being repeated under every column,
  // and it is set at 11px with no surrounding spaces. Measured at the real card
  // width (a 1440 viewport with the 280px filter rail leaves ~285px of card
  // content) an inline unit only fits if the row carries three price columns:
  // "$2.50/1M" is ~68px and "$0.075/1M" ~75px against ~87px per column, whereas
  // four columns leave ~57px each — too narrow even for "$2.50/1M" alone.
  const unit = (label: string) => (
    <span className='text-muted-foreground text-[11px] font-normal'>
      {`/${label}`}
    </span>
  )
  const dash = <span className='text-muted-foreground font-normal'>—</span>
  const tokenPrice = (type: PriceType) => (
    <>
      {formatPrice(
        props.model,
        type,
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        props.selectedGroup
      )}
      {unit(tokenUnitLabel)}
    </>
  )
  const dynamicPrice = (entry: DynamicPriceEntry) => {
    const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
    return (
      <>
        {entry.formattedRange ?? entry.formatted}
        {unit(
          taskUsageUnitLabel(
            entry,
            i18n.language,
            unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
          )
        )}
      </>
    )
  }

  // The spec row keeps a fixed set of columns so the presence of a cache price
  // never shifts its neighbours: a model without one dashes that slot rather
  // than dropping the column. Context lives on the meta line instead — it is a
  // model attribute, not a price, and moving it out is what buys the price
  // columns enough width to keep their unit inline.
  let inputPrice: ReactNode = dash
  let outputPrice: ReactNode = dash
  let cachePrice: ReactNode = dash

  if (dynamicSummary) {
    if (!dynamicSummary.isSpecialExpression) {
      const primaryEntries = dynamicSummary.primaryEntries
      const cacheEntry = dynamicSummary.entries.find(
        (entry) => entry.variable?.key === 'cr'
      )
      if (primaryEntries[0]) inputPrice = dynamicPrice(primaryEntries[0])
      if (primaryEntries[1]) outputPrice = dynamicPrice(primaryEntries[1])
      if (cacheEntry) cachePrice = dynamicPrice(cacheEntry)
    }
  } else if (isUnconfiguredTaskUsage) {
    // Usage-based billing without a configured price: show no invented number.
  } else if (isTokenBased) {
    inputPrice = tokenPrice('input')
    outputPrice = tokenPrice('output')
    if (props.model.cache_ratio != null) {
      cachePrice = tokenPrice('cache')
    }
  } else {
    outputPrice = (
      <>
        {formatRequestPrice(
          props.model,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        )}
        {unit(t('request'))}
      </>
    )
  }

  const contextLength = formatContextLength(props.model.context_length)
  // Context leads the spec row, as in the approved design. It only moved out to
  // the meta line while the 280px filter rail squeezed this row to ~57px per
  // column, which could not hold even "$2.50/1M" (76px). The rail is gone and
  // the row now has ~120px per column at 1440 (102px at 1280), so it fits again.
  const specCells = [
    { key: 'context', label: t('Context'), value: contextLength ?? dash },
    { key: 'input', label: t('Input'), value: inputPrice },
    { key: 'output', label: t('Output'), value: outputPrice },
    { key: 'cache', label: t('Cache'), value: cachePrice },
  ]

  return (
    <Card className='h-full min-w-0 gap-0 p-4 transition-colors hover:ring-foreground/20'>
      <div className='grid min-w-0 grid-cols-[20px_minmax(0,1fr)_auto] gap-x-3 gap-y-3'>
        <div
          aria-hidden
          className='text-muted-foreground group-hover/card:text-foreground col-start-1 row-start-1 flex size-5 items-center justify-center transition-colors'
        >
          {modelIcon ?? (
            <span className='text-[11px] font-semibold'>{initial}</span>
          )}
        </div>
        <div className='col-start-2 row-start-1 min-w-0'>
          <h3
            className='truncate text-base font-semibold tracking-[-0.01em]'
            title={props.model.model_name}
          >
            {props.model.model_name}
          </h3>
          {props.model.vendor_name && (
            <p
              className='text-muted-foreground mt-1 truncate text-xs font-medium'
              title={props.model.vendor_name}
            >
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <div className='col-start-3 row-start-1 justify-self-end'>
          <CopyButton
            value={props.model.model_name}
            tooltip={t('Copy model name')}
            className='size-7'
            iconClassName='size-3.5'
          />
        </div>
        {/* Four fixed columns, Context leading, exactly as designed. Context
            takes a smaller share because its values are short ("200K", "1M")
            while the prices need the room. */}
        <dl className='col-span-2 col-start-2 row-start-2 grid grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3'>
          {specCells.map((cell) => (
            <div key={cell.key} className='grid min-w-0 gap-1'>
              <dt className='text-muted-foreground text-[11px] font-semibold tracking-[0.07em] whitespace-nowrap uppercase'>
                {cell.label}
              </dt>
              <dd className='truncate text-[15px] font-semibold tabular-nums'>
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className='col-span-2 col-start-2 row-start-3 flex min-w-0 items-center justify-between gap-3'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            {tags.map((tag) => (
              <span
                key={tag}
                className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'
              >
                {tag}
              </span>
            ))}
            <ModelBillingModeBadge model={props.model} appearance='caption' />
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='border-border text-muted-foreground hover:border-gray-300 hover:bg-accent hover:text-foreground shrink-0 rounded-full border px-3 py-0.5 text-[13px] font-semibold transition-colors'
            onClick={() => props.onClick(props.model.model_name || '')}
          >
            {t('Details')}
          </Button>
        </div>
      </div>
    </Card>
  )
})
