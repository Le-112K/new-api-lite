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
import { Check, Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

/**
 * Circular reveal for a theme change.
 *
 * The reference grows a `clip-path: circle()` from the toggle's own centre out
 * to full-viewport radius, painted in the *incoming* theme's background, so the
 * new surface appears to spread out of the button instead of cross-fading the
 * whole page. The overlay is created on demand and removed when the animation
 * ends — it never lives in the tree, which keeps React out of the way and means
 * no stylesheet has to travel with this component.
 */
function playThemeReveal(origin: HTMLElement, incomingDark: boolean) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const rect = origin.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'pointer-events:none',
    `background:${incomingDark ? '#0a0a0a' : '#ffffff'}`,
  ].join(';')

  const animation = overlay.animate(
    [
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
    ],
    {
      duration: 450,
      easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      fill: 'forwards',
    }
  )

  document.body.appendChild(overlay)
  animation.addEventListener('finish', () => overlay.remove(), { once: true })
  // 兜底：动画被中断（切页、切标签）时也要摘掉覆盖层
  window.setTimeout(() => overlay.remove(), 700)
}

export function ThemeSwitch(props: { variant?: 'default' | 'landing' }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const triggerRef = useRef<HTMLButtonElement>(null)

  /* Update theme-color meta tag
   * when theme is updated */
  useEffect(() => {
    const themeColor = theme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  /* Switch, then let the new surface spread out of the button. */
  const choose = useCallback(
    (next: 'light' | 'dark') => {
      const origin = triggerRef.current
      if (origin) playThemeReveal(origin, next === 'dark')
      setTheme(next)
    },
    [setTheme]
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            ref={triggerRef}
            variant='outline'
            size='icon'
            className={
              props.variant === 'landing'
                ? 'size-9 overflow-hidden rounded-[10px] border-black/[0.11] bg-transparent hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]'
                : 'h-9 w-9 overflow-hidden'
            }
          />
        }
      >
        <Sun
          className={
            props.variant === 'landing'
              ? 'size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90'
              : 'size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90'
          }
        />
        <Moon
          className={
            props.variant === 'landing'
              ? 'absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0'
              : 'absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0'
          }
        />
        <span className='sr-only'>{t('Toggle theme')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => choose('light')}>
          {t('Light')}{' '}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose('dark')}>
          {t('Dark')}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'dark' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          {t('System')}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'system' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
