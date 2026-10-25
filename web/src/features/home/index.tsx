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
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { RichContent } from '@/components/rich-content'
import { useTheme } from '@/context/theme-provider'
import { isLikelyHtml } from '@/lib/content-format'
import { useAuthStore } from '@/stores/auth-store'

import { CTA, Connect, Faq, Hero, ModelCatalog } from './components'
import './landing.css'
import { useHomePageContent } from './hooks'

export function Home() {
  const { i18n, t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()

  const syncIframePreferences = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { themeMode: resolvedTheme },
        '*'
      )
      iframeRef.current?.contentWindow?.postMessage(
        { lang: i18n.language },
        '*'
      )
    } catch {
      // Cross-origin frames may reject access while navigating.
    }
  }, [i18n.language, resolvedTheme])

  useEffect(() => {
    if (isUrl) {
      syncIframePreferences()
    }
  }, [isUrl, syncIframePreferences])

  if (!isLoaded) {
    // Structured placeholder instead of a lone "Loading..." line. It mirrors
    // the hero's centred stack so the arrival of real content does not move
    // anything, and it is static (no pulse) to stay quiet on a fast load.
    return (
      <PublicLayout showMainContainer={false} headerProps={{ variant: 'landing' }} wrapperClassName='bg-white dark:bg-[#0a0a0a]'>
        <main
          className='flex min-h-screen flex-col items-center justify-center gap-4 px-6'
          aria-busy='true'
        >
          <div className='bg-muted h-3 w-24 rounded-full' />
          <div className='bg-muted mt-2 h-10 w-[min(88vw,40rem)] rounded-xl sm:h-14' />
          <div className='bg-muted h-10 w-[min(62vw,26rem)] rounded-xl sm:h-14' />
          <div className='bg-muted mt-3 h-4 w-[min(72vw,30rem)] rounded-md' />
          <div className='bg-muted mt-4 h-10 w-36 rounded-full' />
          <span className='sr-only'>{t('Loading...')}</span>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    if (isUrl) {
      return (
        <PublicLayout showMainContainer={false} headerProps={{ variant: 'landing' }} wrapperClassName='bg-white dark:bg-[#0a0a0a]'>
          {/*
            allow-top-navigation-by-user-activation: the custom home page URL is
            admin-configured (trusted); this lets its target="_top" nav/menu links
            navigate the top-level window on user click. The default sandbox blocks
            this on desktop, while some mobile browsers allow it via allow-popups,
            causing inconsistent behavior. This token only permits user-activated
            top-level navigation and does NOT grant same-origin access.
          */}
          <iframe
            ref={iframeRef}
            src={content}
            className='h-screen w-full border-none'
            title={t('Custom Home Page')}
            sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation-by-user-activation'
            onLoad={syncIframePreferences}
          />
        </PublicLayout>
      )
    }

    const contentIsHtml = isLikelyHtml(content)

    if (contentIsHtml) {
      return (
        <PublicLayout showMainContainer={false} headerProps={{ variant: 'landing' }} wrapperClassName='bg-white dark:bg-[#0a0a0a]'>
          <RichContent
            mode='html'
            htmlVariant='isolated'
            content={content}
            className='custom-home-content'
          />
        </PublicLayout>
      )
    }

    return (
      <PublicLayout headerProps={{ variant: 'landing' }} wrapperClassName='bg-white dark:bg-[#0a0a0a]'>
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <RichContent
            mode='markdown'
            content={content}
            className='custom-home-content'
          />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false} headerProps={{ variant: 'landing' }} wrapperClassName='bg-white dark:bg-[#0a0a0a]'>
      {/* The landing page is a claim followed by four pieces of evidence:
          hero (what it is + the two export lines), the live catalog, the setup
          block, the four promises, the questions, then one ask. The rotating
          globe and the provider marquee that used to sit here were replaced by
          the console and the catalog — a marketing page for a gateway has to
          show the request, not an illustration of the world. */}
      <Hero isAuthenticated={isAuthenticated} />
      <ModelCatalog />
      <Connect />
      <Faq />
      <CTA isAuthenticated={isAuthenticated} />
      <Footer />
    </PublicLayout>
  )
}
