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
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandWordmark } from '@/components/brand-wordmark'
import { Button } from '@/components/ui/button'
import { verifyEmailLink } from '@/features/auth/api'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'

type VerifyState = 'verifying' | 'done' | 'failed'

/**
 * Landing page for the link that signup sends out.
 *
 * The token is read from the query string and immediately exchanged over POST,
 * so it never travels in a second URL (Referer, logs, history). Exchange also
 * creates the session: verification *is* the first login, which is why a
 * successful visit continues straight into the console instead of asking for
 * the password again.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const { handleLoginResult } = useAuthRedirect()
  const [state, setState] = useState<VerifyState>('verifying')
  const [message, setMessage] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    // React 18 StrictMode mounts twice in dev; the token is single use, so the
    // exchange must not be fired twice.
    if (startedRef.current) return
    startedRef.current = true

    const token =
      new URLSearchParams(window.location.search).get('token')?.trim() ?? ''
    if (!token) {
      setState('failed')
      setMessage(t('This verification link is missing its token'))
      return
    }

    void (async () => {
      try {
        const res = await verifyEmailLink(token)
        if (!res.success) {
          setState('failed')
          setMessage(res.message || t('Verification link is no longer valid'))
          return
        }
        setState('done')
        await handleLoginResult(res.data)
      } catch {
        setState('failed')
        setMessage(t('Verification link is no longer valid'))
      }
    })()
  }, [handleLoginResult, t])

  let icon = <Loader2 className='size-5 animate-spin' />
  if (state === 'done') icon = <Check className='size-5' strokeWidth={2.4} />
  if (state === 'failed') icon = <AlertCircle className='size-5' />

  return (
    <div
      data-slot='auth-standalone'
      className='bg-background text-foreground flex min-h-[100dvh] flex-col'
    >
      <header className='px-6 py-6 md:px-10'>
        <Link to='/' className='inline-flex'>
          <BrandWordmark className='text-[17px]' />
        </Link>
      </header>

      <main className='flex flex-1 items-center justify-center px-6 pb-24'>
        <div className='w-full max-w-[27rem] text-center'>
          <div className='border-black/[0.11] dark:border-white/15 text-foreground mx-auto flex size-11 items-center justify-center rounded-full border'>
            {icon}
          </div>

          <h1 className='mt-6 text-[26px] leading-tight font-semibold tracking-[-0.03em]'>
            {state === 'verifying' && t('Verifying your email…')}
            {state === 'done' && t('Email verified')}
            {state === 'failed' && t('This link did not work')}
          </h1>

          <p className='text-muted-foreground mt-3 text-[14.5px] leading-relaxed'>
            {state === 'verifying' &&
              t('One moment — we are creating your account.')}
            {state === 'done' &&
              t('Your account is ready. Taking you to the console…')}
            {state === 'failed' && message}
          </p>

          {state === 'failed' && (
            <>
              <p className='text-muted-foreground mt-2 text-[13px] leading-relaxed'>
                {t(
                  'Submit your email and password again on the sign-in form and we will send a fresh link.'
                )}
              </p>
              <Button
                render={<Link to='/' />}
                className='mt-7 h-12 w-full justify-center rounded-lg text-[15px] font-semibold'
              >
                {t('Back to sign in')}
              </Button>
            </>
          )}

          {state === 'done' && (
            <Button
              render={<Link to='/dashboard' />}
              className='mt-7 h-12 w-full justify-center rounded-lg text-[15px] font-semibold'
            >
              {t('Continue to console')}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
