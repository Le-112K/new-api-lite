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

/**
 * 全局「上游模型名 → 统一请求名」固定映射表。
 *
 * 存储为 option（ModelAliasMap），JSON 形如：
 *   { "12sd/DeepSeek-v4-pro": "deepseek-v4-pro", "gpt-3.5-turbo-0125": "gpt-3.5-turbo" }
 *
 * 方向约束：一个上游名只能对应一个统一名；一个统一名可以接收多个上游名
 * （同模型多版本归一）。该表只是渠道映射的填表模板——渠道保存的仍是自己的
 * model_mapping 快照，改表不会自动改写已保存的渠道。
 */
export const MODEL_ALIAS_MAP_OPTION_KEY = 'ModelAliasMap'

/** 容错解析：非法 JSON / 非字符串值逐项丢弃，绝不抛错。 */
export function parseModelAliasMap(
  raw?: string | null
): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, string> = {}
    for (const [upstream, standard] of Object.entries(parsed)) {
      const key = upstream.trim()
      const value = String(standard ?? '').trim()
      if (key && value) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

/** 序列化（键排序，保证保存结果稳定可 diff）。 */
export function formatModelAliasMap(map: Record<string, string>): string {
  const ordered: Record<string, string> = {}
  for (const key of Object.keys(map).sort()) {
    ordered[key] = map[key]
  }
  return JSON.stringify(ordered, null, 2)
}
