import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import type { PlanRecord } from '@/features/subscriptions/types'
import { useAuthStore } from '@/stores/auth-store'

import { PlansContent } from '..'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@/features/subscriptions/api', () => ({
  getPublicPlans: vi.fn(),
  getSelfSubscriptionFull: vi.fn(),
}))

// 余额属于个人数据；匿名页面不该为它发请求。这里直接给一个空实现，
// 同时避免真实 hook 在测试里触发网络。
vi.mock('@/features/wallet/hooks', () => ({
  useTopupInfo: () => ({
    topupInfo: null,
    presetAmounts: [],
    loading: false,
    refetch: vi.fn(),
  }),
}))

function makePlan(id: number, title: string, price: number): PlanRecord {
  return {
    plan: {
      id,
      title,
      subtitle: '',
      price_amount: price,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'never',
      total_amount: 0,
      upgrade_group: 'vip',
      max_purchase_per_user: 0,
      allow_balance_pay: true,
    },
  } as PlanRecord
}

function renderPage(props: { autoOpenPlanId?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlansContent {...props} />
    </QueryClientProvider>
  )
}

function setAnonymous() {
  useAuthStore.setState({
    auth: { ...useAuthStore.getState().auth, user: null, accessToken: null },
  })
}

describe('订阅页未登录浏览', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAnonymous()
    vi.mocked(getPublicPlans).mockResolvedValue({
      success: true,
      message: '',
      data: [makePlan(1, 'Lite轻享版', 6.88), makePlan(2, 'Pro专业版', 18.88)],
    })
  })

  it('匿名也能看到全部套餐与价格', async () => {
    renderPage()

    expect(await screen.findByText('Lite轻享版')).toBeInTheDocument()
    expect(screen.getByText('Pro专业版')).toBeInTheDocument()
    expect(screen.getByText('$6.88')).toBeInTheDocument()
  })

  it('匿名不请求「我的订阅」', async () => {
    renderPage()

    await screen.findByText('Lite轻享版')
    expect(getSelfSubscriptionFull).not.toHaveBeenCalled()
  })

  it('匿名点订阅先去登录，并带上这档套餐回跳', async () => {
    renderPage()

    const buttons = await screen.findAllByRole('button', {
      name: 'Subscribe Now',
    })
    await userEvent.click(buttons[0])

    expect(navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: '/subscribe?plan=1' },
    })
  })

  it('登录后按回跳参数自动打开对应套餐的购买框', async () => {
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        user: { id: 9, role: 1, quota: 0 } as never,
        accessToken: 'token',
      },
    })
    vi.mocked(getSelfSubscriptionFull).mockResolvedValue({
      success: true,
      message: '',
      data: { subscriptions: [], all_subscriptions: [] },
    } as never)

    renderPage({ autoOpenPlanId: 2 })

    await screen.findByText('Pro专业版')
    // 登录回跳后应直接弹出购买框，用户不用再找一遍刚点的是哪张卡。
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
