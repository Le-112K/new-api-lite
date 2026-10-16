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

import { Footer } from '@/components/layout/components/footer'
import { Skeleton } from '@/components/ui/skeleton'
import { HeroBackdrop } from '@/features/home/components/hero-backdrop'
import { useSystemConfig } from '@/hooks/use-system-config'

import '@/features/home/components/hero.css'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='bg-background text-foreground relative flex min-h-svh max-w-none flex-col'>
      {/* The same decorative backdrop the home hero uses — the faint hairline
          grid, the radial wash and the slow aperture watermark. It gives the
          auth surface the same texture as home without adding a single word of
          copy. The wrapper clips the backdrop's `-bottom-20` grid overhang so it
          never adds scroll height, and the content column below is lifted to
          `z-10` so it always paints above the (z-0) decoration. */}
      <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden'>
        <HeroBackdrop />
      </div>
      <Link
        to='/'
        className='absolute top-4 left-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-full object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1 className='text-xl font-medium'>{systemName}</h1>
        )}
      </Link>
      <div className='relative z-10 flex flex-1 flex-col'>
        <div className='flex flex-1 items-center justify-center px-4 py-16 sm:py-24'>
          <div className='bg-card border-border w-full rounded-3xl border p-6 shadow-[var(--shadow-hairline)] sm:w-[480px] sm:p-8'>
            <div className='mb-6 flex justify-center'>
              {loading ? (
                <Skeleton className='size-10 rounded-xl' />
              ) : (
                <img
                  src={logo}
                  alt={t('Logo')}
                  className='size-10 rounded-xl object-cover'
                />
              )}
            </div>
            {props.children}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}
