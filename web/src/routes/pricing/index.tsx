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
import z from 'zod'

import { Pricing } from '@/features/pricing'
import { pricingQueryOptions } from '@/features/pricing/queries'
import { getModuleAccessForGuard } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

const pricingSearchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  vendor: z.string().optional(),
  group: z.string().optional(),
  quotaType: z.string().optional(),
  endpointType: z.string().optional(),
  tag: z.string().optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  view: z.enum(['card', 'table']).optional().catch(undefined),
  rechargePrice: z.boolean().optional(),
})

export const Route = createFileRoute('/pricing/')({
  validateSearch: pricingSearchSchema,
  beforeLoad: async ({ context, location, preload }) => {
    // Hover preloads must never redirect (a redirect from a preload is
    // upgraded into a real navigation and can loop); warming the data is the
    // only useful thing a preload can do here.
    if (preload) {
      void context.queryClient
        .ensureQueryData(pricingQueryOptions())
        .catch(() => undefined)
      return
    }

    const access = await getModuleAccessForGuard(context.queryClient, 'pricing')
    if (!access.enabled) {
      throw redirect({ to: '/' })
    }
    if (access.requireAuth) {
      const { auth } = useAuthStore.getState()
      if (!auth.user) {
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
        })
      }
    }

    // Load the model list while the navigation is still pending: the current
    // page stays on screen until the data is here, so the route paints
    // complete instead of flashing a bare skeleton of the layout.
    await context.queryClient
      .ensureQueryData(pricingQueryOptions())
      .catch(() => undefined)
  },
  component: Pricing,
})
