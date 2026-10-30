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
import { Save } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
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
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getSitePricingCurrency,
  isValidPricingCurrency,
  USD_PRICING_CURRENCY,
} from '@/features/model-pricing/currency'
import { PricingAmountInput } from '@/features/model-pricing/pricing-amount-input'
import { PricingCurrencySelector } from '@/features/model-pricing/pricing-currency-selector'
import { cn } from '@/lib/utils'
import { usePricingPreferencesStore } from '@/stores/pricing-preferences-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  buildPreviewRows,
  createModelPricingSchema,
  type ModelPricingFormValues,
  type ModelRatioData,
} from './model-pricing-core'

export type { ModelRatioData } from './model-pricing-core'

type ModelPricingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: ModelRatioData | null
  onSave?: () => void | Promise<void>
  isSaving?: boolean
  onDirtyChange?: (dirty: boolean) => void
}

type ModelPricingEditorPanelProps = Omit<
  ModelPricingSheetProps,
  'open' | 'onOpenChange'
> & {
  className?: string
  embedded?: boolean
  scrollHeader?: ReactNode
}

export type ModelPricingEditorPanelHandle = {
  commitDraft: () => Promise<ModelRatioData | null>
}

export const ModelPricingSheet = forwardRef<
  ModelPricingEditorPanelHandle,
  ModelPricingSheetProps
>(function ModelPricingSheet(
  { open, onOpenChange, editData, onSave, isSaving, onDirtyChange },
  ref
) {
  const { t } = useTranslation()
  const title = editData ? t('Edit model pricing') : t('Add model pricing')
  const description = editData?.name || t('New model')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className={sideDrawerContentClassName('sm:max-w-2xl')}
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ModelPricingEditorPanel
          ref={ref}
          editData={editData}
          onDirtyChange={onDirtyChange}
          onSave={onSave}
          isSaving={isSaving}
          className='h-full rounded-none border-0'
        />
      </SheetContent>
    </Sheet>
  )
})

export const ModelPricingEditorPanel = forwardRef<
  ModelPricingEditorPanelHandle,
  ModelPricingEditorPanelProps
>(function ModelPricingEditorPanel(
  {
    editData,
    className,
    onSave,
    isSaving,
    onDirtyChange,
    embedded,
    scrollHeader,
  },
  ref
) {
  const { t } = useTranslation()
  const formElementRef = useRef<HTMLFormElement>(null)
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const preference = usePricingPreferencesStore((state) => state.currency)
  const siteCurrency = useMemo(
    () => getSitePricingCurrency(currencyConfig),
    [currencyConfig]
  )
  const currency =
    preference === 'site' && isValidPricingCurrency(siteCurrency)
      ? siteCurrency
      : USD_PRICING_CURRENCY
  const isEditMode = !!editData
  // Bumped whenever the editor reloads, so inputs drop any uncommitted draft.
  const [editorReloadToken, setEditorReloadToken] = useState(0)

  const form = useForm<ModelPricingFormValues>({
    resolver: zodResolver(createModelPricingSchema(t)),
    defaultValues: {
      name: '',
      price: '',
    },
  })
  const watchedValues = form.watch()

  useEffect(() => {
    if (editData) {
      form.reset({ name: editData.name, price: editData.price || '' })
    } else {
      form.reset({ name: '', price: '' })
    }
    setEditorReloadToken((token) => token + 1)
  }, [editData, form])

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty)
  }, [onDirtyChange, form.formState.isDirty])

  const previewRows = useMemo(
    () => buildPreviewRows(watchedValues, t, currency),
    [watchedValues, t, currency]
  )

  const validatePricingValues = useCallback(() => {
    const raw = form.getValues('price') ?? ''
    if (raw === '') return true
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      form.setError('price', {
        message: t('Enter a finite, non-negative price'),
      })
      return false
    }
    return true
  }, [form, t])

  const buildSubmitData = useCallback(
    (values: ModelPricingFormValues): ModelRatioData => ({
      name: values.name.trim(),
      price: values.price || '',
    }),
    []
  )

  useImperativeHandle(
    ref,
    () => ({
      commitDraft: async () => {
        const amounts =
          formElementRef.current?.querySelectorAll<HTMLInputElement>(
            'input[data-pricing-amount]'
          )
        if (amounts && [...amounts].some((input) => !input.reportValidity())) {
          return null
        }
        const isValid = await form.trigger()
        if (!isValid || !validatePricingValues()) return null
        return buildSubmitData(form.getValues())
      },
    }),
    [form, validatePricingValues, buildSubmitData]
  )

  const showActions = Boolean(onSave)

  return (
    <div
      className={cn(
        'bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className
      )}
    >
      {!embedded && (
        <div className='border-b p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h3 className='truncate text-base font-medium'>
                {isEditMode ? t('Edit model pricing') : t('Add model pricing')}
              </h3>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form
          ref={formElementRef}
          onSubmit={(event) => event.preventDefault()}
          className='flex min-h-0 flex-1 flex-col'
          autoComplete='off'
        >
          <div
            role='region'
            aria-label={
              isEditMode ? t('Edit model pricing') : t('Add model pricing')
            }
            className='@container/pricing-editor min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-6'
          >
            {scrollHeader && (
              <div className='mb-4 space-y-3'>{scrollHeader}</div>
            )}
            <div className='grid min-w-0 items-start gap-4 @min-[960px]/pricing-editor:grid-cols-[minmax(0,1fr)_260px]'>
              <FieldGroup className='min-w-0'>
                {!embedded && (
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Model name')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('gpt-4')}
                            {...field}
                            disabled={isEditMode}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'The exact model identifier as used in API requests.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <PricingCurrencySelector siteCurrency={siteCurrency} />

                <FieldGroup className='gap-5'>
                  <FormField
                    control={form.control}
                    name='price'
                    render={({ field }) => (
                      <FormItem className='contents'>
                        <Field>
                          <FormLabel>{t('Fixed price')}</FormLabel>
                          <InputGroup className='has-[[data-pricing-error]]:h-auto has-[[data-pricing-error]]:flex-wrap'>
                            <InputGroupAddon>{currency.symbol}</InputGroupAddon>
                            <FormControl>
                              <PricingAmountInput
                                key={editorReloadToken}
                                {...field}
                                value={field.value ?? ''}
                                currency={currency}
                                grouped
                                placeholder='0.01'
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <InputGroupAddon align='inline-end'>
                              {t('per request')}
                            </InputGroupAddon>
                          </InputGroup>
                          <FormDescription>
                            {t(
                              'Cost in {{currency}} per request, regardless of tokens used.',
                              { currency: currency.label }
                            )}
                          </FormDescription>
                          <FormMessage />
                        </Field>
                      </FormItem>
                    )}
                  />
                </FieldGroup>
              </FieldGroup>

              <aside
                aria-label={t('Preview')}
                className='bg-muted/20 min-w-0 rounded-lg border @min-[960px]/pricing-editor:sticky @min-[960px]/pricing-editor:top-0'
              >
                <div className='border-b px-3 py-2'>
                  <div className='text-sm font-medium'>{t('Preview')}</div>
                </div>
                <div className='divide-y'>
                  {previewRows.map((row) => (
                    <div key={row.key} className='grid gap-1 px-3 py-2.5'>
                      <span className='text-muted-foreground text-xs'>
                        {row.label}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 text-sm',
                          row.multiline
                            ? 'font-mono text-xs leading-5 break-words whitespace-pre-wrap'
                            : 'truncate'
                        )}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
          {showActions && (
            <div className='bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 border-t p-3 backdrop-blur'>
              <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                {onSave && (
                  <Button
                    type='button'
                    onClick={onSave}
                    disabled={isSaving}
                    className='w-full sm:w-auto'
                  >
                    <Save data-icon='inline-start' />
                    {isSaving ? t('Saving...') : t('Save model prices')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  )
})
