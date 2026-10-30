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
import { safeJsonParse } from '../utils/json-parser'

/** 站点按调用次数计费，一份定价快照只描述「单次价格」。 */
export type ModelPricingSnapshotInput = {
  modelPrice: string
}

export type ModelPricingSnapshot = {
  name: string
  price?: string
}

export type ModelRow = ModelPricingSnapshot & {
  saved?: ModelPricingSnapshot
  draft?: ModelPricingSnapshot
  isDraftChanged: boolean
  isDraftDeleted: boolean
  isDraftNew: boolean
}

export const hasPricingValue = (value?: string) =>
  value !== undefined && value !== ''

export const isBasePricingUnset = (snapshot?: ModelPricingSnapshot) =>
  !snapshot || !hasPricingValue(snapshot.price)

export const getPriceSummary = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  return row.price ? `$${row.price} / ${t('request')}` : t('Unset price')
}

export const getPriceDetail = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  return row.price ? t('Fixed request price') : t('Unset price')
}

export const buildModelSnapshots = ({
  modelPrice,
}: ModelPricingSnapshotInput): ModelPricingSnapshot[] => {
  const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
    fallback: {},
    context: 'model prices',
  })

  return Object.keys(priceMap).map((name) => ({
    name,
    price: priceMap[name]?.toString() || '',
  }))
}

export const getSnapshotSignature = (snapshot?: ModelPricingSnapshot) => {
  if (!snapshot) return ''
  return JSON.stringify({ price: snapshot.price || '' })
}
