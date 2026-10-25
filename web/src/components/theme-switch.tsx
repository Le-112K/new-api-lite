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
import { Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'

type IncomingTheme = 'light' | 'dark'

const REVEAL_DURATION = 1100
const REVEAL_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

/**
 * Circular reveal for a theme change, the way the reference site does it: the
 * new surface unfolds out of the toggle itself instead of the whole page
 * snapping from one palette to the other.
 *
 * Preferred path is the View Transitions API — the browser snapshots the old
 * theme, we swap state inside the transition, then animate the incoming
 * snapshot. Three properties move together so the colour never jumps:
 *
 *   - `clip-path` grows the circle out of the button (direction);
 *   - `opacity` 0 → 1 fades the new surface in over the old one, so pixels
 *     inside the circle blend from old to new rather than flipping;
 *   - `blur` 6px → 0 settles the edge so the growth reads soft.
 *
 * The old snapshot is deliberately left opaque underneath (see
 * theme-apple-bw.css) — it is the canvas the new one fades onto.
 *
 * Browsers without View Transitions get a plain swap; the fallback overlay this
 * component used before is deliberately gone, because painting a solid disc over
 * a page that has already repainted gave a near-invisible effect and cost 40
 * lines.
 */
function playThemeReveal(origin: HTMLElement, apply: () => void) {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void> }
  }

  if (reduceMotion || typeof doc.startViewTransition !== 'function') {
    apply()
    return
  }

  const rect = origin.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const transition = doc.startViewTransition(() => {
    // The snapshot is taken after this callback returns, so the state update has
    // to be flushed synchronously or both snapshots would show the old theme.
    flushSync(apply)
  })

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
          opacity: [0, 1],
          filter: ['blur(6px)', 'blur(0px)'],
        },
        {
          duration: REVEAL_DURATION,
          easing: REVEAL_EASING,
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    })
    .catch(() => undefined)
}

export function ThemeSwitch(props: { variant?: 'default' | 'landing' }) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const triggerRef = useRef<HTMLButtonElement>(null)

  /* Update theme-color meta tag
   * when theme is updated */
  useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [resolvedTheme])

  // One click flips the theme. No menu, no "system" item: the system preference
  // is only the starting point, and clicking always produces a definite light or
  // dark — which is what a single-purpose button has to promise.
  const toggle = useCallback(() => {
    const next: IncomingTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
    const origin = triggerRef.current
    if (!origin) {
      setTheme(next)
      return
    }
    playThemeReveal(origin, () => setTheme(next))
  }, [resolvedTheme, setTheme])

  return (
    <Button
      ref={triggerRef}
      type='button'
      variant='outline'
      size='icon'
      onClick={toggle}
      aria-label={t('Toggle theme')}
      className={
        props.variant === 'landing'
          ? 'size-9 overflow-hidden rounded-[10px] border-black/[0.11] bg-transparent hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]'
          : 'h-9 w-9 overflow-hidden'
      }
    >
      <Sun
        className={
          props.variant === 'landing'
            ? 'size-[18px] scale-100 rotate-0 transition-all duration-700 dark:scale-0 dark:-rotate-90'
            : 'size-[1.2rem] scale-100 rotate-0 transition-all duration-700 dark:scale-0 dark:-rotate-90'
        }
      />
      <Moon
        className={
          props.variant === 'landing'
            ? 'absolute size-[18px] scale-0 rotate-90 transition-all duration-700 dark:scale-100 dark:rotate-0'
            : 'absolute size-[1.2rem] scale-0 rotate-90 transition-all duration-700 dark:scale-100 dark:rotate-0'
        }
      />
    </Button>
  )
}
