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
          'lp h-12 gap-2 rounded-lg px-5 text-[15px] font-semibold tracking-normal',
          isPrimary
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'border-border bg-background text-foreground hover:bg-secondary'
        )}
        render={render}
      >
        {label}
        {isPrimary ? <ArrowRight className='ml-2 size-4' aria-hidden /> : null}
      </Button>
    )
  }

  return (
    <section className={cn('lp bg-background', props.className)}>
      {/* 导航条是 fixed 且高 64px，所以首屏的上内边距要把这 64px 算进去，
          最终内容距视口顶部 64 + 96 = 160px，与参考站一致。 */}
      <div className='mx-auto w-full max-w-[1424px] px-6 pt-28 pb-16 md:px-12 md:pt-40 md:pb-24'>
        {/* 12 栅格 5/7 分栏（左 521 / 右 751），gap 56px —— 与参考站一致。
            之前用的 [1fr_751px] + gap 24px 让左栏过宽（553px），中文三行断句
            就得靠手拆；换成 5/7 后左栏 521px，断句位置也自然了。 */}
        <div className='grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14'>
          {/* Left — the claim. H1 断行按参考站实测：「One API key / for every top /
              AI model.」三行，宽 521px 时 68px 字号正好落成这三段。 */}
          <div className='lg:col-span-5'>
            <h1 className='lp-display lp-rise text-[2.6rem] leading-[1.02] tracking-[-0.03em] md:text-[68px] font-semibold text-foreground'>
              <span className='block'>{t('One API key')}</span>
              <span className='block'>{t('for every top')}</span>
              <span className='block'>{t('AI model.')}</span>
            </h1>

            {/* 参考站是一整段自然折成三行；中文用 \n 把断点定在短语边界，
                避免「一张账单。」被甩成孤行（whitespace-pre-line 只影响带
                换行的译文，英文原文仍自然折行）。 */}
            <p className='lp-rise lp-rise-2 mt-6 max-w-[36rem] text-[18px] leading-[1.62] whitespace-pre-line text-muted-foreground'>
              {t(
                'Point Claude Code, Codex CLI or your own code at this gateway. GPT, Claude, Gemini, DeepSeek and Qwen run on a single key and one invoice.'
              )}
            </p>

            <div className='lp-rise lp-rise-3 mt-7 flex flex-wrap items-center gap-3'>
              {renderCta('/pricing', t('See pricing'), true)}
              {renderCta(`${docsBase}/zh/docs`, t('Read the docs'), false)}
            </div>

            {/* Hairline + micro bullets: the reference's way of adding three
                facts without turning them into a card or an icon row.
                14px / 20px 行高 / 8px 条目间距 = 28px 节距，与参考站一致。
                参考站第三条是「Cancel any time」——那是订阅制主张，自托管没有
                可取消的订阅，换成同为收尾安抚的开源事实。 */}
            <div className='lp-rise lp-rise-4 mt-8 border-t border-border pt-5'>
              <ul className='space-y-2'>
                {[
                  t('OpenAI- and Anthropic-compatible endpoints'),
                  t('Works with Claude Code, Codex CLI and Cursor'),
                  t('Self-host in one command, no subscription'),
                ].map((line) => (
                  <li
                    key={line}
                    className='flex items-start gap-2 text-[14px] leading-5 text-muted-foreground'
                  >
                    <span className='mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60' />
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
                className='inline-flex items-center gap-2 text-[14px] leading-5 text-muted-foreground transition-colors hover:text-foreground'
              >
                <span className='rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold text-foreground'>
                  {t('Open source')}
                </span>
                {t('Deploy on your own server, no per-seat fee')}
                <ArrowRight className='size-3.5' aria-hidden />
              </a>
            </div>
          </div>

          {/* Right — the evidence. The grid gap already spaces the two
              columns; an extra left padding here would shave 24px off the
              console and make long URLs wrap mid-token. */}
          <div className='lg:col-span-7'>
            <HeroConsole />
          </div>
        </div>
      </div>
    </section>
  )
}
