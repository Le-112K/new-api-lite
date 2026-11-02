import { Check, Crown, Info, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge, dotColorMap, textColorMap } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import { formatDuration, formatResetPeriod } from '@/features/subscriptions/lib'
import type {
  PlanRecord,
  SubscriptionPlan,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { useTopupInfo } from '@/features/wallet/hooks'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 订阅套餐页。
 *
 * 此前套餐是以「小部件」的形式塞在钱包页右栏，只能逐个切换查看，也挤不出位置
 * 说明权益。抽成独立页之后可以按列并排、等高对齐，一眼比完三档差异。
 *
 * 数据来源与购买流程完全复用原有实现（/api/subscription/plans、/api/subscription/self、
 * SubscriptionPurchaseDialog），这里只负责呈现。
 */
export function Plans() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { topupInfo } = useTopupInfo()

  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const [allSubscriptions, setAllSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  const loadPlans = useCallback(async () => {
    try {
      const res = requireServerSuccess(await getPublicPlans())
      if (res.success) setPlans(res.data || [])
    } catch (error) {
      handleServerError(error)
      setPlans([])
    }
  }, [])

  const loadSubscription = useCallback(async () => {
    try {
      const res = requireServerSuccess(await getSelfSubscriptionFull())
      if (res.success && res.data) {
        setActiveSubscriptions(res.data.subscriptions || [])
        setAllSubscriptions(res.data.all_subscriptions || [])
      }
    } catch (error) {
      handleServerError(error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadPlans(), loadSubscription()])
      setLoading(false)
    }
    init()
  }, [loadPlans, loadSubscription])

  // 同一套餐可能有多条记录（续费/叠加），按 plan_id 聚合成「当前生效」与「累计购买」两个视图。
  const activePlanIds = useMemo(
    () =>
      new Set(
        activeSubscriptions
          .map((record) => record?.subscription?.plan_id)
          .filter((id): id is number => typeof id === 'number')
      ),
    [activeSubscriptions]
  )

  const purchaseCountByPlan = useMemo(() => {
    const counts = new Map<number, number>()
    for (const record of allSubscriptions) {
      const planId = record?.subscription?.plan_id
      if (!planId) continue
      counts.set(planId, (counts.get(planId) ?? 0) + 1)
    }
    return counts
  }, [allSubscriptions])

  // 排序：优先用后台配置的 sort_order，其次按价格，保证三档从低到高稳定排列。
  const orderedPlans = useMemo(() => {
    return [...plans]
      .filter((record) => Boolean(record?.plan))
      .sort((a, b) => {
        const orderDiff = (a.plan.sort_order ?? 0) - (b.plan.sort_order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return Number(a.plan.price_amount || 0) - Number(b.plan.price_amount || 0)
      })
  }, [plans])

  const hasActive = activeSubscriptions.length > 0

  // 推荐档取排序后的中间一档：三档时正好是主力档，只有一档/两档时不标推荐，
  // 免得"唯一选择"上挂着推荐徽标显得滑稽。
  const recommendedPlanId = useMemo(() => {
    if (orderedPlans.length < 3) return null
    return orderedPlans[Math.floor(orderedPlans.length / 2)]?.plan.id ?? null
  }, [orderedPlans])

  // 生效中的订阅取最近到期的那条，用于概览条展示"用的哪档、还剩几天"。
  const primarySubscription = useMemo(() => {
    if (activeSubscriptions.length === 0) return null
    return [...activeSubscriptions].sort(
      (a, b) =>
        (b?.subscription?.end_time ?? 0) - (a?.subscription?.end_time ?? 0)
    )[0]
  }, [activeSubscriptions])

  const remainingDays = useMemo(() => {
    const endTime = primarySubscription?.subscription?.end_time ?? 0
    if (!endTime) return 0
    return Math.max(0, Math.ceil((endTime - Date.now() / 1000) / 86400))
  }, [primarySubscription])

  const currentPlanTitle = useMemo(() => {
    const planId = primarySubscription?.subscription?.plan_id
    if (!planId) return ''
    return (
      plans.find((record) => record.plan?.id === planId)?.plan?.title ?? ''
    )
  }, [primarySubscription, plans])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Subscription Plans')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5'>
          {/* 当前订阅概览：没有生效订阅时给一句引导，而不是留一块空白 */}
          <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
            <CardContent className='flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5'>
              <div className='flex min-w-0 items-center gap-2.5'>
                <Crown className='text-muted-foreground size-4 shrink-0' />
                <span className='text-sm font-medium'>
                  {t('My Subscriptions')}
                </span>
                <span className='flex items-center gap-1.5 text-xs font-medium'>
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      hasActive ? dotColorMap.success : dotColorMap.neutral
                    )}
                    aria-hidden='true'
                  />
                  {hasActive ? (
                    <span className={textColorMap.success}>
                      {currentPlanTitle || t('Active')}
                      {remainingDays > 0
                        ? ` · ${remainingDays} ${t('days left')}`
                        : ''}
                    </span>
                  ) : (
                    <span className='text-muted-foreground'>
                      {t('No Active')}
                    </span>
                  )}
                </span>
              </div>
              <p className='text-muted-foreground text-xs'>
                {hasActive
                  ? t('Your active plans are marked below')
                  : t('Subscribe to a plan for model access')}
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <div className={gridClass(3)}>
              {['first', 'second', 'third'].map((key) => (
                <Skeleton key={key} className='h-[460px] w-full rounded-xl' />
              ))}
            </div>
          ) : orderedPlans.length === 0 ? (
            <Card data-card-hover='false'>
              <CardContent className='text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm'>
                <Info className='size-5' />
                {t('No plans available')}
              </CardContent>
            </Card>
          ) : (
            <div className={gridClass(orderedPlans.length)}>
              {orderedPlans.map((record) => (
                <PlanCard
                  key={record.plan.id}
                  plan={record.plan}
                  isCurrent={activePlanIds.has(record.plan.id)}
                  isRecommended={record.plan.id === recommendedPlanId}
                  purchaseCount={purchaseCountByPlan.get(record.plan.id) ?? 0}
                  onSubscribe={() => {
                    setSelectedPlan(record)
                    setPurchaseOpen(true)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </SectionPageLayout.Content>

      <SubscriptionPurchaseDialog
        open={purchaseOpen}
        onOpenChange={(open) => {
          setPurchaseOpen(open)
          if (!open) loadSubscription()
        }}
        plan={selectedPlan}
        enableOnlineTopUp={topupInfo?.enable_online_topup}
        epayMethods={topupInfo?.pay_methods}
        userQuota={user?.quota}
        onPurchaseSuccess={loadSubscription}
      />
    </SectionPageLayout>
  )
}

/**
 * 按套餐数量决定列数。
 *
 * 后台通常配三档，但套餐是运营可增删的：只剩一两个时如果仍按三列排，
 * 卡片会挤在左侧三分之一处、右边大片留白。单档时顺带收窄容器，
 * 免得一张卡被拉成一整行的横幅。
 */
function gridClass(count: number): string {
  // 只有一档时必须居中：光给 max-w 而不给 mx-auto，卡片会贴在左边。
  if (count <= 1) return 'mx-auto grid w-full max-w-sm grid-cols-1 gap-4'
  // 多档交给 auto-fit 决定列数：每列最小 280px，容器够宽就三列并排，
  // 不够宽自动降到两列/一列，不会把卡片压扁，间距也始终一致。
  return 'grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]'
}

type PlanCardProps = {
  plan: SubscriptionPlan
  isCurrent: boolean
  isRecommended: boolean
  purchaseCount: number
  onSubscribe: () => void
}

/**
 * 单张套餐卡。
 *
 * 三张卡必须等高对齐：卡片 `h-full` + 内容列 `flex-col`，价格区固定高度、
 * 权益区 `flex-1` 撑开剩余空间，按钮永远贴在底部同一水平线。
 */
function PlanCard({
  plan,
  isCurrent,
  isRecommended,
  purchaseCount,
  onSubscribe,
}: PlanCardProps) {
  const { t } = useTranslation()

  const totalAmount = Number(plan.total_amount || 0)
  const price = Number(plan.price_amount || 0).toFixed(2)
  const limit = Number(plan.max_purchase_per_user || 0)
  const limitReached = limit > 0 && purchaseCount >= limit
  const resetPeriod = formatResetPeriod(plan, t)

  const benefits = [
    `${t('Validity Period')}: ${formatDuration(plan, t)}`,
    resetPeriod !== t('No Reset')
      ? `${t('Quota Reset')}: ${resetPeriod}`
      : null,
    totalAmount > 0
      ? `${t('Total Quota')}: ${formatQuota(totalAmount)}`
      : `${t('Total Quota')}: ${t('Unlimited')}`,
    plan.upgrade_group ? `${t('Group')}: ${plan.upgrade_group}` : null,
    limit > 0 ? `${t('Purchase Limit')}: ${limit}` : null,
  ].filter(Boolean) as string[]

  return (
    <Card
      data-card-hover='false'
      className={cn(
        // min-h 保证只有三行权益时卡片也不塌陷；h-full 让同一行的卡片等高。
        'flex h-full min-h-[460px] flex-col py-0',
        isCurrent
          ? 'ring-primary/70 ring-2'
          : isRecommended && 'border-primary/50'
      )}
    >
      <CardContent className='flex h-full flex-col p-6'>
        {/* 标题区：固定最小高度，避免不同标题长度把下面的价格推歪 */}
        <div className='flex min-h-[68px] items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-semibold'>
              {plan.title || t('Subscription Plans')}
            </h3>
            {plan.subtitle && (
              <p className='text-muted-foreground mt-0.5 truncate text-xs'>
                {plan.subtitle}
              </p>
            )}
          </div>
          {isCurrent ? (
            <StatusBadge variant='success' copyable={false} className='shrink-0'>
              {t('Current Plan')}
            </StatusBadge>
          ) : isRecommended ? (
            <StatusBadge variant='info' copyable={false} className='shrink-0'>
              <Sparkles className='size-3' />
              {t('Recommended')}
            </StatusBadge>
          ) : null}
        </div>

        {/* 价格区：固定高度，保证三张卡的数字在同一基线 */}
        <div className='flex min-h-[104px] items-end gap-2 py-4'>
          <span className='text-primary text-4xl leading-none font-bold'>
            ${price}
          </span>
          <span className='text-muted-foreground pb-0.5 text-xs'>
            / {formatDuration(plan, t)}
          </span>
        </div>

        <Separator className='mb-4' />

        {/* 权益区：吃掉剩余高度，把按钮顶到底部 */}
        <ul className='flex-1 space-y-3.5 pb-6'>
          {benefits.map((label) => (
            <li
              key={label}
              className='text-muted-foreground flex items-start gap-2.5 text-xs leading-relaxed'
            >
              <Check className='text-primary mt-0.5 size-3.5 shrink-0' />
              <span className='min-w-0'>{label}</span>
            </li>
          ))}
        </ul>

        {limitReached ? (
          <Tooltip>
            <TooltipTrigger render={<div />}>
              <Button variant='outline' className='h-10 w-full' disabled>
                {t('Limit Reached')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('Purchase limit reached')} ({purchaseCount}/{limit})
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant={isCurrent || !isRecommended ? 'outline' : 'default'}
            className='h-10 w-full'
            onClick={onSubscribe}
          >
            {isCurrent ? t('Renew') : t('Subscribe Now')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
