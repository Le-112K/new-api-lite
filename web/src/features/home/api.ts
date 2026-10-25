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
import { api } from '@/lib/api'

import type { HomePageContentResponse } from './types'

// ============================================================================
// Home Page APIs
// ============================================================================

/**
 * Get custom home page content
 * Returns Markdown/HTML content or iframe URL
 */
export async function getHomePageContent(): Promise<HomePageContentResponse> {
  // See getNotice in @/lib/api: the global `Cache-Control: no-store` is dropped
  // so the browser can hold an ETag and revalidate, letting the server answer
  // 304. Server-side `no-cache` keeps admin edits immediate.
  const res = await api.get('/api/home_page_content', {
    headers: { 'Cache-Control': null },
  })
  return res.data
}

let homeContentPrefetch: Promise<HomePageContentResponse> | null = null

/**
 * Kick the request off while the bundle is still evaluating, rather than from
 * the home route's effect.
 *
 * The landing page has to know whether an admin configured custom content
 * before it can paint, and the gap between "bundle runs" and "route mounts"
 * was long enough that the boot screen handed over to a skeleton for a beat.
 * Sharing one promise here closes that gap and also dedupes the request.
 */
export function prefetchHomePageContent(): Promise<HomePageContentResponse> {
  homeContentPrefetch ??= getHomePageContent()
  return homeContentPrefetch
}
