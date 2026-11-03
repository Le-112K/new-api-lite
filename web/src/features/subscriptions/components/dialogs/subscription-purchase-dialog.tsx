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
import { Crown, CalendarClock, Package, CreditCard, Wallet } from 'lucide-react'
import { useState, useEffect, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSystemConfig } from '@/hooks/use-system-config'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { DEFAULT_CURRENCY_CONFIG } from '@/stores/system-config-store'

import { paySubscriptionEpay, paySubscriptionBalance } from '../../api'
import { formatDuration, formatResetPeriod } from '../../lib'
import type { PlanRecord } from '../../types'

interface PaymentMethod {
  type: string
  name?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanRecord | null
  enableOnlineTopUp?: boolean
  epayMethods?: PaymentMethod[]
  purchaseLimit?: number
  purchaseCount?: number
  userQuota?: number
  onPurchaseSuccess?: () => void | Promise<void>
}

/** 在线渠道的展示名：后台只给了 type 时用本地化名称兜底。 */
function epayLabel(method: PaymentMethod, t: (key: string) => string): string {
  if (method.name) return method.name
  const type = method.type.toLowerCase()
  if (type.includes('wx') || type.includes('wechat')) return t('WeChat Pay')
  if (type.includes('ali')) return t('Alipay')
  return method.type
}

/** 一行可选的支付方式：左边图标+名称，右边补充信息（余额 / 渠道说明）。 */
function PaymentOption(props: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  icon: ElementType
  label: string
  hint?: string
}) {
  const Icon = props.icon
  return (
    <button
      type='button'
      onClick={props.onSelect}
      disabled={props.disabled}
      aria-pressed={props.selected}
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
        props.selected
          ? 'border-foreground bg-muted/60'
          : 'border-border hover:bg-muted/40',
        props.disabled && 'pointer-events-none opacity-50'
      )}
    >
      <span className='flex min-w-0 items-center gap-2'>
        <Icon className='size-4 shrink-0' />
        <span className='truncate font-medium'>{props.label}</span>
      </span>
      {props.hint ? (
        <span className='text-muted-foreground shrink-0 text-[11px]'>
          {props.hint}
        </span>
      ) : null}
    </button>
  )
}

export function SubscriptionPurchaseDialog(props: Props) {
  const { t } = useTranslation()
  const { currency } = useSystemConfig()
  const [paying, setPaying] = useState(false)
  // 选中的支付方式：'balance' 或某个在线支付渠道的 type（wxpay / alipay …）。
  const [method, setMethod] = useState('')

  useEffect(() => {
    if (!props.open) {
      setMethod('')
      return
    }
    // 默认选中余额；余额被该套餐禁用时退到第一个在线渠道。
    setMethod((current) => {
      if (current) return current
      const epay = props.enableOnlineTopUp ? (props.epayMethods ?? []) : []
      if (props.plan?.plan?.allow_balance_pay === false && epay.length > 0) {
        return epay[0].type
      }
      return 'balance'
    })
  }, [props.open, props.epayMethods, props.enableOnlineTopUp, props.plan])

  const plan = props.plan?.plan
  if (!plan) return null

  const hasEpay =
    props.enableOnlineTopUp && (props.epayMethods || []).length > 0
  const totalAmount = Number(plan.total_amount || 0)
  const price = Number(plan.price_amount || 0).toFixed(2)
  const quotaPerUnit =
    currency?.quotaPerUnit && currency.quotaPerUnit > 0
      ? currency.quotaPerUnit
      : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const balanceCost = Math.max(
    0,
    Math.ceil(Number(plan.price_amount || 0) * quotaPerUnit)
  )
  const userQuota = Math.max(0, Number(props.userQuota || 0))
  const allowBalancePay = plan.allow_balance_pay !== false
  const insufficientBalance = userQuota < balanceCost
  const limitReached =
    (props.purchaseLimit || 0) > 0 &&
    (props.purchaseCount || 0) >= (props.purchaseLimit || 0)

  const isSafari =
    typeof navigator !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  const handlePayEpay = async (paymentMethod: string) => {
    if (!paymentMethod) {
      toast.error(t('Please select a payment method'))
      return
    }
    setPaying(true)
    try {
      const res = await paySubscriptionEpay({
        plan_id: plan.id,
        payment_method: paymentMethod,
      })
      if (res.message === 'success' && res.url) {
        const form = document.createElement('form')
        form.action = res.url
        form.method = 'POST'
        if (!isSafari) {
          form.target = '_blank'
        }
        Object.entries(res.data || {}).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        document.body.removeChild(form)
        toast.success(t('Payment initiated'))
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayBalance = async () => {
    if (!allowBalancePay) {
      toast.error(t('This plan does not allow balance redemption'))
      return
    }
    setPaying(true)
    try {
      const res = await paySubscriptionBalance({ plan_id: plan.id })
      if (res.success) {
        toast.success(t('Subscription purchased successfully'))
        void props.onPurchaseSuccess?.()
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePay = () => {
    if (method === 'balance') {
      void handlePayBalance()
      return
    }
    void handlePayEpay(method)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <>
          <Crown className='h-5 w-5' />
          {t('Purchase Subscription')}
        </>
      }
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      titleClassName='flex items-center gap-2'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <div className='space-y-3 sm:space-y-4'>
        <div className='bg-muted/50 space-y-2.5 rounded-lg border p-3 sm:space-y-3 sm:p-4'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Plan Name')}
            </span>
            <span className='max-w-[200px] truncate text-sm font-medium'>
              {plan.title}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Validity Period')}
            </span>
            <span className='flex items-center gap-1 text-sm'>
              <CalendarClock className='h-3.5 w-3.5' />
              {formatDuration(plan, t)}
            </span>
          </div>
          {formatResetPeriod(plan, t) !== t('No Reset') && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Reset Period')}
              </span>
              <span className='text-sm'>{formatResetPeriod(plan, t)}</span>
            </div>
          )}
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Plan Quota')}
            </span>
            <span className='flex items-center gap-1 text-sm'>
              <Package className='h-3.5 w-3.5' />
              {totalAmount > 0 ? formatQuota(totalAmount) : t('Unlimited')}
            </span>
          </div>
          <Separator />
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>{t('Amount Due')}</span>
            <span className='text-primary text-lg font-bold'>${price}</span>
          </div>
        </div>

        {limitReached && (
          <Alert variant='destructive'>
            <AlertDescription>
              {t('Purchase limit reached')} ({props.purchaseCount}/
              {props.purchaseLimit})
            </AlertDescription>
          </Alert>
        )}

        <div className='space-y-2'>
          <p className='text-muted-foreground text-xs'>
            {t('Select payment method')}
          </p>
          <div className='grid gap-2'>
            {allowBalancePay && (
              <PaymentOption
                selected={method === 'balance'}
                disabled={limitReached}
                onSelect={() => setMethod('balance')}
                icon={Wallet}
                label={t('Pay with Balance')}
                hint={`${formatQuota(userQuota)} / ${formatQuota(balanceCost)}`}
              />
            )}
            {hasEpay &&
              (props.epayMethods ?? []).map((epay) => (
                <PaymentOption
                  key={epay.type}
                  selected={method === epay.type}
                  disabled={limitReached}
                  onSelect={() => setMethod(epay.type)}
                  icon={CreditCard}
                  label={epayLabel(epay, t)}
                  hint={t('Online payment')}
                />
              ))}
          </div>
          {!allowBalancePay && !hasEpay && (
            <Alert variant='destructive'>
              <AlertDescription>
                {t('This plan does not allow balance redemption')}
              </AlertDescription>
            </Alert>
          )}
          {method === 'balance' && allowBalancePay && insufficientBalance && (
            <Alert variant='destructive'>
              <AlertDescription>{t('Insufficient balance')}</AlertDescription>
            </Alert>
          )}
        </div>

        <Button
          className='w-full'
          onClick={handlePay}
          disabled={
            paying ||
            limitReached ||
            !method ||
            (method === 'balance' && (!allowBalancePay || insufficientBalance))
          }
        >
          {t('Pay')} ${price}
        </Button>
      </div>
    </Dialog>
  )
}
