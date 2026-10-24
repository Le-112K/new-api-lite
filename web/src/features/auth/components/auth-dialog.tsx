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
import { Check } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandWordmark } from '@/components/brand-wordmark'
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
        {/* Light veil: keeps the page's paper feel and the aperture visible
            underneath. Clicks on it stay inert (`disablePointerDismissal`), so
            the only exits are the close button and Escape. */}
        <DialogOverlay className='bg-background/80 backdrop-blur-[2px]' />
        <DialogPrimitive.Popup
          data-slot='auth-dialog-content'
          className={cn(
            'bg-background text-foreground fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain outline-none',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.99] data-closed:animate-out data-closed:fade-out-0 duration-150 motion-reduce:animate-none!',
            // Desktop: centred two-pane card. The left column is the brand
            // panel; the right column owns the form and can scroll on its own.
            'md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-2rem)] md:min-h-[35rem] md:w-[min(56rem,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:overflow-hidden md:rounded-[24px] md:shadow-[0_2px_10px_-4px_rgba(0,0,0,0.06),0_32px_80px_-40px_rgba(0,0,0,0.28)] md:ring-1 md:ring-foreground/10'
          )}
        >
          {/* Brand panel — hidden on mobile, where the sheet is the whole
              screen and the form needs every pixel. */}
          <aside className='relative hidden shrink-0 flex-col justify-between overflow-hidden bg-[#0a0a0a] p-8 text-white md:flex md:w-[19rem]'>
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 opacity-[0.14]'
              style={{
                backgroundImage:
                  'repeating-linear-gradient(60deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 30px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 26px)',
              }}
            />
            <div className='relative'>
              <BrandWordmark className='text-[17px] text-white' />
            </div>
            <div className='relative'>
              <p className='text-[26px] leading-[1.08] font-semibold tracking-[-0.03em]'>
                <span className='block'>{t('One key.')}</span>
                <span className='block'>{t('Every model.')}</span>
              </p>
              <ul className='mt-6 space-y-2.5'>
                {[
                  t('OpenAI- and Anthropic-compatible endpoints'),
                  t('Works with Claude Code, Codex CLI and Cursor'),
                  t('Self-host in one command, no subscription'),
                ].map((line) => (
                  <li
                    key={line}
                    className='flex items-start gap-2 text-[12.5px] leading-5 text-white/60'
                  >
                    <Check className='mt-0.5 size-3.5 shrink-0 text-white/40' />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Form column */}
          <div className='relative flex min-h-[100dvh] flex-1 flex-col px-6 pt-6 pb-10 sm:px-8 md:min-h-0 md:justify-center md:overflow-y-auto md:px-10 md:py-10'>
            {/* Mobile chrome: the sheet covers the page header, so the brand
                and the close affordance move inside it. */}
            <div className='mb-10 flex items-center md:hidden'>
              <BrandWordmark className='text-[17px]' />
            </div>
            <DialogClose
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className='absolute top-4 right-4 md:top-5 md:right-5'
                />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className='sr-only'>{t('Close')}</span>
            </DialogClose>

            <div className='mx-auto w-full max-w-[25rem]'>
              <div className='flex flex-col gap-2 pr-10'>
                <p className='text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
                  {t('Welcome')}
                </p>
                <DialogTitle className='text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] md:text-[34px]'>
                  {title}
                </DialogTitle>
                <DialogDescription className='text-[15px] leading-relaxed text-muted-foreground'>
                  {subtitle}
                </DialogDescription>
              </div>

              <div className='mt-7 flex flex-col gap-5'>
                {isForgotPassword && <ForgotPasswordForm />}
                {isSignUp && (
                  <SignUpForm onSuccess={() => switchMode('sign-in')} />
                )}
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
