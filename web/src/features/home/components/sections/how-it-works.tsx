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

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Configure'),
      desc: t('Add your API keys, set up channels and configure access permissions'),
    },
    {
      num: '2',
      title: t('Connect'),
      desc: t('Connect through OpenAI, Claude, Gemini, and other compatible API routes'),
    },
    {
      num: '3',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
    },
  ]

  return (
    <section className='relative z-10 border-t border-black/10 bg-[#F5F5F7] px-6 py-14 md:py-20 dark:border-white/10 dark:bg-[#0a0a0a]'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 text-center md:mb-12'>
          <p className='mb-2 text-[11px] font-bold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/40'>
            {t('How It Works')}
          </p>
          <h2 className='text-2xl font-bold tracking-[-0.03em] md:text-3xl'>
            {t('Three steps to get started')}
          </h2>
          <p className='mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#6E6E73] dark:text-white/55'>
            把流程做薄、把留白做厚。首页只讲怎么做，不讲全。
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-3 md:gap-5'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 100}
              animation='fade-up'
              className='rounded-[20px] border border-black/10 bg-white p-6 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.06]'
            >
              <div className='flex size-8 items-center justify-center rounded-full bg-[#0a0a0a] text-xs font-bold text-white dark:bg-white dark:text-black'>
                {step.num}
              </div>
              <h3 className='mt-4 text-sm font-semibold tracking-[-0.01em]'>
                {step.title}
              </h3>
              <p className='mt-1.5 text-sm leading-relaxed text-[#6E6E73] dark:text-white/60'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
