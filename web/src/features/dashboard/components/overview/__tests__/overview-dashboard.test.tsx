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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { OverviewDashboard } from '../overview-dashboard'

const NOW = Math.floor(Date.now() / 1000)

const QUOTA_ITEMS = [
  {
    id: 1,
    created_at: NOW - 2 * 86400,
    model_name: 'gpt-4o',
    count: 8000,
    quota: 6000000,
  },
  {
    id: 2,
    created_at: NOW - 86400,
    model_name: 'claude-sonnet-4',
    count: 4480,
    quota: 3200000,
  },
]

const LOG_ITEMS = [
  {
    id: 1,
    user_id: 1,
    created_at: NOW,
    type: 2,
    content: '',
    username: 'dashboard-user',
    token_name: 'macbook-pro',
    model_name: 'gpt-4o',
    quota: 12100,
    prompt_tokens: 1204,
    completion_tokens: 386,
    use_time: 1,
    is_stream: false,
    channel: 1,
    channel_name: 'OpenAI',
    token_id: 1,
    group: 'default',
    ip: '127.0.0.1',
    other: '',
    request_id: 'req-1',
    upstream_request_id: 'up-1',
  },
]

let client: QueryClient
/** Flipped by the tests to drive the data-driven empty ↔ analytics switch. */
let hasUsage: boolean

beforeEach(() => {
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 1,
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  hasUsage = true

  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.startsWith('/api/data/self')) {
      return { data: { success: true, data: hasUsage ? QUOTA_ITEMS : [] } }
    }
    if (url.startsWith('/api/log/self')) {
      return {
        data: {
          success: true,
          data: {
            items: hasUsage ? LOG_ITEMS : [],
            total: hasUsage ? LOG_ITEMS.length : 0,
            page: 1,
            page_size: 8,
          },
        },
      }
    }
    throw new Error(`Unexpected overview request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  window.localStorage.clear()
  vi.restoreAllMocks()
})

async function renderOverview() {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: OverviewDashboard,
  })
  const stubRoute = (path: string) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      stubRoute('/keys'),
      stubRoute('/channels'),
      stubRoute('/usage-logs'),
      stubRoute('/pricing'),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('overview dashboard', () => {
  it('renders the analytics layout with data, and never the prototype toolbar', async () => {
    await renderOverview()

    expect(await screen.findByText('Account balance')).toBeVisible()
    expect(screen.getByText("This month's spend")).toBeVisible()
    expect(screen.getByText("This month's requests")).toBeVisible()

    // KPI numbers come straight from the mocked /api/data/self rows, and the
    // donut centre repeats the same request total — one source of truth.
    expect(screen.getAllByText('12,480')).toHaveLength(2)
    // The model-share legend sums to the same request total, and its
    // percentages are derived from those very counts.
    expect(screen.getAllByText('8,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4,480').length).toBeGreaterThan(0)
    expect(screen.getByText('64%')).toBeVisible()
    expect(screen.getByText('36%')).toBeVisible()

    expect(screen.getByText('Usage trend')).toBeVisible()
    expect(screen.getByText('Model call share')).toBeVisible()
    expect(screen.getByText('Recent calls')).toBeVisible()
    expect(screen.getByText('macbook-pro')).toBeVisible()

    expect(screen.queryByText('No usage yet')).not.toBeInTheDocument()
    // The prototype's review-only state switcher must never ship.
    expect(screen.queryByText(/原型状态预览/)).not.toBeInTheDocument()
    expect(screen.queryByText(/上线前移除/)).not.toBeInTheDocument()
  })

  it('renders the first-run guide instead of empty charts when there is no usage', async () => {
    hasUsage = false
    await renderOverview()

    expect(await screen.findByText('No usage yet')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Create your first token/ })
    ).toBeVisible()
    // Step 1 is always present; the channel step is admin-only.
    expect(screen.getByText('Create a token')).toBeVisible()
    expect(screen.getByText('Send your first request')).toBeVisible()
    expect(screen.queryByText('Add a channel')).not.toBeInTheDocument()

    // No analytics shell at all in this state.
    expect(screen.queryByText('Account balance')).not.toBeInTheDocument()
    expect(screen.queryByText('Usage trend')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent calls')).not.toBeInTheDocument()
  })

  it('switches to the analytics layout when usage appears, driven by the data', async () => {
    hasUsage = false
    await renderOverview()
    expect(await screen.findByText('No usage yet')).toBeVisible()

    hasUsage = true
    await act(async () => {
      await client.refetchQueries({ queryKey: ['dashboard', 'overview'] })
    })

    expect(await screen.findByText('Account balance')).toBeVisible()
    expect(screen.queryByText('No usage yet')).not.toBeInTheDocument()
  })

  it('scopes the trend window to the selected range', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    await renderOverview()
    await screen.findByText('Usage trend')

    const thirty = screen.getByRole('tab', { name: 'Last 30 days' })
    await user.click(thirty)
    expect(thirty).toHaveAttribute('aria-selected', 'true')
    // The analytics layout is untouched by the range switch.
    expect(screen.getByText('Usage trend')).toBeVisible()
  })
})
