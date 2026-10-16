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
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { ApertureGlobe } from '../aperture-globe'
import { HeroBackdrop } from '../hero-backdrop'
import { HeroTerminalDemo } from '../hero-terminal-demo'

import '../hero.css'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// Tool names, not protocol paths — brand names stay untranslated.
const APP_CHIPS = [
  'Cherry Studio',
  'DeepChat',
  'OpenClaw',
  'Claude Code',
  'Codex CLI',
  'AionUi',
]

export function Hero(props: HeroProps) {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()

  const docsBase = (
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  ).replace(/\/+$/, '')

  // The document `lang` attribute is a static "en" and is never kept in sync
  // with the UI language, so `:lang(zh)` is unusable — derive tracking in JS,
  // mirroring the prototype's Latin-optimised vs. CJK-zeroed letter-spacing.
  const isZh = (i18n.resolvedLanguage || i18n.language || '')
    .toLowerCase()
    .startsWith('zh')

  const renderCta = (
    href: string,
    label: string,
    isPrimary: boolean
  ): ReactElement => {
    const isExternal = href.startsWith('http')
    const render: ReactElement = isExternal ? (
      <a href={href} target='_blank' rel='noopener noreferrer' />
    ) : (
      <Link to={href} />
    )

    return (
      <Button
        variant={isPrimary ? 'default' : 'outline'}
        className={cn(
          'h-12 rounded-full px-6 text-sm font-semibold tracking-[-0.01em]',
          isPrimary
            ? 'hover:bg-black dark:hover:bg-[#E8E8ED] dark:hover:text-[#0a0a0a]'
            : 'border-border bg-transparent text-foreground hover:bg-secondary dark:hover:border-white/20'
        )}
        render={render}
      >
        {label}
      </Button>
    )
  }

  return (
    <section
      className={cn(
        'relative z-10 overflow-hidden bg-[#F5F5F7] px-6 pt-20 pb-12 md:pt-28 md:pb-16 lg:pt-32 lg:pb-20 dark:bg-[#0a0a0a]',
        props.className
      )}
    >
      <HeroBackdrop />

      <div className='relative z-[1]'>
        <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8'>
          {/* Left — copy column */}
          <div className='flex flex-col items-start text-left lg:col-span-6'>
            {/* Eyebrow — hairline pill with a pulsing live dot */}
            <div
              className='hero-anim mb-[22px] inline-flex items-center gap-[9px] rounded-full border border-border bg-card px-3.5 py-[7px] text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase'
              style={{ '--d': '0ms' } as React.CSSProperties}
            >
              <span
                aria-hidden
                className='hero-live-dot size-1.5 rounded-full bg-[var(--live)]'
              />
              <span>{t('Open source · Self-hosted AI gateway')}</span>
            </div>

            {/* Two-tone display headline: line 1 near-black, line 2 muted.
                The clamp max is 3.7rem (not the prototype's 4.1rem) because the
                copy column here is ~540px: the 9-character CJK line has to stay
                on ONE line, and 0rem tracking at 59.2px leaves real headroom. */}
            <h1
              className='hero-anim hero-title mb-[18px] text-[clamp(2.125rem,4.2vw,3.7rem)] leading-[1.04] font-bold text-foreground'
              data-lang={isZh ? 'zh' : 'en'}
              style={{ '--d': '60ms' } as React.CSSProperties}
            >
              <span className='block'>{t('One API,')}</span>
              <span className='hero-title-l2 block font-normal text-muted-foreground'>
                {t('The models you use')}
              </span>
            </h1>

            <p
              className='hero-anim mb-6 max-w-[34rem] text-[1.1875rem] leading-[1.5] text-muted-foreground'
              style={{ '--d': '120ms' } as React.CSSProperties}
            >
              {t(
                'Connect model services like Claude, GPT, Gemini, DeepSeek and Qwen through one OpenAI-compatible API.'
              )}
            </p>

            {/* Exactly two CTAs — the solid one is the only solid element. */}
            <div
              className='hero-anim flex flex-wrap items-center gap-3'
              style={{ '--d': '180ms' } as React.CSSProperties}
            >
              {renderCta(
                `${docsBase}/zh/docs/installation`,
                t('Deployment options'),
                true
              )}
              {renderCta(`${docsBase}/zh/docs/api`, t('API reference'), false)}
            </div>

            {/* Apps with setup guides */}
            <div
              className='hero-anim mt-7 w-full max-w-xl'
              style={{ '--d': '240ms' } as React.CSSProperties}
            >
              <p className='mb-3 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase'>
                {t('Apps with setup guides')}
              </p>
              <div className='flex flex-wrap gap-2'>
                {APP_CHIPS.map((name, index) => (
                  <span
                    key={name}
                    className='hero-chip rounded-full border border-border bg-card px-2.5 py-1 text-[0.8125rem] font-medium text-muted-foreground'
                    style={{ '--ci': String(index) } as React.CSSProperties}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: the rotating land dot-field. This is the signature Aperture
              element — the terminal moved below the split so the globe can own
              the right column. */}
          <div
            className='hero-anim flex w-full justify-center lg:col-span-6'
            style={{ '--d': '320ms' } as React.CSSProperties}
          >
            <ApertureGlobe className='aspect-square w-full max-w-[560px]' />
          </div>
        </div>

        {/* Terminal — its own full-width beat under the split, matching the
            approved layout where the globe and the terminal are separate rows. */}
        <div
          className='hero-anim mx-auto mt-14 max-w-6xl'
          style={{ '--d': '420ms' } as React.CSSProperties}
        >
          <HeroTerminalDemo />
        </div>
      </div>
    </section>
  )
}
