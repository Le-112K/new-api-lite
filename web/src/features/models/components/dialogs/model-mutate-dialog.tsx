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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { JsonEditor } from '@/components/json-editor'
import { LoadingState } from '@/components/loading-state'
import { LobeIconField } from '@/components/lobe-icon-field'
import { TagInput } from '@/components/tag-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CAPABILITY_LABEL_KEYS,
  MODEL_CAPABILITY_VALUES,
} from '@/features/pricing/lib/capability-labels'
import {
  requireServerSuccess,
  createServerError,
  getServerErrorMessage,
} from '@/lib/server-error-message'

import { createModel, updateModel, getModel, getVendors } from '../../api'
import { getNameRuleOptions, ENDPOINT_TEMPLATES } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../../lib'
import {
  modelFormSchema,
  transformModelToFormDefaults,
  transformFormDataToModelPayload,
  type ModelFormValues,
} from '../../lib/model-form'
import type { Model } from '../../types'

// 表单分组的行样式：短输入并排、全宽字段单列，替代旧抽屉的一整列。
// items-start 必须保留：grid 默认 stretch 会把矮的那列拉到与高的那列同高，
// 供应商下拉框因此被拉伸成约 110px 的高空框，内容悬在中间看着像错位。
const ROW_2COL = 'grid grid-cols-1 items-start gap-4 sm:grid-cols-2'
const SWITCH_ROW =
  'flex items-start justify-between gap-6 rounded-lg border p-3.5'

export function ModelMutateDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Model | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createdModel, setCreatedModel] = useState<{
    source: Model | null | undefined
    model: Model
  } | null>(null)
  const currentRow =
    createdModel && createdModel.source === props.currentRow
      ? createdModel.model
      : props.currentRow
  const isEditing = Boolean(currentRow?.id)
  const hasModelName = Boolean(currentRow?.model_name)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const loadedKey = useRef('')
  const form = useForm({
    resolver: zodResolver(modelFormSchema),
    defaultValues: transformModelToFormDefaults({
      model_name: '',
      status: 1,
      sync_official: 1,
      name_rule: 0,
    } as Model),
  })
  const vendorsQuery = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: async () =>
      requireServerSuccess(await getVendors({ page_size: 1000 })),
    enabled: props.open,
  })
  const vendors = vendorsQuery.data?.data?.items ?? []
  const selectedVendor = vendors.find(
    (vendor) => vendor.id === form.watch('vendor_id')
  )
  const modelQuery = useQuery({
    queryKey: modelsQueryKeys.detail(currentRow?.id ?? 0),
    queryFn: async () => {
      if (!currentRow?.id) throw new Error(t('Model ID is required'))
      const response = await getModel(currentRow.id)
      if (!response.success || !response.data) {
        throw createServerError(response, t('Failed to load model'))
      }
      return response.data
    },
    enabled: props.open && isEditing,
  })
  useEffect(() => {
    if (!props.open) return
    setCloseConfirm(false)
  }, [props.open, props.currentRow?.id, props.currentRow?.model_name])

  useEffect(() => {
    if (!props.open) {
      setCreatedModel(null)
      loadedKey.current = ''
      return
    }
    const key = currentRow?.id
      ? `metadata:${currentRow.id}`
      : `channel:${currentRow?.model_name ?? ''}`
    if (loadedKey.current === key || (isEditing && !modelQuery.data)) return
    form.reset(
      transformModelToFormDefaults(
        (isEditing
          ? modelQuery.data
          : {
              model_name: currentRow?.model_name ?? '',
              status: 1,
              sync_official: 1,
              name_rule: 0,
            }) as Model
      )
    )
    loadedKey.current = key
  }, [props.open, currentRow, isEditing, modelQuery.data, form])

  const save = useMutation({
    meta: { errorToast: false },
    onMutate: () => form.clearErrors('root.server'),
    mutationFn: async (values: ModelFormValues) => {
      const payload = transformFormDataToModelPayload(values)
      const response = currentRow?.id
        ? await updateModel({ ...payload, id: currentRow.id })
        : await createModel(payload)
      if (!response.success) {
        throw createServerError(response, t('Operation failed'))
      }
      return response
    },
    onSuccess: async (response) => {
      form.reset(form.getValues())
      if (response.data?.id) {
        if (!currentRow?.id) {
          setCreatedModel({ source: props.currentRow, model: response.data })
        }
        queryClient.setQueryData(
          modelsQueryKeys.detail(response.data.id),
          response.data
        )
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['pricing'] }),
        queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.all }),
      ])
      toast.success(t('Model metadata saved'))
      props.onOpenChange(false)
    },
    onError: (error) => {
      form.setError('root.server', {
        message: getServerErrorMessage(error, t('Operation failed')),
      })
    },
  })
  const isSubmitting = save.isPending
  const handleFillEndpointTemplate = (key: string) => {
    const template = ENDPOINT_TEMPLATES[key]
    if (template) {
      form.setValue('endpoints', JSON.stringify({ [key]: template }, null, 2), {
        shouldDirty: true,
      })
    }
  }
  const metadataDirty = form.formState.isDirty
  const close = (open: boolean) => {
    if (!open && isSubmitting) return
    if (!open && metadataDirty) {
      setCloseConfirm(true)
      return
    }
    props.onOpenChange(open)
  }

  return (
    <>
      <Dialog open={props.open} onOpenChange={close}>
        {/* 居中弹窗替代旧 1280px 侧抽屉：表单本来是单列，抽屉宽度浪费了
            一半屏幕；弹窗内 header 固定、表单区滚动、footer 固定。 */}
        <DialogContent className='flex max-h-[min(86vh,860px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
          <DialogHeader className='gap-1.5 border-b px-5 py-4'>
            {/* 标题与模型列表/广场卡片同源：优先展示名，模型 ID 降为副标题。 */}
            <DialogTitle className='pr-6 break-all'>
              {hasModelName
                ? currentRow?.display_name?.trim() || currentRow?.model_name
                : t('Create Model')}
            </DialogTitle>
            <DialogDescription className='flex flex-wrap items-center gap-2'>
              {hasModelName && currentRow?.display_name?.trim() && (
                <code className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]'>
                  {currentRow?.model_name}
                </code>
              )}
              <span>
                {t(
                  'Manage this model’s metadata. Changes apply when you save.'
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          {props.open && (
            <>
              {modelQuery.isError ? (
                <div className='min-h-0 flex-1 overflow-y-auto p-5'>
                  <ErrorState
                    title={t('Model metadata could not be loaded')}
                    // 后端原文（record not found）对运营不可读；换成可行动的
                    // 说明，原文留在 tooltip 里排查用。
                    description={t(
                      'The record may have been deleted, or this row came from stale data. Close this panel and refresh the list.'
                    )}
                    onRetry={() => void modelQuery.refetch()}
                    action={
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => close(false)}
                      >
                        {t('Close')}
                      </Button>
                    }
                  />
                </div>
              ) : null}
              {isEditing && modelQuery.isPending && (
                <div className='min-h-0 flex-1 overflow-y-auto p-5'>
                  <LoadingState />
                </div>
              )}
              {!modelQuery.isError && !(isEditing && modelQuery.isPending) && (
                <Form {...form}>
                  <form
                    id='model-form'
                    onSubmit={form.handleSubmit((values) =>
                      save.mutate(values)
                    )}
                    className='min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4'
                  >
                    {/* Basic Information */}
                    <section className='space-y-4'>
                      <h3 className='text-sm font-semibold'>
                        {t('Basic Information')}
                      </h3>

                      <div className={ROW_2COL}>
                        <FormField
                          control={form.control}
                          name='model_name'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel required>{t('Model Name')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('gpt-4, claude-3-opus, etc.')}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('The unique identifier for this model')}
                                {isEditing &&
                                  form.watch('model_name') !==
                                    currentRow?.model_name && (
                                    <span className='text-warning mt-1 block'>
                                      {t(
                                        'Renaming metadata does not rename channel models or move pricing. Existing prices stay with the original model name.'
                                      )}
                                    </span>
                                  )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='display_name'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Display name')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('Defaults to the model name')}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Shown on the model square and detail page. Leave empty to derive it from the model name.'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name='description'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Description')}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t('Describe this model...')}
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className={ROW_2COL}>
                        <FormField
                          control={form.control}
                          name='icon'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Icon')}</FormLabel>
                              <FormControl>
                                <LobeIconField
                                  key={`${currentRow?.id ?? 'new'}-${props.open}`}
                                  value={field.value ?? ''}
                                  onChange={field.onChange}
                                  allowInheritance
                                  inheritedIcon={selectedVendor?.icon}
                                  inheritedName={selectedVendor?.name}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='vendor_id'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Vendor')}</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={vendors.map((vendor) => ({
                                    value: String(vendor.id),
                                    label: vendor.name,
                                  }))}
                                  onValueChange={(value) =>
                                    field.onChange(
                                      value ? Number.parseInt(value) : undefined
                                    )
                                  }
                                  value={
                                    field.value ? String(field.value) : null
                                  }
                                  className='w-full'
                                  placeholder={t('Select vendor')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* 订阅制能力指标：详情页规格区展示的就是这两项。
                          留空 = 未知，详情显示破折号而不是编造数字。 */}
                      <div className={ROW_2COL}>
                        <FormField
                          control={form.control}
                          name='context_length'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Context Length')}</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  placeholder={t('e.g. 200000')}
                                  value={field.value || ''}
                                  onChange={(event) => {
                                    const next = event.target.value
                                    field.onChange(
                                      next === '' ? 0 : Number(next)
                                    )
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('Tokens. Leave 0 when unknown.')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='max_output_tokens'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Max output')}</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  placeholder={t('e.g. 384000')}
                                  value={field.value || ''}
                                  onChange={(event) => {
                                    const next = event.target.value
                                    field.onChange(
                                      next === '' ? 0 : Number(next)
                                    )
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Tokens per response. Leave 0 when unknown.'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name='capabilities'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Capabilities')}</FormLabel>
                            <FormControl>
                              <TagInput
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder={t('vision, tools, reasoning...')}
                                renderLabel={(value) =>
                                  t(
                                    CAPABILITY_LABEL_KEYS[
                                      value as keyof typeof CAPABILITY_LABEL_KEYS
                                    ] ?? value
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Shown as icons on the model card.')}
                            </FormDescription>
                            {/* 能力值有白名单且是英文标识，光给个自由输入框等于让运营背
                                code。这里把可选值摊开成胶囊，点一下追加，仓库里存的仍是标识。 */}
                            <div className='flex flex-wrap gap-1.5'>
                              {MODEL_CAPABILITY_VALUES.filter(
                                (value) => !(field.value || []).includes(value)
                              ).map((value) => (
                                <button
                                  key={value}
                                  type='button'
                                  className='border-border text-muted-foreground hover:border-foreground hover:text-foreground rounded-full border px-2 py-0.5 text-[11px] transition-colors'
                                  onClick={() =>
                                    field.onChange([
                                      ...(field.value || []),
                                      value,
                                    ])
                                  }
                                >
                                  {t(CAPABILITY_LABEL_KEYS[value])}
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='tags'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Tags')}</FormLabel>
                            <FormControl>
                              <TagInput
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder={t('Add tags...')}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Press Enter or comma to add tags')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </section>

                    {/* Matching Rules */}
                    <section className='space-y-4'>
                      <h3 className='text-sm font-semibold'>
                        {t('Matching Rules')}
                      </h3>

                      <FormField
                        control={form.control}
                        name='name_rule'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Name Rule')}</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={(value) =>
                                  field.onChange(Number.parseInt(value))
                                }
                                value={String(field.value)}
                                className='grid grid-cols-2 gap-3'
                              >
                                {getNameRuleOptions(t).map((option) => (
                                  <div
                                    key={option.value}
                                    className='flex items-center space-x-2'
                                  >
                                    <RadioGroupItem
                                      value={String(option.value)}
                                      id={`rule-${option.value}`}
                                    />
                                    <Label
                                      htmlFor={`rule-${option.value}`}
                                      className='cursor-pointer font-normal'
                                    >
                                      {option.label}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Determines which channel model names this metadata applies to.'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </section>

                    {/* Endpoints */}
                    <section className='space-y-4'>
                      <div className='flex items-center justify-between'>
                        <h3 className='text-sm font-semibold'>
                          {t('Endpoints')}
                        </h3>
                        <Combobox
                          options={Object.keys(ENDPOINT_TEMPLATES).map(
                            (key) => ({ value: key, label: key })
                          )}
                          onValueChange={(value: string | null) => {
                            if (value) handleFillEndpointTemplate(value)
                          }}
                          className='w-[200px]'
                          placeholder={t('Load template...')}
                          aria-label={t('Load template...')}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name='endpoints'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Endpoint Configuration')}</FormLabel>
                            <FormControl>
                              <JsonEditor
                                value={field.value || ''}
                                onChange={field.onChange}
                                keyPlaceholder='endpoint_type'
                                valuePlaceholder='{"path": "/v1/...", "method": "POST"}'
                                keyLabel='Endpoint Type'
                                valueLabel='Configuration'
                                valueType='any'
                                emptyMessage={t(
                                  'No endpoints configured. Switch to JSON mode or add rows to define endpoints.'
                                )}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Define API endpoints for this model (JSON format)'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </section>

                    {/* Status & Sync */}
                    <section className='space-y-3'>
                      <h3 className='text-sm font-semibold'>
                        {t('Status & Sync')}
                      </h3>

                      <FormField
                        control={form.control}
                        name='status'
                        render={({ field }) => (
                          <FormItem className={SWITCH_ROW}>
                            <div className='flex flex-col gap-0.5'>
                              <FormLabel>
                                {t('Model square visibility')}
                              </FormLabel>
                              <FormDescription>
                                {t(
                                  'Allow listing when a channel is available, billing is configured, and the user has group access. This does not change API access.'
                                )}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='sync_official'
                        render={({ field }) => (
                          <FormItem className={SWITCH_ROW}>
                            <div className='flex flex-col gap-0.5'>
                              <FormLabel>{t('Allow metadata sync')}</FormLabel>
                              <FormDescription>
                                {t(
                                  'Allows selected fields to be overwritten after a sync preview. No automatic synchronization.'
                                )}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </section>
                  </form>
                </Form>
              )}
              {!modelQuery.isError && !(isEditing && modelQuery.isPending) && (
                <div className='flex flex-col gap-3 border-t px-5 py-4'>
                  {form.formState.errors.root?.server?.message && (
                    <Alert variant='destructive'>
                      <AlertDescription className='break-words'>
                        {form.formState.errors.root.server.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant='outline'
                      onClick={() => close(false)}
                      disabled={isSubmitting}
                    >
                      {t('Close')}
                    </Button>
                    <Button
                      form='model-form'
                      type='submit'
                      disabled={
                        isSubmitting ||
                        modelQuery.isError ||
                        (isEditing && modelQuery.isPending)
                      }
                    >
                      {isSubmitting ? t('Saving...') : t('Save metadata')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={closeConfirm}
        onOpenChange={setCloseConfirm}
        title={t('Discard unsaved changes?')}
        desc={t('Your changes have not been saved.')}
        confirmText={t('Discard changes')}
        handleConfirm={() => {
          setCloseConfirm(false)
          props.onOpenChange(false)
        }}
      />
    </>
  )
}
