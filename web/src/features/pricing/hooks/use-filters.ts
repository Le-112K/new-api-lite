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
import { useSearch } from '@tanstack/react-router'
import { useMemo, useCallback, useState } from 'react'

import { FILTER_ALL, SORT_OPTIONS } from '../constants'
import { filterAndSortModels } from '../lib/filters'
import type { PricingModel } from '../types'

// 只剩「供应商 / 套餐(分组)」两个筛选维度。价格单位、充值价开关、排序都是
// 按 token 卖时代的东西，随订阅制一起删了——不要为兼容旧链接再把它们加回来。
type FilterState = {
  vendor?: string
  group?: string
}

export function useFilters(models: PricingModel[]) {
  const search = useSearch({ from: '/pricing/' })
  const [filterState, setFilterState] = useState<FilterState>(() => ({
    vendor: search.vendor,
    group: search.group,
  }))

  const vendorFilter = filterState.vendor || FILTER_ALL
  const groupFilter = filterState.group || FILTER_ALL

  const updateFilters = useCallback((updates: Record<string, unknown>) => {
    setFilterState((prev) => {
      const next: Record<string, unknown> = { ...prev, ...updates }
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === null) {
          delete next[key]
        }
      }
      return next as FilterState
    })
  }, [])

  const setVendorFilter = useCallback(
    (v: string) => updateFilters({ vendor: v === FILTER_ALL ? undefined : v }),
    [updateFilters]
  )
  const setGroupFilter = useCallback(
    (v: string) => updateFilters({ group: v === FILTER_ALL ? undefined : v }),
    [updateFilters]
  )
  const filteredModels = useMemo(() => {
    if (!models || models.length === 0) return []

    return filterAndSortModels(models, {
      vendor: vendorFilter,
      group: groupFilter,
      sortBy: SORT_OPTIONS.NAME,
    })
  }, [models, vendorFilter, groupFilter])

  const hasActiveFilters = useMemo(
    () => vendorFilter !== FILTER_ALL || groupFilter !== FILTER_ALL,
    [vendorFilter, groupFilter]
  )

  const activeFilterCount = useMemo(
    () =>
      (vendorFilter !== FILTER_ALL ? 1 : 0) +
      (groupFilter !== FILTER_ALL ? 1 : 0),
    [vendorFilter, groupFilter]
  )

  const clearFilters = useCallback(() => {
    updateFilters({
      vendor: undefined,
      group: undefined,
    })
  }, [updateFilters])

  return {
    vendorFilter,
    groupFilter,
    setVendorFilter,
    setGroupFilter,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
  }
}
