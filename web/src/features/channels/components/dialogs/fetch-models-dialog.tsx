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
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { matchStandardModels } from '@/features/models/api'
import type { StandardMatch } from '@/features/models/types'
import { handleServerError } from '@/lib/handle-server-error'

import { fetchUpstreamModels, updateChannel } from '../../api'
import {
  channelsQueryKeys,
  normalizeModelName,
  parseModelsString,
} from '../../lib'
import { useChannels } from '../channels-provider'
import { UpstreamModelSelection } from '../upstream-model-selection'

function normalizeModelNameList(models: readonly string[]): string[] {
  return [...new Set(models.map((m) => normalizeModelName(m)).filter(Boolean))]
}

type FetchModelsDialogBaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectModels?: string[]
  redirectSourceModels?: string[]
  customFetcher?: () => Promise<string[]>
  channelName?: string | null
}

type FetchModelsDialogProps = FetchModelsDialogBaseProps &
  (
    | {
        onModelsSelected: (models: string[]) => void
        existingModelsOverride: string[]
      }
    | {
        onModelsSelected?: undefined
        existingModelsOverride?: undefined
      }
  )

export function FetchModelsDialog({
  open,
  onOpenChange,
  onModelsSelected,
  redirectModels = [],
  redirectSourceModels = [],
  customFetcher,
  existingModelsOverride,
  channelName,
}: FetchModelsDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const activeChannel = customFetcher ? null : currentRow
  const queryClient = useQueryClient()
  const [isFetching, setIsFetching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [candidateModels, setCandidateModels] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  // 拉取结果按元数据名称规则匹配出的标准模型映射；勾选项在保存时落进
  // models + model_mapping，客户端即可用标准模型名调用。
  const [standardMatches, setStandardMatches] = useState<StandardMatch[]>([])
  const [acceptedMappings, setAcceptedMappings] = useState<
    Record<string, boolean>
  >({})

  // Parse existing models
  const existingModels = useMemo(
    () =>
      existingModelsOverride ?? parseModelsString(activeChannel?.models || ''),
    [existingModelsOverride, activeChannel?.models]
  )

  const fetchedModelSet = new Set(normalizeModelNameList(fetchedModels))
  const redirectSourceSet = new Set(
    normalizeModelNameList(redirectSourceModels)
  )
  const hasUnlistedModels = normalizeModelNameList([
    ...candidateModels,
    ...selectedModels,
  ]).some(
    (model) => !fetchedModelSet.has(model) && !redirectSourceSet.has(model)
  )

  useEffect(() => {
    if (open && (activeChannel || customFetcher)) {
      handleFetchModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeChannel?.id, customFetcher])

  const handleFetchModels = async () => {
    if (!activeChannel && !customFetcher) return

    setIsFetching(true)
    try {
      const applyMatches = async (list: string[]) => {
        // 匹配失败不阻断拉取流程：没有建议时用户仍可手工配置映射。
        try {
          const response = await matchStandardModels(list)
          setStandardMatches(
            response.success && Array.isArray(response.data)
              ? response.data
              : []
          )
        } catch {
          setStandardMatches([])
        }
        setAcceptedMappings({})
      }
      if (customFetcher) {
        const list = await customFetcher()
        setFetchedModels(list)
        setCandidateModels(existingModels)
        setSelectedModels(existingModels)
        void applyMatches(list)
        toast.success(t('Fetched {{count}} models', { count: list.length }))
      } else if (activeChannel) {
        const response = await fetchUpstreamModels(activeChannel.id)
        if (response.success) {
          const list = Array.isArray(response.data) ? response.data : []
          setFetchedModels(list)
          setCandidateModels(existingModels)
          setSelectedModels(existingModels)
          void applyMatches(list)
          toast.success(t('Fetched {{count}} models', { count: list.length }))
        } else {
          handleServerError(response, t('Failed to fetch models'))
          setFetchedModels([])
          setStandardMatches([])
        }
      }
    } catch (error: unknown) {
      handleServerError(error, t('Failed to fetch models'))
      setFetchedModels([])
    } finally {
      setIsFetching(false)
    }
  }

  // 展示在对话框里的映射建议：有归属、原名仍在勾选列表中、且用户未取消。
  const activeMappings = standardMatches.filter(
    (match) =>
      match.mapped &&
      selectedModels.includes(match.name) &&
      (acceptedMappings[match.name] ?? true)
  )

  const handleSave = async () => {
    // If onModelsSelected callback is provided, use it (form filling mode)
    if (onModelsSelected) {
      onModelsSelected(selectedModels)
      toast.success(t('Models filled to form'))
      onOpenChange(false)
      return
    }

    // Otherwise, directly save to API (standalone mode)
    if (!activeChannel) return
    setIsSaving(true)
    try {
      // 接受的标准模型映射：models 追加标准名（别名保留，版本仍可挑），
      // model_mapping 合并 {标准名: 原名}（不覆盖已有映射，兼容手工配置）。
      const standardAdds = activeMappings
        .map((match) => match.standard)
        .filter((standard) => !selectedModels.includes(standard))
      const modelsString = [...selectedModels, ...standardAdds].join(',')
      let mapping: Record<string, string> = {}
      const rawMapping = (activeChannel.model_mapping ?? '').trim()
      if (rawMapping !== '' && rawMapping !== '{}') {
        try {
          mapping = JSON.parse(rawMapping)
        } catch {
          mapping = {}
        }
      }
      for (const match of activeMappings) {
        if (!(match.standard in mapping)) {
          mapping[match.standard] = match.name
        }
      }
      const response = await updateChannel(activeChannel.id, {
        models: modelsString,
        model_mapping: JSON.stringify(mapping),
      })
      if (response.success) {
        toast.success(t('Models updated successfully'))
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        handleServerError(response, t('Failed to update models'))
      }
    } catch (error: unknown) {
      handleServerError(error, t('Failed to update models'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setFetchedModels([])
    setCandidateModels([])
    setSelectedModels([])
    setStandardMatches([])
    setAcceptedMappings({})
    onOpenChange(false)
  }

  const showFooterActions =
    !!(activeChannel || customFetcher) &&
    !isFetching &&
    (fetchedModels.length > 0 || hasUnlistedModels)

  let dialogDescription: ReactNode = t('Fetch available models from upstream')
  if (activeChannel) {
    dialogDescription = (
      <>
        {t('Channel:')} <strong>{activeChannel.name}</strong>
      </>
    )
  } else if (channelName) {
    dialogDescription = (
      <>
        {t('Channel:')} <strong>{channelName}</strong>
      </>
    )
  }

  let dialogBody: ReactNode
  if (!activeChannel && !customFetcher) {
    dialogBody = (
      <div className='text-muted-foreground py-8 text-center'>
        {t('No channel selected')}
      </div>
    )
  } else if (isFetching) {
    dialogBody = (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  } else if (fetchedModels.length === 0 && !hasUnlistedModels) {
    dialogBody = (
      <div className='text-muted-foreground py-8 text-center'>
        <p>{t('No models fetched yet.')}</p>
        <Button
          className='mt-4'
          onClick={handleFetchModels}
          disabled={isFetching}
        >
          {t('Fetch Models')}
        </Button>
      </div>
    )
  } else {
    dialogBody = (
      <div className='space-y-3'>
        {activeMappings.length > 0 && (
          <div className='bg-muted/30 space-y-2 rounded-lg border p-3'>
            <div className='flex flex-col gap-0.5'>
              <p className='text-xs font-semibold'>
                {t('Standard model mapping')}
              </p>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Matched names stay callable as-is and are also exposed under the standard model name; the gateway rewrites standard-name requests to the original name per channel.'
                )}
              </p>
            </div>
            {activeMappings.map((match) => (
              <label
                key={match.name}
                className='flex min-w-0 cursor-pointer items-center gap-2 text-xs'
              >
                <Checkbox
                  className='mt-0'
                  checked={acceptedMappings[match.name] ?? true}
                  disabled={isSaving}
                  onCheckedChange={(next) =>
                    setAcceptedMappings((prev) => ({
                      ...prev,
                      [match.name]: next === true,
                    }))
                  }
                  aria-label={`${match.name} → ${match.standard}`}
                />
                <code className='bg-muted min-w-0 truncate rounded px-1.5 py-0.5 font-mono'>
                  {match.name}
                </code>
                <span aria-hidden className='text-muted-foreground shrink-0'>
                  →
                </span>
                <code className='text-foreground min-w-0 truncate rounded bg-black/5 px-1.5 py-0.5 font-mono font-semibold dark:bg-white/10'>
                  {match.standard}
                </code>
              </label>
            ))}
          </div>
        )}
        <UpstreamModelSelection
          models={fetchedModels}
          selected={selectedModels}
          onChange={setSelectedModels}
          existingModels={existingModels}
          redirectModels={redirectModels}
          redirectSourceModels={redirectSourceModels}
        />
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t('Fetch Models')}
      description={dialogDescription}
      contentClassName='max-w-3xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        showFooterActions ? (
          <>
            <Button variant='outline' onClick={handleClose} disabled={isSaving}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isSaving ? t('Saving...') : t('Save Models')}
            </Button>
          </>
        ) : null
      }
    >
      {dialogBody}
    </Dialog>
  )
}
