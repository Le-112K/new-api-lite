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
import type { PricingData, PricingSubscriptionPlan } from '../types'

/**
 * 分组 key → 展示名。
 *
 * 订阅套餐标题优先于后台配置的分组名，这样模型广场的卡片胶囊、广场筛选器
 * 和后台模型列表说的是同一套话术。三处必须共用本函数，否则会出现广场写
 * 「专业版」而后台写「default」的错位。
 */
export function buildGroupLabels(
  usableGroup: PricingData['usable_group'] | undefined,
  plans: PricingSubscriptionPlan[] | undefined,
  options?: {
    /**
     * 只认订阅套餐：不拿分组名兜底。后台「套餐」列必须开这个开关，否则一个没绑
     * 套餐的分组会显示成「默认分组」，读起来像套餐名，运营会以为自己配过了。
     * 广场卡片仍用分组名兜底——那里要回答的是「你能用哪个分组」。
     */
    planOnly?: boolean
  }
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!options?.planOnly) {
    for (const [key, value] of Object.entries(usableGroup ?? {})) {
      out[key] =
        typeof value === 'string'
          ? value
          : ((value as { desc?: string })?.desc ?? key)
    }
  }
  for (const plan of plans ?? []) {
    if (plan.upgrade_group && plan.title) {
      out[plan.upgrade_group] = plan.title
    }
  }
  return out
}
