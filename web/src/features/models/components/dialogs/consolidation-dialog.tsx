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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { createServerError } from '@/lib/server-error-message'

import { applyConsolidation, getConsolidationSuggestions } from '../../api'
import { modelsQueryKeys } from '../../lib'
import { useModels } from '../models-provider'

type ConsolidationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 渠道别名归并：把渠道里的非标准模型名收敛到元数据定义的标准模型名。
 * 应用后渠道 models 增补标准名、model_mapping 写入 {标准名: 别名}，
 * 客户端即可用标准名调用。可选同时从渠道移除别名（默认保留，兼容老调用方）。
 */
export function ConsolidationDialog({
  open,
  onOpenChange,
}: ConsolidationDialogProps) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { setOpen } = useModels()
  const [removeAliases, setRemoveAliases] = useState(false)
  // 勾选状态：`${channelId}:${standard}:${alias}` → true
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const query = useQuery({
    queryKey: modelsQueryKeys.consolidation(),
    queryFn: async () => {
      const response = await getConsolidationSuggestions()
      if (!response.success) {
        throw createServerError(response, t('Operation failed'))
      }
      return response
    },
    enabled: open,
  })

  const suggestions = query.data?.data ?? []
  // 默认全选：数据到达后把所有 item 勾上（只补缺失键，不覆盖用户的手动取消）。
  const allKeys = suggestions.flatMap((s) =>
    s.items.map((item) => `${item.channel_id}:${s.standard_name}:${item.alias}`)
  )
  const pendingDefaults = allKeys.filter((key) => !(key in checked))
  if (pendingDefaults.length > 0) {
    setChecked((prev) => {
      const next = { ...prev }
      for (const key of pendingDefaults) next[key] = true
      return next
    })
  }

  const checkedItems = suggestions.flatMap((s) =>
    s.items
      .filter(
        (item) => checked[`${item.channel_id}:${s.standard_name}:${item.alias}`]
      )
      .map((item) => ({
        channel_id: item.channel_id,
        standard_name: s.standard_name,
        alias_name: item.alias,
      }))
  )

  const apply = useMutation({
    mutationFn: async () => {
      const response = await applyConsolidation(checkedItems, removeAliases)
      if (!response.success) {
        throw createServerError(response, t('Operation failed'))
      }
      return response.data
    },
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: modelsQueryKeys.all }),
        client.invalidateQueries({ queryKey: ['channels'] }),
        client.invalidateQueries({ queryKey: ['pricing'] }),
      ])
      toast.success(
        t('Updated {{count}} channel(s)', {
          count: result?.updated_channels ?? 0,
        })
      )
      onOpenChange(false)
      setOpen(null)
    },
  })

  const ruleLabel = (rule: string) => {
    const labels: Record<string, string> = {
      exact: t('Exact'),
      prefix: t('Prefix'),
      suffix: t('Suffix'),
      contains: t('Contains'),
    }
    return labels[rule] ?? rule
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && apply.isPending) return
        onOpenChange(next)
      }}
      title={t('Merge alias models')}
      description={t(
        'Channel model names that match a metadata rule can be normalized to the standard model name. Clients can then call the standard name; the gateway rewrites it per channel.'
      )}
      footer={
        <div className='flex w-full flex-col gap-3'>
          <div className='flex items-start gap-2'>
            <Checkbox
              id='consolidation-remove-aliases'
              className='mt-0.5'
              checked={removeAliases}
              disabled={apply.isPending}
              onCheckedChange={(next) => setRemoveAliases(next === true)}
            />
            <Label
              htmlFor='consolidation-remove-aliases'
              className='flex-wrap leading-normal'
            >
              {t('Also remove aliases from channels')}
              <span className='text-muted-foreground text-xs font-normal'>
                {t('Keep them if existing clients still call these names.')}
              </span>
            </Label>
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={apply.isPending}
            >
              {t('Close')}
            </Button>
            <Button
              variant='destructive'
              onClick={() => apply.mutate()}
              disabled={apply.isPending || checkedItems.length === 0}
            >
              {apply.isPending
                ? t('Applying...')
                : t('Apply {{count}} merge(s)', { count: checkedItems.length })}
            </Button>
          </div>
        </div>
      }
    >
      {query.isError ? (
        <ErrorState
          description={query.error?.message}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <LoadingState />
      ) : suggestions.length === 0 ? (
        <p className='text-muted-foreground py-6 text-center text-sm'>
          {t(
            'No alias models found. Every channel name already matches a standard model.'
          )}
        </p>
      ) : (
        <div className='max-h-[50vh] space-y-4 overflow-y-auto pr-1'>
          {suggestions.map((suggestion) => (
            <div key={suggestion.standard_name} className='space-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-semibold'>
                  {suggestion.standard_name}
                </span>
                <StatusBadge
                  label={ruleLabel(suggestion.rule)}
                  variant='neutral'
                  size='sm'
                />
                <span className='text-muted-foreground text-xs'>
                  {t('{{count}} alias(s)', { count: suggestion.items.length })}
                </span>
              </div>
              <div className='space-y-1.5'>
                {suggestion.items.map((item) => {
                  const key = `${item.channel_id}:${suggestion.standard_name}:${item.alias}`
                  return (
                    <div
                      key={key}
                      className='flex items-center gap-2 rounded-md border px-2.5 py-1.5'
                    >
                      <Checkbox
                        checked={checked[key] ?? true}
                        disabled={apply.isPending}
                        onCheckedChange={(next) =>
                          setChecked((prev) => ({
                            ...prev,
                            [key]: next === true,
                          }))
                        }
                        aria-label={`${item.alias} @ ${item.channel_name}`}
                      />
                      <code className='bg-muted min-w-0 flex-1 truncate rounded px-1.5 py-0.5 font-mono text-xs'>
                        {item.alias}
                      </code>
                      <span className='text-muted-foreground shrink-0 text-xs'>
                        {item.channel_name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
