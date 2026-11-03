import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'

import { PlansContent } from '.'

/**
 * 前台的独立订阅页。
 *
 * 与控制台内的 /plans 共用同一份内容体（{@link PlansContent}）与数据源，
 * 区别只在壳：这里套前台布局（公开导航 + 页脚），因此从前台点「订阅」
 * 看到的是完整的产品页，不会被带进控制台外壳。
 *
 * 用 showMainContainer={false} 自己管容器宽度，与 /pricing 保持一致；
 * pt-16 起步是为了避开 fixed 定位的顶部导航。
 */
export function SubscribePage(props: { autoOpenPlanId?: number } = {}) {
  const { t } = useTranslation()

  return (
    <PublicLayout
      showMainContainer={false}
      headerProps={{ variant: 'landing' }}
      wrapperClassName='bg-white dark:bg-[#0a0a0a]'
    >
      <div className='relative mx-auto w-full max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-20 sm:pb-20'>
        <header className='pt-5 text-center sm:pt-8'>
          <h1 className='text-foreground text-[clamp(1.75rem,2.6vw,2.25rem)] leading-tight font-bold'>
            {t('Subscription Plans')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed'>
            {t('Pick a plan that matches how much you use')}
          </p>
        </header>

        <div className='mt-8 sm:mt-10'>
          <PlansContent autoOpenPlanId={props.autoOpenPlanId} />
        </div>
      </div>
    </PublicLayout>
  )
}
