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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MODEL_ALIAS_MAP_OPTION_KEY,
  formatModelAliasMap,
  parseModelAliasMap,
} from '@/lib/model-alias-map'

import { getSystemOptions } from '../api'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type AliasRow = {
  id: number
  upstream: string
  standard: string
}

let nextRowId = 0
const newRow = (): AliasRow => {
  nextRowId += 1
  return { id: nextRowId, upstream: '', standard: '' }
}

/**
 * 模型统一名称表：上游模型名 → 统一请求名的固定映射（填表模板）。
 * 渠道「路由与映射」选中上游名时会按此表自动带出统一名；表变更不会
 * 改写已保存渠道的映射快照，需要时在渠道里重新选择即可。
 */
export function ModelAliasSection() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const updateOption = useUpdateOption()
  const [rows, setRows] = useState<AliasRow[]>([newRow()])
  const [initialized, setInitialized] = useState(false)

  const query = useQuery({
    queryKey: ['system-options'],
    queryFn: () => getSystemOptions(),
  })

  useEffect(() => {
    if (!query.data || initialized) return
    const raw = query.data.data?.find(
      (option) => option.key === MODEL_ALIAS_MAP_OPTION_KEY
    )?.value
    const map = parseModelAliasMap(typeof raw === 'string' ? raw : '')
    const entries = Object.entries(map)
    setRows(
      entries.length > 0
        ? entries.map(([upstream, standard]) => {
            nextRowId += 1
            return { id: nextRowId, upstream, standard }
          })
        : [newRow()]
    )
    setInitialized(true)
  }, [query.data, initialized])

  const filledRows = rows.filter(
    (row) => row.upstream.trim() && row.standard.trim()
  )
  const hasDuplicateUpstream = (() => {
    const seen = new Set<string>()
    for (const row of filledRows) {
      const key = row.upstream.trim()
      if (seen.has(key)) return true
      seen.add(key)
    }
    return false
  })()

  const save = async () => {
    const map: Record<string, string> = {}
    for (const row of filledRows) {
      const upstream = row.upstream.trim()
      const standard = row.standard.trim()
      if (map[upstream] && map[upstream] !== standard) {
        toast.error(
          t('Upstream "{{name}}" is mapped to more than one standard name.', {
            name: upstream,
          })
        )
        return
      }
      map[upstream] = standard
    }
    await updateOption.mutateAsync({
      key: MODEL_ALIAS_MAP_OPTION_KEY,
      value: formatModelAliasMap(map),
    })
    await client.invalidateQueries({ queryKey: ['system-options'] })
    toast.success(t('Model alias map saved'))
  }

  return (
    <SettingsSection title={t('Model Aliases')}>
      <div className='flex flex-col gap-4'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Fixed upstream-to-standard name pairs. When an upstream model is picked in a channel mapping, its standard name is filled in automatically. One upstream name maps to one standard name; one standard name may collect several upstream versions.'
          )}
        </p>

        <div className='flex flex-col gap-2'>
          <div className='text-muted-foreground grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium'>
            <span>{t('Upstream model name')}</span>
            <span>{t('Standard request name')}</span>
            <span className='w-9' />
          </div>
          {rows.map((row) => (
            <div key={row.id} className='grid grid-cols-[1fr_1fr_auto] gap-2'>
              <Input
                value={row.upstream}
                placeholder='12sd/DeepSeek-v4-pro'
                onChange={(event) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id
                        ? { ...item, upstream: event.target.value }
                        : item
                    )
                  )
                }
                aria-label={t('Upstream model name')}
              />
              <Input
                value={row.standard}
                placeholder='deepseek-v4-pro'
                onChange={(event) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id
                        ? { ...item, standard: event.target.value }
                        : item
                    )
                  )
                }
                aria-label={t('Standard request name')}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() =>
                  setRows((prev) => {
                    const next = prev.filter((item) => item.id !== row.id)
                    return next.length > 0 ? next : [newRow()]
                  })
                }
                aria-label={t('Remove row')}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <Plus className='mr-1 h-4 w-4' />
              {t('Add row')}
            </Button>
          </div>
        </div>

        {hasDuplicateUpstream && (
          <p className='text-destructive text-sm' role='alert'>
            {t('The same upstream name appears more than once.')}
          </p>
        )}

        <div className='flex justify-end'>
          <Button
            type='button'
            onClick={() => void save()}
            disabled={updateOption.isPending || hasDuplicateUpstream}
          >
            {updateOption.isPending ? t('Saving...') : t('Save alias map')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
