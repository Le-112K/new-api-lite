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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { UserAuthForm } from '../sign-in/components/user-auth-form'
import { SignUpForm } from '../sign-up/components/sign-up-form'
import { TermsFooter } from './terms-footer'

type AuthFormPanelProps = {
  mode: 'sign-in' | 'sign-up'
  /**
   * Where to land after a successful sign-in. Threaded straight into the form
   * so the fallback routes and the dialog resolve the same destination.
   */
  redirectTo?: string
  /**
   * `page` — the standalone route: it owns the heading and the cross-link to
   * the sibling route. `dialog` — inside the modal, where the dialog title and
   * the segmented control already carry both of those, so repeating them would
   * just be noise.
   */
  variant?: 'page' | 'dialog'
  className?: string
}

export function AuthFormPanel(props: AuthFormPanelProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const isDialog = props.variant === 'dialog'
  const isSignIn = props.mode === 'sign-in'

  const canRegister = status?.register_enabled !== false

  return (
    <div
      className={cn(
        'w-full space-y-6',
        isDialog && 'space-y-5',
        props.className
      )}
    >
      {!isDialog && (
        <div className='space-y-2 text-center'>
          <h2 className='text-center text-2xl font-semibold tracking-tight'>
            {isSignIn ? t('Sign in') : t('Create an account')}
          </h2>
          {isSignIn && canRegister && (
            <p className='text-muted-foreground text-sm'>
              {t("Don't have an account?")}{' '}
              <Link
                to='/sign-up'
                className='hover:text-primary font-medium underline underline-offset-4'
              >
                {t('Sign up')}
              </Link>
              .
            </p>
          )}
          {!isSignIn && (
            <p className='text-muted-foreground text-sm'>
              {t('Already have an account?')}{' '}
              <Link
                to='/sign-in'
                className='hover:text-primary font-medium underline underline-offset-4'
              >
                {t('Sign in')}
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {isSignIn ? (
        <UserAuthForm redirectTo={props.redirectTo} />
      ) : (
        <SignUpForm />
      )}

      <TermsFooter
        variant={isSignIn ? 'sign-in' : 'sign-up'}
        status={status}
        className='text-center'
      />
    </div>
  )
}
