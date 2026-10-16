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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    <section
      className={cn('relative z-10 bg-background py-[72px] md:py-28', props.className)}
    >
      <div className='mx-auto w-full max-w-[1200px] px-6 md:px-12'>
        <AnimateInView animation='fade-up'>
          <div className='relative overflow-hidden rounded-2xl bg-[#0A0A0A] px-8 py-[72px] shadow-[0_24px_64px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)] md:rounded-3xl md:px-12 md:py-24 dark:bg-card dark:shadow-[inset_0_0_0_1px_var(--hairline)]'>
            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(255,255,255,0.07),transparent_60%)]'
            />
            <div className='relative mx-auto max-w-[720px] text-center'>
              <h2 className='mb-5 text-[clamp(2.5rem,5.2vw,4.5rem)] leading-[1.04] font-bold text-white'>
                <span className='block'>{t('Deploy Aperture,')}</span>
                <span className='block font-normal text-white/55'>
                  {t('Connect your AI apps')}
                </span>
              </h2>
              <p className='mx-auto mb-10 max-w-[30rem] text-[1.1875rem] leading-[1.5] text-white/[0.62]'>
                {t(
                  'Guides cover Docker, Docker Compose, 1Panel, BaoTa, and supported app integrations.'
                )}
              </p>
              <div className='flex flex-wrap items-center justify-center gap-3.5'>
                <Button
                  className='h-12 rounded-full bg-white px-6 text-sm font-semibold text-[#0A0A0A] hover:bg-[#E8E8ED]'
                  render={
                    <a
                      /* Docs paths all live under /docs/ — a bare /installation/
                         resolves to a 404 on the live site. */
                      href='https://docs.newapi.pro/docs/installation'
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  {t('Deployment guide')}
                </Button>
                <Button
                  variant='outline'
                  className='h-12 rounded-full border-white/25 bg-transparent px-6 text-sm font-semibold text-[#F5F5F7] hover:border-white/40 hover:bg-white/10'
                  render={
                    <a
                      href='https://docs.newapi.pro/docs/apps'
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  {t('App integration guides')}
                </Button>
              </div>
            </div>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
