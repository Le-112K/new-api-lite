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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { buildGroupLabels } from '../lib/group-labels'
import { pricingQueryOptions } from '../queries'

/**
 * 分组 key → 订阅套餐展示名，后台各处（模型列表、连接抽屉、分组徽标）共用。
 *
 * 直接读 `/api/pricing` 的共享缓存而不是走 `usePricingData`：后者会连带
 * 拉取 /api/status 并把系统配置写回 store，后台页面不需要那份副作用。
 */
export function usePlanLabels(planOnly = false): Record<string, string> {
  const { data } = useQuery(pricingQueryOptions())
  return useMemo(
    () =>
      buildGroupLabels(data?.usable_group, data?.subscription_plans, {
        planOnly,
      }),
    [data, planOnly]
  )
}
