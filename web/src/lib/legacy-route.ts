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
const legacyOrigin = 'https://legacy-route.invalid'

const legacyConsoleRoutes: Record<string, string> = {
  '/console': '/dashboard',
  '/console/models': '/models',
  '/console/subscription': '/subscriptions',
  '/console/channel': '/channels',
  '/console/token': '/keys',
  '/console/redemption': '/redemption-codes',
  '/console/user': '/users',
  '/console/personal': '/profile',
  '/console/log': '/usage-logs',
}

const legacySettingsTabs: Record<string, string> = {
  operation: '/system-settings/operations/behavior',
  dashboard: '/system-settings/content/dashboard',
  payment: '/system-settings/billing/payment',
  ratio: '/system-settings/billing/model-pricing',
  ratelimit: '/system-settings/security/rate-limit',
  performance: '/system-settings/operations/performance',
  system: '/system-settings/site/system-info',
  other: '/system-settings/site/system-info',
}

function normalizeLegacyPath(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

function buildTargetHref(targetPath: string, source: URL): string {
  const target = new URL(targetPath, legacyOrigin)
  source.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value)
  })
  target.hash = source.hash
  return `${target.pathname}${target.search}${target.hash}`
}

export function resolveLegacyRoute(rawHref: string): string | null {
  let source: URL
  try {
    source = new URL(rawHref, legacyOrigin)
  } catch {
    return null
  }

  const pathname = normalizeLegacyPath(source.pathname)
  if (pathname === '/login') {
    return buildTargetHref('/sign-in', source)
  }
  if (pathname === '/forbidden') {
    return buildTargetHref('/403', source)
  }
  if (pathname === '/console/topup') {
    return buildTargetHref('/wallet', source)
  }
  if (pathname === '/console/setting') {
    const tab = source.searchParams.get('tab') ?? ''
    const target = legacySettingsTabs[tab] ?? '/system-settings'
    return buildTargetHref(target, source)
  }
  if (pathname === '/console/chat') {
    return buildTargetHref('/dashboard', source)
  }
  if (pathname.startsWith('/console/chat/')) {
    return buildTargetHref('/dashboard', source)
  }

  // The system-settings "Models" group was removed. Two of its former sections
  // had already been superseded by the request-policies group, so keep pointing
  // those at their new home and send every other stale path to the settings root.
  if (pathname === '/system-settings/models/channel-affinity') {
    return buildTargetHref('/system-settings/request-policies/routing', source)
  }
  if (pathname === '/system-settings/models/routing-reliability') {
    return buildTargetHref('/system-settings/request-policies/routing', source)
  }
  if (
    pathname === '/system-settings/models' ||
    pathname.startsWith('/system-settings/models/')
  ) {
    return buildTargetHref('/system-settings', source)
  }

  const target = legacyConsoleRoutes[pathname]
  if (target) return buildTargetHref(target, source)
  if (pathname.startsWith('/console/')) {
    return buildTargetHref('/dashboard', source)
  }

  return null
}
