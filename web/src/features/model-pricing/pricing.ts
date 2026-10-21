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

import type { PricingModel } from '@/features/pricing/types'
import type { ModelRatioData } from '@/features/system-settings/models/model-pricing-core'
import {
  buildModelSnapshots,
  type ModelPricingSnapshot,
} from '@/features/system-settings/models/model-pricing-snapshots'

import type { ModelPricingEntry } from './api'

export const PRICING_KEYS = [
  'ModelPrice',
  'ModelRatio',
  'CompletionRatio',
  'CacheRatio',
  'CreateCacheRatio',
  'ImageRatio',
  'AudioRatio',
  'AudioCompletionRatio',
] as const
export type PricingKey = (typeof PRICING_KEYS)[number]
export type PricingValues = Partial<Record<PricingKey, number | string>>
export type PricingOptions = Record<PricingKey, string>

export type CacheWriteMode = 'none' | 'standard' | 'claude_ttl'

export type LegacyBillingDetails = {
  audio_input_price?: number
  audio_output_price?: number
  audio_text_branches?: boolean
  image_count?: boolean
  request_rules?: { condition: string; multiplier: number }[]
}

export function modelPricingDisplay(
  entry: Pick<ModelPricingEntry, 'model_name' | 'effective'> &
    Partial<Pick<ModelPricingEntry, 'configured' | 'cache_write_mode'>>
): PricingModel {
  const values = entry.effective
  return {
    id: 0,
    model_name: entry.model_name,
    enable_groups: [],
    quota_type: values.ModelPrice !== undefined ? 1 : 0,
    model_ratio: Number(values.ModelRatio ?? Number.NaN),
    completion_ratio: Number(values.CompletionRatio ?? Number.NaN),
    model_price:
      values.ModelPrice === undefined ? undefined : Number(values.ModelPrice),
    cache_ratio:
      values.CacheRatio === undefined || Number(values.CacheRatio) === 1
        ? undefined
        : Number(values.CacheRatio),
    create_cache_ratio:
      values.CreateCacheRatio === undefined ||
      !(
        entry.cache_write_mode === 'standard' ||
        entry.cache_write_mode === 'claude_ttl' ||
        entry.configured?.CreateCacheRatio !== undefined
      )
        ? undefined
        : Number(values.CreateCacheRatio),
    image_ratio:
      values.ImageRatio === undefined || Number(values.ImageRatio) === 1
        ? undefined
        : Number(values.ImageRatio),
    audio_ratio:
      values.AudioRatio === undefined ? undefined : Number(values.AudioRatio),
    audio_completion_ratio:
      values.AudioCompletionRatio === undefined
        ? undefined
        : Number(values.AudioCompletionRatio),
  }
}

export const pricingFieldMap = {
  price: 'ModelPrice',
  ratio: 'ModelRatio',
  completionRatio: 'CompletionRatio',
  cacheRatio: 'CacheRatio',
  createCacheRatio: 'CreateCacheRatio',
  imageRatio: 'ImageRatio',
  audioRatio: 'AudioRatio',
  audioCompletionRatio: 'AudioCompletionRatio',
} as const

export function pricingOptions(
  values: Record<string, string | boolean>
): PricingOptions {
  return Object.fromEntries(
    PRICING_KEYS.map((key) => {
      const value = values[key]
      return [key, typeof value === 'string' ? value : '{}']
    })
  ) as PricingOptions
}

export function pricingRows(options: PricingOptions): ModelPricingSnapshot[] {
  return buildModelSnapshots({
    modelPrice: options.ModelPrice,
    modelRatio: options.ModelRatio,
    completionRatio: options.CompletionRatio,
    cacheRatio: options.CacheRatio,
    createCacheRatio: options.CreateCacheRatio,
    imageRatio: options.ImageRatio,
    audioRatio: options.AudioRatio,
    audioCompletionRatio: options.AudioCompletionRatio,
  })
}

export function pricingRow(
  name: string,
  values: PricingValues
): ModelRatioData {
  const options = Object.fromEntries(
    PRICING_KEYS.map((key) => [
      key,
      JSON.stringify(values[key] === undefined ? {} : { [name]: values[key] }),
    ])
  ) as PricingOptions
  const row = pricingRows(options).find((entry) => entry.name === name)
  const billingMode: ModelRatioData['billingMode'] = row?.price
    ? 'per-request'
    : 'per-token'
  return { ...row, name, billingMode }
}

export function pricingFromDraft(data: ModelRatioData): PricingValues {
  const values: PricingValues = {}
  for (const [field, key] of Object.entries(pricingFieldMap)) {
    const value = data[field as keyof typeof pricingFieldMap]
    if (value === undefined || value === '') continue
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) {
      throw new Error(t('Enter a finite, non-negative price'))
    }
    if (
      data.billingMode === 'per-request'
        ? key === 'ModelPrice'
        : key !== 'ModelPrice'
    ) {
      values[key] = number
    }
  }
  return values
}

export function applyPricingDraft(
  options: PricingOptions,
  data: ModelRatioData,
  names: string[] = [data.name]
): PricingOptions {
  return applyPricingValues(options, pricingFromDraft(data), names)
}

function applyPricingValues(
  options: PricingOptions,
  values: PricingValues,
  names: string[]
): PricingOptions {
  return Object.fromEntries(
    PRICING_KEYS.map((key) => {
      const map = JSON.parse(options[key] ?? '{}') as Record<
        string,
        number | string
      >
      for (const name of names) {
        delete map[name]
        if (values[key] !== undefined) {
          Object.defineProperty(map, name, {
            value: values[key],
            enumerable: true,
            writable: true,
            configurable: true,
          })
        }
      }
      return [key, JSON.stringify(map)]
    })
  ) as PricingOptions
}

export function pricingValuesByModel(
  options: PricingOptions
): Map<string, PricingValues> {
  const models = new Map<string, PricingValues>()
  for (const key of PRICING_KEYS) {
    const map: unknown = JSON.parse(options[key] ?? '{}')
    if (map === null || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error(t('Pricing must be a JSON object'))
    }
    for (const [name, value] of Object.entries(map)) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new Error(t('Invalid pricing value'))
      }
      const model = models.get(name) ?? {}
      model[key] = value
      models.set(name, model)
    }
  }
  return models
}
