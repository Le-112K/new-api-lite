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
import * as z from 'zod'

import {
  formatPricingAmount,
  USD_PRICING_CURRENCY,
  type PricingCurrency,
} from '@/features/model-pricing/currency'
import type { LegacyBillingDetails } from '@/features/model-pricing/pricing'

/** 定价表单只剩两个字段：模型名与单次价格。 */
export const createModelPricingSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
  })

export type ModelPricingFormValues = z.infer<
  ReturnType<typeof createModelPricingSchema>
>

/** 一行定价草稿：模型名 + 单次价格（货币单位 / 次）。 */
export type ModelRatioData = {
  name: string
  price?: string
}

export type PreviewRow = {
  unit?: 'image' | 'none'
  key: string
  label: string
  value: string
  multiline?: boolean
}

export function buildPreviewRows(
  values: ModelPricingFormValues,
  t: (key: string) => string,
  currency: PricingCurrency = USD_PRICING_CURRENCY,
  billingDetails?: LegacyBillingDetails
): PreviewRow[] {
  return [
    {
      key: 'price',
      label: billingDetails?.image_count
        ? t('Price per image')
        : t('Fixed price'),
      ...(billingDetails?.image_count ? { unit: 'image' as const } : {}),
      value: values.price
        ? formatPricingAmount(values.price, currency)
        : t('Empty'),
    },
    ...pricingAdjustmentRows(billingDetails, t),
  ]
}

function pricingAdjustmentRows(
  details: LegacyBillingDetails | undefined,
  t: (key: string) => string
): PreviewRow[] {
  const rows: PreviewRow[] = []
  if (details?.image_count) {
    rows.push({
      key: 'imageCount',
      label: t('Image count'),
      value: t('Reserve requested images; settle returned images.'),
      unit: 'none',
    })
  }
  for (const [index, rule] of (details?.request_rules ?? []).entries()) {
    rows.push({
      key: `adjustment-${index}`,
      label: rule.condition,
      value: `× ${rule.multiplier}`,
      unit: 'none',
    })
  }
  return rows
}
