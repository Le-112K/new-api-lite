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
import i18next from 'i18next'
import { useEffect, useState } from 'react'

import { isHttpUrl } from '@/lib/content-format'
import { handleServerError } from '@/lib/handle-server-error'

import { prefetchHomePageContent } from '../api'
import type { HomePageContentResult } from '../types'

const STORAGE_KEY = 'home_page_content'

function readCachedContent(): string {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * Hook to load and manage custom home page content
 * Supports both Markdown/HTML content and iframe URLs
 */
export function useHomePageContent(): HomePageContentResult {
  // Seed both values from the cache: a reload that already knows the content
  // must render it on the first frame instead of flashing a loading state.
  const [content, setContent] = useState<string>(readCachedContent)
  const [isLoaded, setIsLoaded] = useState<boolean>(
    () => readCachedContent().length > 0
  )

  useEffect(() => {
    let mounted = true

    const loadContent = async () => {
      // Load from localStorage first for immediate display
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached && mounted) {
        setContent(cached)
      }

      try {
        // Shared with the prefetch in main.tsx: usually already in flight (or
        // resolved) by the time this effect runs.
        const response = await prefetchHomePageContent()
        const { success, data } = response

        if (!mounted) return

        if (success && data) {
          setContent(data)
          localStorage.setItem(STORAGE_KEY, data)
        } else {
          // Clear content if API returns empty
          setContent('')
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        if (!mounted) return
        handleServerError(error, i18next.t('Failed to load home page content'))
      } finally {
        if (mounted) {
          setIsLoaded(true)
        }
      }
    }

    loadContent()

    return () => {
      mounted = false
    }
  }, [])

  const isUrl = isHttpUrl(content)

  return { content, isLoaded, isUrl }
}
