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
import { Check } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { HeroConsole } from '../hero-console'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

/**
 * Hero — claim on the left, proof on the right.
 *
 * The previous hero carried a rotating globe, which made the page memorable but
 * cost a full screen of vertical space and said nothing about the product. It is
 * replaced by a transcript of the two `export` lines a user actually types: the
 * claim ("one API") and the evidence ("here is the key, here is the base URL,
 * here is the answer") now sit side by side at the fold.
 *
 * Three checkmarks stand in for a feature list. They are the only claims on the
 * page that are not demonstrated elsewhere, so they stay short and concrete.
 */
export function Hero(props: HeroProps) {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()

  const docsBase = (
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  ).replace(/\/+$/, '')

  // `:lang(zh)` is unusable here (the document `lang` is a static "en"), so the
  // tracking correction is derived in JS, mirroring the prototype: Latin gets a
  // tighter headline, CJK gets zeroed letter-spacing.
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
          'h-11 rounded-full px-5 text-[13.5px] font-semibold tracking-[-0.01em]',
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

  const checks = [
    t('OpenAI- and Anthropic-compatible endpoints'),
    t('Works with Cherry Studio, Claude Code and Codex CLI'),
    t('Self-hosted — your data stays on your own server'),
  ]

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-background pt-14 pb-16 md:pt-20 md:pb-24',
        props.className
      )}
    >
      <div className='mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-6 md:px-12 lg:grid-cols-12 lg:gap-12'>
        {/* Left — the claim. Half the grid, not 5/12: the Chinese second line is
            nine characters wide and at 3.4rem it needs ~490px, which is exactly
            what six columns give. At five columns it broke after seven
            characters. */}
        <div className='flex flex-col items-start lg:col-span-6'>
          <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase'>
            <span className='size-1.5 rounded-full bg-[var(--live)]' aria-hidden />
            {t('Open source · Self-hosted AI gateway')}
          </div>

          <h1
            className={cn(
              'text-[clamp(2.15rem,3.6vw,3.4rem)] leading-[1.06] font-semibold text-foreground',
              isZh ? 'tracking-[-0.01em]' : 'tracking-[-0.04em]'
            )}
          >
            <span className='block'>{t('One API,')}</span>
            <span className='block text-muted-foreground'>
              {t('The models you use')}
            </span>
          </h1>

          <p className='mt-5 max-w-[32rem] text-[15.5px] leading-[1.6] text-muted-foreground'>
            {t(
              'Connect model services like Claude, GPT, Gemini, DeepSeek and Qwen through one OpenAI-compatible API.'
            )}
          </p>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            {renderCta(`${docsBase}/zh/docs/installation`, t('Deployment options'), true)}
            {renderCta(`${docsBase}/zh/docs/api`, t('API reference'), false)}
          </div>

          <ul className='mt-8 space-y-2.5'>
            {checks.map((check) => (
              <li
                key={check}
                className='flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-muted-foreground'
              >
                <Check
                  className='mt-[3px] size-3.5 shrink-0 text-foreground'
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — the evidence. */}
        <div className='lg:col-span-6'>
          <HeroConsole />
        </div>
      </div>
    </section>
  )
}
