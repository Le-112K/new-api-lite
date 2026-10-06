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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 bg-[#F5F5F7] px-6 py-14 md:py-20 dark:bg-[#0a0a0a]'>
      <AnimateInView
        animation='scale-in'
        className='mx-auto max-w-6xl rounded-[20px] border border-black/10 bg-white px-6 py-8 shadow-[0_1px_0_rgba(0,0,0,0.03)] md:px-10 md:py-10 dark:border-white/10 dark:bg-white/[0.06]'
      >
        <div className='flex flex-col items-start justify-between gap-6 md:flex-row md:items-center'>
          <div className='max-w-xl'>
            <h2 className='text-2xl leading-tight font-bold tracking-[-0.03em] md:text-3xl'>
              {t('Ready to simplify')}
              <br />
              <span className='font-[520] text-[#1d1d1f] dark:text-white/80'>
                {t('your AI integration?')}
              </span>
            </h2>
            <p className='mt-3 max-w-md text-sm leading-relaxed text-[#6E6E73] dark:text-white/55'>
              {t(
                'Deploy your own gateway and start routing requests through your configured upstream services.'
              )}
            </p>
            <p className='mt-2 text-xs text-[#86868B] dark:text-white/35'>
              首页到此为止。更多能力与定价，去文档与定价页慢慢看。
            </p>
          </div>
          <div className='flex shrink-0 flex-wrap items-center gap-3'>
            <Button
              className='group rounded-full bg-[#0a0a0a] px-6 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='rounded-full border-black/10 bg-white hover:bg-[#F5F5F7] dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
