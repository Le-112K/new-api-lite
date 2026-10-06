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

For commercial licensing, please contact support@quantumnous.com
*/
import { CherryStudio } from '@lobehub/icons'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const MoreIcon = () => (
  <svg
    className='text-muted-foreground/60 group-hover:text-foreground size-6 shrink-0 transition-colors'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <circle cx='6' cy='12' r='2' fill='currentColor' />
    <circle cx='12' cy='12' r='2' fill='currentColor' />
    <circle cx='18' cy='12' r='2' fill='currentColor' />
  </svg>
)

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  const renderDocsButton = () => {
    const isExternal = docsUrl.startsWith('http')
    if (isExternal) {
      return (
        <Button
          variant='outline'
          className='group border-border bg-background hover:bg-muted inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-medium'
          render={
            <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
          }
        >
          <BookOpen className='text-muted-foreground/70 group-hover:text-foreground size-4 transition-colors duration-200' />
          <span>{t('Docs')}</span>
        </Button>
      )
    }
    return (
      <Button
        variant='outline'
        className='group border-border bg-background hover:bg-muted inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-medium'
        render={<Link to={docsUrl} />}
      >
        <BookOpen className='text-muted-foreground/70 group-hover:text-foreground size-4 transition-colors duration-200' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section className='relative z-10 overflow-hidden bg-[#F5F5F7] px-6 pt-20 pb-12 md:pt-28 md:pb-16 lg:pt-32 lg:pb-20 dark:bg-[#0a0a0a]'>
      {/* Apple BW: subtle gray wash + hairline grid — no color */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.06]'
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 15% 10%, rgba(0,0,0,0.08) 0%, transparent 65%)',
            'radial-gradient(ellipse 50% 40% at 85% 20%, rgba(0,0,0,0.05) 0%, transparent 65%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_55%_50%_at_50%_20%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.035] dark:opacity-[0.05]'
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8'>
        {/* Left */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          {/* Eyebrow — BW pill */}
          <div
            className='landing-animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-[#6E6E73] opacity-0 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60'
            style={{ animationDelay: '0ms' }}
          >
            <span className='size-1.5 rounded-full bg-[#0a0a0a] dark:bg-white' />
            <span className='uppercase'>{t('AI Application Infrastructure Foundation')}</span>
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.4rem,4.8vw,3.4rem)] leading-[0.95] font-bold tracking-[-0.04em] opacity-0'
            style={{ animationDelay: '60ms' }}
          >
            <span className='text-[#0a0a0a] dark:text-white'>{t('Unified API Gateway for')}</span>
            <br />
            <span className='font-[520] tracking-[-0.03em] text-[#1d1d1f] dark:text-white/80'>
              {t('Vast Range of AI Models')}
            </span>
          </h1>
          <p
            className='landing-animate-fade-up mt-4 max-w-xl text-[15px] leading-[1.65] text-[#6E6E73] opacity-0 dark:text-white/55'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Access a vast selection of models via a standard, unified API protocol. Power AI applications, manage digital assets, and connect the Future.'
            )}
          </p>
          {/* 5-second hint */}
          <p
            className='landing-animate-fade-up mt-3 text-xs text-[#86868B] opacity-0 dark:text-white/40'
            style={{ animationDelay: '140ms' }}
          >
            5 秒看懂 · 其余细节去文档 · 首页不负责讲全
          </p>

          <div
            className='landing-animate-fade-up mt-6 flex flex-wrap items-center gap-2.5 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group h-11 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                {renderDocsButton()}
              </>
            ) : (
              <>
                <Button
                  className='group h-11 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='h-11 rounded-full border-black/10 bg-white px-5 text-sm font-medium hover:bg-[#F5F5F7] dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
                {renderDocsButton()}
              </>
            )}
          </div>

          {/* Supported Apps — muted, no color blocks */}
          <div
            className='landing-animate-fade-up mt-10 w-full max-w-xl opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            <div className='mb-3 flex flex-col gap-1'>
              <span className='text-[10px] font-bold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/40'>
                {t('Supported Applications')}
              </span>
              <p className='text-xs leading-relaxed text-[#86868B] dark:text-white/40'>
                {t(
                  'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2.5'>
              <a
                href='https://cherry-ai.com'
                target='_blank'
                rel='noopener noreferrer'
                className='group flex items-center gap-2.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-all hover:border-black/15 hover:bg-[#FBFBFB] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.08]'
              >
                <CherryStudio.Color size={20} className='shrink-0 opacity-90 grayscale' />
                <span>Cherry Studio</span>
              </a>

              <a
                href='https://ccswitch.io'
                target='_blank'
                rel='noopener noreferrer'
                className='group flex items-center gap-2.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-all hover:border-black/15 hover:bg-[#FBFBFB] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.08]'
              >
                <img
                  src='https://ccswitch.io/favicon.png'
                  alt='CC Switch'
                  className='size-5 shrink-0 rounded object-contain opacity-80 grayscale'
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <span
                  style={{ display: 'none' }}
                  className='size-5 shrink-0 items-center justify-center rounded bg-black text-[9px] font-bold text-white dark:bg-white dark:text-black'
                >
                  CC
                </span>
                <span>CC Switch</span>
              </a>

              <div className='group flex cursor-default items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#6E6E73] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/50'>
                <MoreIcon />
                <span>{t('More Apps')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Terminal */}
        <div
          className='landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6'
          style={{ animationDelay: '320ms' }}
        >
          <HeroTerminalDemo className='mt-2 lg:mt-0' />
        </div>
      </div>
    </section>
  )
}
