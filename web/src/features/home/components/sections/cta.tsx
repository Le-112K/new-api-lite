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
 * The previous version wrapped the ask in a 500px-tall black card with a
 * gradient, which competed with the hero for attention at the exact moment the
 * page should be quiet. It is now the same two-column rhythm as every other
 * block — claim on the left, actions on the right — so the page ends instead of
 * restarting.
 *
 * Signed-in visitors get the only action that is useful to them: go to the
 * console. Previously the whole block disappeared, which left a signed-in
 * reader with no exit at the bottom of a long page.
 */
export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  return (
    <section
      className={cn('relative border-t border-border bg-background', props.className)}
    >
      <div className='mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-16 md:flex-row md:items-end md:justify-between md:px-12 md:py-24'>
        <h2 className='max-w-[34rem] text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground'>
          <span className='block'>{t('Send your first request,')}</span>
          <span className='block text-muted-foreground'>
            {t('it takes two environment variables.')}
          </span>
        </h2>

        <div className='flex flex-wrap items-center gap-3'>
          {props.isAuthenticated ? (
            <Button
              className='h-11 rounded-full px-5 text-[13.5px] font-semibold'
              render={<Link to='/dashboard' />}
            >
              {t('Open the console')}
            </Button>
          ) : (
            <>
              <Button
                className='h-11 rounded-full px-5 text-[13.5px] font-semibold'
                render={<Link to='/pricing' />}
              >
                {t('Browse the models')}
              </Button>
              <Button
                variant='outline'
                className='h-11 rounded-full border-border bg-transparent px-5 text-[13.5px] font-semibold text-foreground hover:bg-secondary'
                render={
                  <a
                    href='https://docs.newapi.pro/docs/installation'
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('Deployment guide')}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
