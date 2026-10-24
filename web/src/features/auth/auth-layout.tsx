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
import { Footer } from '@/components/layout/components/footer'
import { HeroBackdrop } from '@/features/auth/components/hero-backdrop'
import { cn } from '@/lib/utils'

import { AuthBrandMark, AuthVisualPanel } from './components/auth-visual-panel'

import '@/features/auth/components/hero.css'

type AuthLayoutProps = {
  children: React.ReactNode
  /**
   * `plain` — the single centred column every auth route gets by default.
   * `split` — the two-column composition: form in one column, the Aperture
   * globe panel in the other. Opt-in, because a recovery or sign-up form has
   * nothing to put opposite it and a bare globe would be dead weight.
   */
  variant?: 'plain' | 'split'
}

export function AuthLayout(props: AuthLayoutProps) {
  const isSplit = props.variant === 'split'

  /* The brand mark is page chrome below `lg`; at `lg`+ in the split layout the
     panel owns it, so the chrome copy is hidden there to avoid a duplicate. */
  const brandMark = (
    <AuthBrandMark
      className={cn(
        'absolute top-4 left-4 z-10 sm:top-8 sm:left-8',
        isSplit && 'lg:hidden'
      )}
    />
  )

  return (
    <div className='bg-background text-foreground relative flex min-h-svh max-w-none flex-col'>
      {/* The same decorative backdrop the home hero uses — the faint hairline
          grid, the radial wash and the slow aperture watermark. Sharing one
          layer across both columns is what keeps the split reading as a single
          composition instead of two panels glued together. The wrapper clips the
          backdrop's `-bottom-20` grid overhang so it never adds scroll height,
          and the content columns below are lifted to `z-10` so they always paint
          above the (z-0) decoration. */}
      <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden'>
        <HeroBackdrop />
      </div>

      {isSplit ? (
        <div className='relative z-10 flex flex-1 flex-col'>
          {brandMark}
          <div className='mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-2'>
            {/* Left column — the globe panel. Hidden below `lg`, where the
                layout collapses to the form alone so nothing squeezes it or
                forces a horizontal scrollbar. */}
            <AuthVisualPanel className='hidden px-8 py-8 sm:px-12 lg:flex xl:px-20' />

            {/* Right column — the form. Borderless on purpose: with the globe
                opposite it, a second bordered box would fight the panel and
                break the shared field. The card language (centred mark, centred
                head, pill submit) is untouched; only the outer frame goes. */}
            <div className='flex flex-col items-center justify-center px-4 py-16 sm:py-24'>
              <div data-auth-card className='w-full max-w-[400px]'>
                {props.children}
              </div>
            </div>
          </div>

          <Footer />
        </div>
      ) : (
        <div className='relative z-10 flex flex-1 flex-col'>
          {brandMark}
          <div className='flex flex-1 items-center justify-center px-4 py-16 sm:py-24'>
            <div
              data-auth-card
              className='bg-card border-border w-full rounded-3xl border p-6 shadow-[var(--shadow-hairline)] sm:w-[480px] sm:p-8'
            >
              {props.children}
            </div>
          </div>

          <Footer />
        </div>
      )}
    </div>
  )
}
