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
import { z } from 'zod'

import type { Model } from '../types'
import { parseModelTags as parseTagsFromUtils } from './model-utils'

// ============================================================================
// Model Form Schema
// ============================================================================

/**
 * Model form validation schema
 */
export const modelFormSchema = z.object({
  id: z.number().optional(),
  model_name: z.string().min(1, 'Model name is required'),
  /** 展示名：只影响模型广场/详情页的标题，不改变可调用的模型 ID。 */
  display_name: z.string().default(''),
  description: z.string().default(''),
  icon: z.string().default(''),
  tags: z.array(z.string()).default([]),
  vendor_id: z.number().optional(),
  endpoints: z.string().default(''),
  name_rule: z.number().min(0).max(3).default(0),
  status: z.boolean().default(true),
  sync_official: z.boolean().default(true),
  enable_groups: z.array(z.string()).default([]),
  // 订阅制能力指标。0 = 未知（卡片上显示破折号，不编造数字）。
  context_length: z.number().min(0).default(0),
  max_output_tokens: z.number().min(0).default(0),
  // 广场/详情当前不展示思考强度，表单已下线该输入项；schema 保留字段作为
  // 数据通道——payload 带上原值提交，避免每次保存把库里已有的值清空。
  thinking_strength: z
    .enum(['', 'none', 'low', 'medium', 'high'])
    .default(''),
  capabilities: z.array(z.string()).default([]),
})

export type ModelFormValues = z.infer<typeof modelFormSchema>

// ============================================================================
// Vendor Form Schema
// ============================================================================

/**
 * Vendor form validation schema
 */
export const vendorFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'Vendor name is required'),
  description: z.string().default(''),
  icon: z.string().default(''),
  status: z.number().default(1),
})

export type VendorFormValues = z.infer<typeof vendorFormSchema>

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform model to form default values
 */
export function transformModelToFormDefaults(model: Model): ModelFormValues {
  return {
    id: model.id,
    model_name: model.model_name,
    display_name: model.display_name || '',
    description: model.description || '',
    icon: model.icon || '',
    tags: parseTagsFromUtils(model.tags),
    vendor_id: model.vendor_id,
    endpoints: model.endpoints || '',
    name_rule: model.name_rule || 0,
    status: model.status === 1,
    sync_official: model.sync_official === 1,
    enable_groups: model.enable_groups || [],
    context_length: model.context_length || 0,
    max_output_tokens: model.max_output_tokens || 0,
    thinking_strength: (model.thinking_strength || '') as
      | ''
      | 'none'
      | 'low'
      | 'medium'
      | 'high',
    capabilities: parseCapabilities(model.capabilities),
  }
}

/**
 * Transform form data to model create/update payload
 */
export function transformFormDataToModelPayload(
  formData: ModelFormValues
): Partial<Model> {
  return {
    id: formData.id,
    model_name: formData.model_name,
    display_name: formData.display_name || '',
    description: formData.description || '',
    icon: formData.icon || '',
    tags: formatTagsArray(formData.tags),
    vendor_id: formData.vendor_id,
    endpoints: formData.endpoints || '',
    name_rule: formData.name_rule,
    status: formData.status ? 1 : 0,
    sync_official: formData.sync_official ? 1 : 0,
    enable_groups: formData.enable_groups,
    context_length: formData.context_length || 0,
    max_output_tokens: formData.max_output_tokens || 0,
    thinking_strength: formData.thinking_strength || '',
    capabilities: formatTagsArray(formData.capabilities),
  }
}

/** 能力清单在 API 上是数组、在存储层是逗号分隔串，两种都收。 */
function parseCapabilities(value?: string | string[]): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// ============================================================================
// Parsing and Formatting Helpers
// ============================================================================

/**
 * Format tags array to string
 */
export function formatTagsArray(tags: string[]): string {
  return tags.filter(Boolean).join(',')
}

/**
 * Validate JSON string
 */
export function validateJSON(value: string): boolean {
  if (!value || value.trim() === '') return true

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validate endpoints JSON
 */
export function validateEndpoints(endpoints: string): boolean {
  return validateJSON(endpoints)
}
