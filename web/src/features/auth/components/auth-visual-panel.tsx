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

import { BrandWordmark } from '@/components/brand-wordmark'
import { ApertureGlobe } from '@/features/auth/components/aperture-globe'
import { cn } from '@/lib/utils'

/* Upstream provider brand names — proper nouns, so they stay untranslated
   (same convention as the home hero's app chips). Deliberately STATIC: the
   home page's scrolling marquee would be far too busy on an auth screen, so
   this is a plain, low-contrast row that simply states the breadth of what the
   gateway fronts. Six names at the tightest type that stays on ONE line in the
   narrowest panel column (416px of content at 1024) — an orphan word wrapping
   to a second line reads as a mistake, not as a logo cloud. */
const PROVIDER_NAMES = [
  'OpenAI',
  'Anthropic',
  'Google',
  'Azure',
  'DeepSeek',
  'Qwen',
]

/**
 * The brand lockup — text-only wordmark, linking home. Extracted so the same
 * markup can serve both the panel (at lg and up) and the page chrome (below
 * lg, where the panel is hidden) without duplicating it.
 */
export function AuthBrandMark(props: { className?: string }) {
  return (
    <Link
      to='/'
      className={cn(
        'flex items-center gap-2 transition-opacity hover:opacity-80',
        props.className
      )}
    >
      <BrandWordmark className='text-[24px]' />
    </Link>
  )
}

/**
 * The visual half of the split auth layout — the product's signature rotating
 * land dot-field, framed by the identity above it and the upstream catalogue
 * below it. Three bands, top to bottom: brand, globe + caption, providers.
 *
 * It deliberately carries no background and no border of its own: it shares the
 * page's HeroBackdrop so the form column and this panel read as one field
 * rather than as two boxes sitting side by side. The globe already owns its
 * DPR / resize / visibility / reduced-motion handling; nothing here reimplements
 * that. Only `<aside data-auth-panel>` is a contract (the verification probe
 * finds the panel — and its canvas — through it).
 */
export function AuthVisualPanel(props: { className?: string }) {
  const { t } = useTranslation()

  return (
    <aside
      data-auth-panel
      className={cn('relative flex-col', props.className)}
    >
      <AuthBrandMark />

      {/* Middle band takes the slack so the globe sits centred between the
          identity at the top and the provider row at the bottom, roughly on the
          same centre line as the form card in the opposite column. */}
      <div className='flex w-full flex-1 flex-col items-center justify-center'>
        {/* The globe is capped against BOTH the column width and the viewport
            height (`44vh`). Column width alone is not enough: the panel would
            then push the footer below the fold and the page would scroll on an
            auth screen that should fit. At 1440x900 the whole composition now
            lands inside the viewport; at 800px-tall viewports it degrades to
            roughly the scroll the plain auth layout already had. `my-4`
            guarantees the field never butts up against the wordmark above it. */}
        <div className='my-4 flex aspect-square w-full max-w-[min(420px,44vh)]'>
          <ApertureGlobe className='h-full w-full' />
        </div>

        <p
          className='mt-6 max-w-[26rem] text-center text-sm text-muted-foreground'
          data-auth-tagline
        >
          {t('Open source · Self-hosted AI gateway')}
        </p>
      </div>

      {/* The catalogue line closes the panel as its own band — the gap above it
          keeps it reading as the base of the panel rather than as a second line
          of the caption. */}
      <ul className='mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2'>
        {PROVIDER_NAMES.map((name) => (
          <li
            key={name}
            className='text-[10px] font-medium tracking-[0.12em] text-muted-foreground/50 uppercase'
          >
            {name}
          </li>
        ))}
      </ul>
    </aside>
  )
}
