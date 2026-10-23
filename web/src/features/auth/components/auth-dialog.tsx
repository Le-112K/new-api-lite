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
import { useCallback, useRef } from 'react'
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
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { ForgotPasswordForm } from '../forgot-password/components/forgot-password-form'
import {
  buildAuthDialogClosedHref,
  buildAuthDialogHref,
  parseAuthDialogState,
  type AuthDialogMode,
  type AuthDialogState,
} from '../lib/auth-dialog'
import { UserAuthForm } from '../sign-in/components/user-auth-form'
import { SignUpForm } from '../sign-up/components/sign-up-form'
import { TermsFooter } from './terms-footer'

/**
 * The sign-in / sign-up / password-reset modal.
 *
 * One window, no segmented control: the URL (`?auth=signin|signup|forgot`)
 * decides which pane renders and the pane's own footer line switches it — the
 * pattern mainstream sites use. Keeping the state in the URL means a reload or
 * a shared link restores the exact pane.
 *
 * Strictly modal: `disablePointerDismissal` makes clicks on the backdrop and
 * on the navigation underneath inert — the only ways out are the close button
 * and Escape. That is deliberate: an anonymous visitor who lands here from a
 * guarded route should be able to finish or explicitly dismiss signing in,
 * not lose the dialog to a stray click.
 *
 * Responsiveness is pure CSS, one code path: the popup is a full-viewport
 * sheet by default and becomes a centred card from the `xl` breakpoint up.
 */
export function AuthDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { status } = useStatus()
  const locationHref = useRouterState({ select: (state) => state.location.href })
  const currentUrl = new URL(locationHref, window.location.origin)
  const dialog = parseAuthDialogState(currentUrl.search)

  // Freeze the last open state: Base UI keeps the popup mounted through its
  // exit animation while `open` is already false, and without the snapshot the
  // pane would visibly swap (e.g. sign-up → sign-in) on the closing frames —
  // a one-frame flash in the middle of the page.
  const lastOpenRef = useRef<AuthDialogState>(dialog)
  if (dialog.open) lastOpenRef.current = dialog
  const view = dialog.open ? dialog : lastOpenRef.current

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      navigate({
        href: buildAuthDialogClosedHref(currentUrl.pathname, currentUrl.search),
      })
    },
    [navigate, currentUrl.pathname, currentUrl.search]
  )

  const switchMode = useCallback(
    (mode: AuthDialogMode) => {
      navigate({
        href: buildAuthDialogHref(currentUrl.pathname, currentUrl.search, mode),
      })
    },
    [navigate, currentUrl.pathname, currentUrl.search]
  )

  const isSignUp = view.mode === 'sign-up'
  const isForgotPassword = view.mode === 'forgot-password'
  const canRegister = status?.register_enabled !== false

  let title = t('Sign in')
  let subtitle = t('Continue with your self-hosted account')
  if (isSignUp) {
    title = t('Create an account')
    subtitle = t('A few steps, then connect your first channel')
  } else if (isForgotPassword) {
    title = t('Reset password')
    subtitle = t(
      'Enter your registered email and we will send you a link to reset your password.'
    )
  }

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal
    >
      <DialogPortal>
        <DialogOverlay className='bg-black/40' />
        <DialogPrimitive.Popup
          data-slot='auth-dialog-content'
          className={cn(
            'bg-popover text-popover-foreground fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain p-6 outline-none',
            'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150 motion-reduce:animate-none!',
            'xl:inset-auto xl:top-1/2 xl:left-1/2 xl:max-h-[calc(100dvh-2rem)] xl:w-full xl:max-w-[26rem] xl:-translate-x-1/2 xl:-translate-y-1/2 xl:rounded-[20px] xl:shadow-[var(--shadow-hairline)] xl:ring-1 xl:ring-foreground/10'
          )}
        >
          <div className='relative mx-auto my-auto flex w-full max-w-[26rem] flex-col gap-6'>
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

            <div className='flex flex-col gap-1.5 pr-10'>
              <DialogTitle className='text-xl font-semibold tracking-tight'>
                {title}
              </DialogTitle>
              <DialogDescription className='text-muted-foreground text-sm leading-relaxed'>
                {subtitle}
              </DialogDescription>
            </div>

            {isForgotPassword && <ForgotPasswordForm />}
            {isSignUp && <SignUpForm onSuccess={() => switchMode('sign-in')} />}
            {!isForgotPassword && !isSignUp && (
              <UserAuthForm
                redirectTo={view.redirectTo}
                onForgotPassword={() => switchMode('forgot-password')}
              />
            )}

            <div className='flex flex-col gap-3'>
              {isForgotPassword && (
                <SwitchLine
                  lead={t('Remembered your password?')}
                  action={t('Back to sign in')}
                  onClick={() => switchMode('sign-in')}
                />
              )}
              {isSignUp && (
                <SwitchLine
                  lead={t('Already have an account?')}
                  action={t('Sign in')}
                  onClick={() => switchMode('sign-in')}
                />
              )}
              {!isSignUp && !isForgotPassword && canRegister && (
                <SwitchLine
                  lead={t("Don't have an account?")}
                  action={t('Sign up')}
                  onClick={() => switchMode('sign-up')}
                />
              )}
              {!isForgotPassword && (
                <TermsFooter
                  variant={isSignUp ? 'sign-up' : 'sign-in'}
                  status={status}
                  className='text-center'
                />
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

type SwitchLineProps = {
  lead: string
  action: string
  onClick: () => void
}

/** Muted "already have an account?" line with an inline text button. */
function SwitchLine(props: SwitchLineProps) {
  return (
    <p className='text-muted-foreground text-center text-sm'>
      {props.lead}{' '}
      <button
        type='button'
        onClick={props.onClick}
        className='text-foreground hover:text-foreground/70 font-medium underline-offset-4 transition-colors hover:underline'
      >
        {props.action}
      </button>
    </p>
  )
}
