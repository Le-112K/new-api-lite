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
import { ArrowRight } from 'lucide-react'
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
 * Hero — claim left, transcript right.
 *
 * Proportions are taken from the reference page: a 467px copy column, a 24px
 * gutter, a 751px terminal, 96px of vertical padding, and a three-line 68px
 * display headline set in Sora at -0.03em. The Chinese headline has no Sora
 * glyphs and falls back to the system CJK face, so it is allowed to wrap to
 * three lines on its own — the block's optical weight stays the same.
 *
 * The right-hand card is the page's only saturated surface. Everything else is
 * ink on white with hairlines, which is what keeps a long page calm.
 */
export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const docsBase = (
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  ).replace(/\/+$/, '')

  /* Both destinations are documentation URLs, so they always leave the app —
     a plain anchor keeps this honest and skips the router. */
  const renderCta = (
    href: string,
    label: string,
    isPrimary: boolean
  ): ReactElement => {
    const render: ReactElement = (
      <a href={href} target='_blank' rel='noopener noreferrer' />
    )

    return (
      <Button
        variant={isPrimary ? 'default' : 'outline'}
        className={cn(
          'lp h-12 rounded-lg px-5 text-[15px] font-medium tracking-normal',
          isPrimary
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'border-border bg-background text-foreground hover:bg-secondary'
        )}
        render={render}
      >
        {label}
        {isPrimary ? <ArrowRight className='ml-1 size-4' aria-hidden /> : null}
      </Button>
    )
  }

  return (
    <section className={cn('lp bg-background', props.className)}>
      <div className='mx-auto w-full max-w-[1424px] px-6 py-16 md:px-12 md:py-24'>
        <div className='grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,751px)] lg:gap-6'>
          {/* Left — the claim. The copy column is 1fr against a fixed 751px
              terminal, not the reference's fixed 467px: the Chinese second line
              is nine characters wide and needs 540px at 60px type, which 467px
              cannot give without breaking the line after five characters. */}
          <div>
            <h1 className='lp-display text-[clamp(2.3rem,3.6vw,3.4rem)] leading-[1.06] font-semibold text-foreground'>
              <span className='block'>{t('One API key,')}</span>
              <span className='block'>{t('For every model you run.')}</span>
            </h1>

            {/* Two sentences on two lines, like the reference: CJK has no word
                boundaries, so a soft wrap here lands in the middle of a phrase
                and leaves a two-character orphan on the last line. */}
            <p className='mt-5 text-[18px] leading-[1.62] text-muted-foreground'>
              <span className='block'>
                {t('Point Claude Code, Codex CLI or your own code at this gateway.')}
              </span>
              {/* Third line split by hand: at 18px the model list + benefit
                  sentence is ~607px and the copy column is 553px, so a soft wrap
                  drops 「张账单。」 alone on a fourth line. */}
              <span className='block'>
                {t('Claude, GPT, Gemini, DeepSeek and Qwen,')}
              </span>
              <span className='block'>
                {t('on a single key and one invoice.')}
              </span>
            </p>

            <div className='mt-7 flex flex-wrap items-center gap-3'>
              {renderCta('/pricing', t('See pricing'), true)}
              {renderCta(`${docsBase}/zh/docs`, t('Read the docs'), false)}
            </div>

            {/* Hairline + micro bullets: the reference's way of adding three
                facts without turning them into a card or an icon row. */}
            <div className='mt-8 border-t border-border pt-5'>
              <ul className='space-y-2'>
                {[
                  t('OpenAI- and Anthropic-compatible endpoints'),
                  t('Works with Cherry Studio, Claude Code and Codex CLI'),
                  t('Self-host in one command, no subscription'),
                ].map((line) => (
                  <li
                    key={line}
                    className='flex items-start gap-2 text-[13.5px] leading-[1.5] text-muted-foreground'
                  >
                    <span className='mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60' />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='mt-6 border-t border-border pt-5'>
              <a
                href={`${docsBase}/zh/docs/installation`}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground'
              >
                <span className='rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold text-foreground'>
                  {t('Open source')}
                </span>
                {t('Deploy on your own server, no per-seat fee')}
                <ArrowRight className='size-3.5' aria-hidden />
              </a>
            </div>
          </div>

          {/* Right — the evidence. */}
          <div className='lg:pl-6'>
            <HeroConsole />
          </div>
        </div>
      </div>
    </section>
  )
}
