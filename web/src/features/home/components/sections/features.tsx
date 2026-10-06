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

interface FeaturesProps {
  className?: string
}

// 极简：只留 3 个卖点，一句话说清，去掉 Bento 堆砌
export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const items = [
    {
      k: '01',
      title: t('Lightning Fast'),
      desc: t('Optimized network architecture ensures millisecond response times'),
      href: 'https://docs.newapi.pro',
      label: '了解路由 →',
    },
    {
      k: '02',
      title: t('Secure & Reliable'),
      desc: t('Enterprise-grade security with comprehensive permission management'),
      href: 'https://docs.newapi.pro',
      label: '查看安全 →',
    },
    {
      k: '03',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      href: 'https://docs.newapi.pro',
      label: '看接入示例 →',
    },
  ]

  return (
    <section className='relative z-10 bg-[#F5F5F7] px-6 py-14 md:py-20 dark:bg-[#0a0a0a]'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-8 max-w-2xl'>
          <p className='mb-2 text-[11px] font-bold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/40'>
            {t('Core Features')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Built for developers,')}
            <br />
            {t('designed for scale')}
          </h2>
          <p className='mt-3 max-w-xl text-sm leading-relaxed text-[#6E6E73] dark:text-white/55'>
            用户只会扫 5 秒 — 所以只回答 3 个问题：是什么、为什么信我、怎么开始。其余全部折进文档。
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-3'>
          {items.map((it, i) => (
            <AnimateInView
              key={it.k}
              delay={i * 80}
              animation='fade-up'
              className='rounded-[20px] border border-black/10 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.06]'
            >
              <div className='mb-3 flex items-center gap-2.5'>
                <span className='flex size-7 items-center justify-center rounded-full bg-[#0a0a0a] text-[11px] font-bold text-white dark:bg-white dark:text-black'>
                  {it.k}
                </span>
                <h3 className='text-sm font-semibold'>{it.title}</h3>
              </div>
              <p className='text-sm leading-relaxed text-[#6E6E73] dark:text-white/60'>
                {it.desc}
              </p>
              <a
                href={it.href}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-4 inline-flex border-b border-black/10 pb-1 text-xs font-medium text-[#1d1d1f] hover:border-black/20 dark:border-white/15 dark:text-white/75'
              >
                {it.label}
              </a>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
