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

import { getCurrencyLabel } from '@/lib/currency'

import { formatRequestPrice } from '../lib/price'
import type { PricingModel } from '../types'

export type ModelPriceCellOptions = {
  priceRate?: number
  usdExchangeRate?: number
  showRechargePrice?: boolean
  selectedGroup?: string
}

export function ModelPriceCell(props: {
  model: PricingModel
  options?: ModelPriceCellOptions
}) {
  const { t } = useTranslation()
  const currencyLabel = getCurrencyLabel()
  const options = props.options ?? {}

  if (!Number.isFinite(props.model.model_price)) {
    return (
      <span className='text-muted-foreground text-sm'>{t('Unset price')}</span>
    )
  }

  const value = formatRequestPrice(
    props.model,
    options.showRechargePrice,
    options.priceRate,
    options.usdExchangeRate,
    options.selectedGroup,
    false
  )
  const caption = `${currencyLabel} / ${t('request')}`

  return (
    <span className='block w-full max-w-full min-w-0 space-y-1.5'>
      <span className='grid'>
        <span className='flex min-w-0 flex-col items-start gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5'>
          <span
            className='text-muted-foreground min-w-0 truncate text-xs font-normal'
            title={t('Per-request')}
          >
            {t('Per-request')}
          </span>
          <span
            className='min-w-0 font-mono text-sm break-words whitespace-normal tabular-nums'
            title={value}
          >
            {value}
          </span>
        </span>
      </span>
      <span
        className='text-muted-foreground block text-xs font-normal break-words whitespace-normal sm:truncate'
        title={caption}
      >
        {caption}
      </span>
    </span>
  )
}
