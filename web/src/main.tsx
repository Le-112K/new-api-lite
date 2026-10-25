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
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { prefetchHomePageContent } from '@/features/home/api'
import { installBuildMetadata } from '@/lib/build-metadata'
import { BRAND_NAME } from '@/lib/constants'
import '@/lib/dayjs'
import { initializeFrontendCache } from '@/lib/frontend-cache'
import { createAppQueryClient } from '@/lib/query-client'
import { statusQueryOptions } from '@/lib/status-query'

import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import './i18n/config'
// Generated Routes
import { routeTree } from './routeTree.gen'

// Styles
import './styles/index.css'

// Ensure VChart theme is initialized before any chart mounts (prevents white default theme flash)
// VChart theme is driven by our ThemeProvider (html.light/html.dark) via per-chart `theme` prop.
initializeFrontendCache()
installBuildMetadata()

const queryClient = createAppQueryClient(() => {
  void router.navigate({ to: '/500' })
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.querySelector<HTMLElement>('#root')
if (!rootElement) {
  throw new Error('Root element not found')
}
// Fixed text brand: title comes from the constant, never from a configurable
// name or a logo URL. There is no image asset to preload or swap.
;(function initBrandTitle() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    document.title = BRAND_NAME
    const metaTitle = document.querySelector(
      'meta[name="title"]'
    ) as HTMLMetaElement | null
    if (metaTitle) metaTitle.setAttribute('content', BRAND_NAME)

    // Background refresh through the shared cache. This primes ['status']
    // before React mounts, so the root guard and every status consumer reuse
    // this one request instead of firing their own. `fetchStatus` owns the
    // localStorage write and the system-config store sync.
    queryClient.ensureQueryData(statusQueryOptions).catch(() => {
      /* empty */
    })

    // The landing page cannot paint until it knows whether an admin set custom
    // content. Starting here (instead of in the route's effect) keeps the boot
    // screen as the only thing between the blank document and real content.
    prefetchHomePageContent().catch(() => {
      /* the home hook owns the user-facing error */
    })
  } catch {
    /* empty */
  }
})()
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
