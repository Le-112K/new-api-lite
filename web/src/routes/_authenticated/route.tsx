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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/components/layout'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location, preload }) => {
    // `defaultPreload: 'intent'` runs this guard on every hover/focus of a
    // nav link. A redirect thrown from a preload is upgraded by the router
    // into a real navigation, which re-renders the header, which re-triggers
    // the hover preload — an anonymous visitor freezing the tab within
    // seconds just by moving the mouse across the navigation. Preloads must
    // therefore never redirect and never hit the network: just decline
    // quietly and let the real navigation run this guard in full.
    if (preload) return

    // The root guard may have skipped its refresh because no session hint was
    // present. That skip is an optimization for public pages and must not
    // decide a protected route, so resolve against the server before
    // redirecting. An in-memory session returns without a request.
    //
    // Race the resolve against a hard timeout: a hung refresh (navigator.locks
    // deadlock, stalled network) would otherwise leave this beforeLoad pending
    // forever and freeze the entire router — no page renders, no clicks work.
    await Promise.race([
      resolveAuthentication(),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ])

    const { auth } = useAuthStore.getState()

    if (!auth.user || !auth.accessToken) {
      // 不再把未登录用户丢到独立的登录页。留在首页、把弹窗打开，并把用户原本
      // 想去的地址带在 URL 上（`redirect`），登录成功后回到那里。用 `replace`
      // 覆盖掉这次注定被拦截的导航，避免后退时又撞回同一次重定向。
      const params = new URLSearchParams({ auth: 'signin' })
      params.set('redirect', location.href)
      throw redirect({ href: `/?${params.toString()}`, replace: true })
    }
  },
  component: AuthenticatedLayout,
})
