import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  paySubscriptionBalance,
  paySubscriptionEpay,
} from '@/features/subscriptions/api'
import type { PlanRecord } from '@/features/subscriptions/types'

import { SubscriptionPurchaseDialog } from '../subscription-purchase-dialog'

vi.mock('@/features/subscriptions/api', () => ({
  paySubscriptionBalance: vi.fn(),
  paySubscriptionEpay: vi.fn(),
}))

const plan = {
  plan: {
    id: 2,
    title: 'Pro',
    price_amount: 18.88,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'never',
    total_amount: 1000,
    allow_balance_pay: true,
    max_purchase_per_user: 0,
  },
} as PlanRecord

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionPurchaseDialog
        open
        onOpenChange={() => {}}
        plan={plan}
        enableOnlineTopUp
        epayMethods={[{ type: 'wxpay', name: '微信支付' }, { type: 'alipay' }]}
        userQuota={100000000}
        purchaseLimit={0}
        purchaseCount={0}
      />
    </QueryClientProvider>
  )
}

describe('订阅支付方式选择', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(paySubscriptionBalance).mockResolvedValue({
      success: true,
      message: '',
    } as never)
    vi.mocked(paySubscriptionEpay).mockResolvedValue({
      message: 'success',
      url: 'https://pay.example.com',
      data: {},
    } as never)
  })

  it('点开订阅先列出余额 / 微信 / 支付宝三种方式', async () => {
    renderDialog()

    expect(await screen.findByText('Pay with Balance')).toBeInTheDocument()
    expect(screen.getByText('微信支付')).toBeInTheDocument()
    // 后台只给 type 时用本地化名称兜底
    expect(screen.getByText('Alipay')).toBeInTheDocument()
  })

  it('默认走余额支付', async () => {
    renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: /Pay \$/ }))

    expect(paySubscriptionBalance).toHaveBeenCalledWith({ plan_id: 2 })
    expect(paySubscriptionEpay).not.toHaveBeenCalled()
  })

  it('选微信支付后走到对应渠道，不再扣余额', async () => {
    renderDialog()

    await userEvent.click(await screen.findByText('微信支付'))
    await userEvent.click(screen.getByRole('button', { name: /Pay \$/ }))

    expect(paySubscriptionEpay).toHaveBeenCalledWith({
      plan_id: 2,
      payment_method: 'wxpay',
    })
    expect(paySubscriptionBalance).not.toHaveBeenCalled()
  })
})
