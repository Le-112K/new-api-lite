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
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import {
  buildAuthDialogClosedHref,
  buildAuthDialogHref,
  parseAuthDialogState,
  type AuthDialogMode,
} from '../lib/auth-dialog'
import { AuthFormPanel } from './auth-form-panel'

/**
 * The sign-in / sign-up modal.
 *
 * It renders itself from the URL (`?auth=signin|signup&redirect=…`) so the
 * header only has to navigate, and so a reload or a shared link restores both
 * the open state and the destination.
 *
 * Responsiveness is pure CSS, one code path: the popup is a full-viewport sheet
 * by default and becomes a centred card from the `xl` breakpoint up. A user
 * agent check was considered and rejected (UA reduction, iPads reporting as
 * Macintosh), and 1024px is expected to render the sheet.
 *
 * The popup is composed from the Base UI dialog primitive directly rather than
 * `DialogContent` from `@/components/ui/dialog`: that helper hard-codes a
 * centred card and always mounts its own backdrop, so it can express neither the
 * sheet layout nor "no animation under reduced motion". `Dialog`,
 * `DialogPortal`, `DialogOverlay`, `DialogTitle` and `DialogClose` are still the
 * project's components. Focus trapping, ESC handling and focus restoration stay
 * with Base UI.
 */
export function AuthDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const locationHref = useRouterState({ select: (state) => state.location.href })
  const currentUrl = new URL(locationHref, window.location.origin)
  const dialog = parseAuthDialogState(currentUrl.search)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      navigate({
        href: buildAuthDialogClosedHref(currentUrl.pathname, currentUrl.search),
      })
    },
    [navigate, currentUrl.pathname, currentUrl.search]
  )

  const handleModeChange = useCallback(
    (mode: string) => {
      if (mode !== 'sign-in' && mode !== 'sign-up') return
      navigate({
        href: buildAuthDialogHref(
          currentUrl.pathname,
          currentUrl.search,
          mode as AuthDialogMode
        ),
      })
    },
    [navigate, currentUrl.pathname, currentUrl.search]
  )

  const isSignUp = dialog.mode === 'sign-up'
  const title = isSignUp ? t('Create an account') : t('Sign in')
  const subtitle = isSignUp
    ? t('A few steps, then connect your first channel')
    : t('Continue with your self-hosted account')

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className='bg-black/40 motion-reduce:animate-none!' />
        <DialogPrimitive.Popup
          data-slot='auth-dialog-content'
          className={cn(
            'bg-popover text-popover-foreground fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain p-6 outline-none',
            'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150 motion-reduce:animate-none!',
            'xl:inset-auto xl:top-1/2 xl:left-1/2 xl:max-h-[calc(100dvh-2rem)] xl:w-full xl:max-w-md xl:-translate-x-1/2 xl:-translate-y-1/2 xl:rounded-2xl xl:shadow-[var(--shadow-hairline)] xl:ring-1 xl:ring-foreground/10'
          )}
        >
          {/* One column for both layouts: full-bleed and vertically centred in
              the sheet, the card's content box at `xl`. `my-auto` (rather than
              `justify-center` on the popup) keeps the top reachable once the
              form is taller than the viewport. */}
          <div className='relative mx-auto my-auto flex w-full max-w-md flex-col gap-4'>
            <div className='flex flex-col gap-1.5 pr-10'>
              <DialogTitle className='text-lg font-semibold tracking-tight'>
                {title}
              </DialogTitle>
              <DialogDescription>{subtitle}</DialogDescription>
            </div>

            <Tabs
              value={dialog.mode}
              onValueChange={handleModeChange}
              className='flex flex-col gap-4'
            >
              <TabsList
                aria-label={t('Sign in or sign up')}
                className='group-data-horizontal/tabs:h-auto flex w-full rounded-full p-1'
              >
                <TabsTrigger
                  value='sign-in'
                  className='data-active:bg-foreground data-active:text-background dark:data-active:bg-foreground dark:data-active:text-background dark:data-active:border-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none h-9 flex-1 rounded-full font-semibold'
                >
                  {t('Sign in')}
                </TabsTrigger>
                <TabsTrigger
                  value='sign-up'
                  className='data-active:bg-foreground data-active:text-background dark:data-active:bg-foreground dark:data-active:text-background dark:data-active:border-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none h-9 flex-1 rounded-full font-semibold'
                >
                  {t('Sign up')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value='sign-in' className='px-1'>
                <AuthFormPanel
                  mode='sign-in'
                  variant='dialog'
                  redirectTo={dialog.redirectTo}
                />
              </TabsContent>
              <TabsContent value='sign-up' className='px-1'>
                <AuthFormPanel mode='sign-up' variant='dialog' />
              </TabsContent>
            </Tabs>

            <DialogClose
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className='absolute top-0 right-0'
                />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className='sr-only'>{t('Close')}</span>
            </DialogClose>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
