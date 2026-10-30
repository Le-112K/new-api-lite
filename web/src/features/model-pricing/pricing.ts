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
import { t } from 'i18next'

import type { ModelRatioData } from '@/features/system-settings/models/model-pricing-core'
import { buildModelSnapshots } from '@/features/system-settings/models/model-pricing-snapshots'

/**
 * 站点只按调用次数计费，定价配置只剩「单次价格」一个键。
 * ModelPrice 的 JSON map 形如 `{ "gpt-4o": 0.01 }`，单位是「货币单位 / 次」。
 */
export const PRICING_KEYS = ['ModelPrice'] as const
export type PricingKey = (typeof PRICING_KEYS)[number]
export type PricingValues = Partial<Record<PricingKey, number | string>>
export type PricingOptions = Record<PricingKey, string>

/** 仅作展示：后端可能附带按图计费与请求级倍率的说明。 */
export type LegacyBillingDetails = {
  image_count?: boolean
  request_rules?: { condition: string; multiplier: number }[]
}

export function pricingOptions(
  values: Record<string, string | boolean>
): PricingOptions {
  const value = values.ModelPrice
  return { ModelPrice: typeof value === 'string' ? value : '{}' }
}

export function pricingRow(
  name: string,
  values: PricingValues
): ModelRatioData {
  const price = values.ModelPrice
  if (price === undefined) return { name, price: '' }
  const row = buildModelSnapshots({
    modelPrice: JSON.stringify({ [name]: price }),
  }).find((entry) => entry.name === name)
  return { name, price: row?.price ?? '' }
}

export function pricingFromDraft(data: ModelRatioData): PricingValues {
  const raw = data.price ?? ''
  if (raw === '') return {}
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(t('Enter a finite, non-negative price'))
  }
  return { ModelPrice: value }
}

export function applyPricingDraft(
  options: PricingOptions,
  data: ModelRatioData,
  names: string[] = [data.name]
): PricingOptions {
  const values = pricingFromDraft(data)
  const map = parsePriceMap(options.ModelPrice)
  for (const name of names) {
    delete map[name]
    if (values.ModelPrice !== undefined) {
      Object.defineProperty(map, name, {
        value: values.ModelPrice,
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
  }
  return { ModelPrice: JSON.stringify(map) }
}

export function pricingValuesByModel(
  options: PricingOptions
): Map<string, PricingValues> {
  const models = new Map<string, PricingValues>()
  for (const [name, value] of Object.entries(
    parsePriceMap(options.ModelPrice)
  )) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw new Error(t('Invalid pricing value'))
    }
    models.set(name, { ModelPrice: value })
  }
  return models
}

function parsePriceMap(
  raw: string | undefined
): Record<string, number | string> {
  const parsed: unknown = JSON.parse(raw ?? '{}')
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('Pricing must be a JSON object'))
  }
  return parsed as Record<string, number | string>
}
