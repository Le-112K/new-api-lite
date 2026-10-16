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
import { useEffect, useState } from 'react'

import { useTheme } from '@/context/theme-provider'

import { getConsoleChartTokens, type ConsoleChartTokens } from '../lib/console-chart-colors'

/**
 * Resolve the console token layer (`styles/console-tokens.css`) into concrete
 * colour strings for the VChart runtime.
 *
 * Why this exists: the flow sankey and the user analytics charts are drawn by
 * `@visactor/react-vchart`, whose default renderer is a `<canvas>`. A canvas
 * `fill` cannot be a CSS custom property — `var(--cat-3)` is meaningless to it —
 * so the charts need the *resolved* value of the tokens. Reading the computed
 * value off `document.documentElement` keeps `console-tokens.css` the single
 * source of truth (spec §2 / §6): no colour is duplicated in TypeScript, and
 * dark mode is picked up automatically because `.dark` flips the same vars.
 *
 * The read is deferred to a `requestAnimationFrame`: the theme provider applies
 * the `light`/`dark` class to `<html>` in its own effect, and child effects run
 * first, so reading synchronously on the commit where `resolvedTheme` flips
 * would sample the *previous* theme.
 */
export function useConsoleChartTheme(): {
  resolvedTheme: 'light' | 'dark'
  tokens: ConsoleChartTokens | null
} {
  const { resolvedTheme } = useTheme()
  const [tokens, setTokens] = useState<ConsoleChartTokens | null>(null)

  useEffect(() => {
    let frame = 0
    const read = () => setTokens(getConsoleChartTokens())
    if (typeof window === 'undefined') {
      read()
      return
    }
    frame = window.requestAnimationFrame(read)
    return () => window.cancelAnimationFrame(frame)
  }, [resolvedTheme])

  return { resolvedTheme, tokens }
}
