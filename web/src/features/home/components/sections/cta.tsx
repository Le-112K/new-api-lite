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

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

/**
 * Closing block.
 *
 * Full-bleed inverted band, 331px tall on the reference: two lines of 44px
 * display type on the left, one grey line under them, two buttons on the right,
 * everything vertically centred. Using `bg-foreground` / `text-background`
 * instead of literal black keeps it inverted in dark mode too, so the page ends
 * with the same contrast flip in either theme.
 *
 * Signed-in visitors get the only action that is useful to them: go to the
 * console. Previously the whole block disappeared, which left a signed-in
 * reader with no exit at the bottom of a long page.
 */
export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  return (
    <section className={cn('lp bg-foreground text-background', props.className)}>
      <div className='mx-auto flex w-full max-w-[1424px] flex-col items-start gap-8 px-6 py-14 md:flex-row md:items-center md:justify-between md:px-12 md:py-20'>
        <div>
          <h2 className='lp-display max-w-[34rem] text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.15] font-semibold'>
            <span className='block'>{t('Start with any model.')}</span>
            <span className='block'>{t('Change it whenever you like.')}</span>
          </h2>
          <p className='mt-4 text-[16px] leading-[1.6] text-background/55'>
            {t('Choose a model, create a key, and point your tools at the gateway.')}
          </p>
        </div>

        <div className='flex shrink-0 flex-wrap items-center gap-3'>
          {props.isAuthenticated ? (
            <Button
              className='h-12 rounded-lg bg-background px-5 text-[15px] font-medium text-foreground hover:bg-background/90'
              render={<Link to='/dashboard' />}
            >
              {t('Open the console')}
              <ArrowRight className='ml-1 size-4' aria-hidden />
            </Button>
          ) : (
            <>
              <Button
                className='h-12 rounded-lg bg-background px-5 text-[15px] font-medium text-foreground hover:bg-background/90'
                render={<Link to='/pricing' />}
              >
                {t('Get started')}
                <ArrowRight className='ml-1 size-4' aria-hidden />
              </Button>
              <Button
                variant='outline'
                className='h-12 rounded-lg border-background/25 bg-transparent px-5 text-[15px] font-medium text-background hover:border-background/40 hover:bg-background/10'
                render={
                  <a
                    href='https://docs.newapi.pro/docs/installation'
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('Read the docs')}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
