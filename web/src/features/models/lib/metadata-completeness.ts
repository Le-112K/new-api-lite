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
import type { Model } from '../types'
import { parseModelTags } from './model-utils'

/**
 * 模型广场卡片与详情页真正消费的元数据字段。
 *
 * 后台列表按同一份清单衡量「资料是否齐全」：少任何一项，广场上就会出现
 * 空行或破折号（卡片副标题、规格区、能力图标），所以这份清单必须与
 * `features/pricing` 的渲染保持一一对应，不能各写各的。
 */
export const MODEL_METADATA_FIELDS = [
  'display_name',
  'description',
  'context_length',
  'max_output_tokens',
  'capabilities',
  'tags',
] as const

export type ModelMetadataField = (typeof MODEL_METADATA_FIELDS)[number]

/** 能力清单在库里是逗号分隔字符串，接口侧也可能已经解析成数组。 */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export interface ModelMetadataCompleteness {
  total: number
  filled: number
  missing: ModelMetadataField[]
  complete: boolean
}

export function getModelMetadataCompleteness(
  model: Model
): ModelMetadataCompleteness {
  const missing: ModelMetadataField[] = []
  if (!model.display_name?.trim()) missing.push('display_name')
  if (!model.description?.trim()) missing.push('description')
  if ((model.context_length ?? 0) <= 0) missing.push('context_length')
  if ((model.max_output_tokens ?? 0) <= 0) missing.push('max_output_tokens')
  if (toList(model.capabilities).length === 0) missing.push('capabilities')
  if (parseModelTags(model.tags).length === 0) missing.push('tags')

  const total = MODEL_METADATA_FIELDS.length
  return {
    total,
    filled: total - missing.length,
    missing,
    complete: missing.length === 0,
  }
}

/** 缺失字段的界面文案 key，供 tooltip 直接 t() 使用。 */
export const MODEL_METADATA_FIELD_LABELS: Record<ModelMetadataField, string> = {
  display_name: 'Display name',
  description: 'Description',
  context_length: 'Context Length',
  max_output_tokens: 'Max output',
  capabilities: 'Capabilities',
  tags: 'Tags',
}
