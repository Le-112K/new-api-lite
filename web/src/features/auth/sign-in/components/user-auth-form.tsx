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
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authEntry, resendVerificationLink } from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { authEntryFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import type { AuthFormProps } from '@/features/auth/types'
import { useCountdown } from '@/hooks/use-countdown'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const RESEND_COOLDOWN_SECONDS = 60

/**
 * The single entry point for both signing in and signing up.
 *
 * One email field, one password field, one button. What happens next is decided
 * by the server and reflected here:
 *   - known address  → `action: "login"`, the session lands immediately;
 *   - unknown address → `action: "verify_email"`, the pane turns into a
 *     "check your inbox" screen and nothing exists until the link is opened.
 *
 * The user never has to know which case they are in before submitting.
 */
export function UserAuthForm({
  className,
  redirectTo,
  onForgotPassword,
  ...props
}: AuthFormProps & {
  /**
   * In-dialog behaviour for the "forgot password" affordance. When provided the
   * link becomes a button that switches the dialog pane; standalone pages keep
   * the route link.
   */
  onForgotPassword?: () => void
}) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')
  const entryFailedMessage = t('Sign in failed')

  const { status } = useStatus()
  const passwordLoginEnabled =
    (status?.password_login_enabled ??
      status?.data?.password_login_enabled ??
      true) !== false
  const passwordLoginEncryptionEnabled =
    (status?.password_login_encryption_enabled ??
      status?.data?.password_login_encryption_enabled ??
      false) === true
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginResult } = useAuthRedirect()
  const { secondsLeft, isActive, start: startCooldown } = useCountdown({
    initialSeconds: RESEND_COOLDOWN_SECONDS,
  })

  const form = useForm<z.infer<typeof authEntryFormSchema>>({
    resolver: zodResolver(authEntryFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof authEntryFormSchema>) {
    if (!agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!validateTurnstile()) return

    // One challenge per attempt: the token is spent by the request either way.
    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsLoading(true)
    try {
      // One box, two identities: an email signs a normal account in (or starts
      // a verified signup); a bare identifier is the root-only username path.
      const identifier = data.email.trim()
      const isEmail = identifier.includes('@')
      const res = await authEntry({
        ...(isEmail ? { email: identifier } : { username: identifier }),
        password: data.password,
        agreeLegal: agreedToLegal,
        turnstile: submittedTurnstileToken,
        passwordEncryptionEnabled: passwordLoginEncryptionEnabled,
      })

      if (!res.success) {
        handleServerError(createServerError(res, entryFailedMessage))
        return
      }

      if (res.data && 'action' in res.data && res.data.action === 'verify_email') {
        // Signup: nothing exists yet, so park the address and show the inbox
        // screen. The typed password is dropped from memory right away.
        form.setValue('password', '')
        setPendingEmail(res.data.email)
        startCooldown()
        toast.success(t('Verification email sent'))
        return
      }

      form.setValue('password', '')
      if (await handleLoginResult(res.data, redirectTo)) {
        toast.success(t('Welcome back!'))
      }
    } catch (error: unknown) {
      handleServerError(AuthOperationError.from(error, entryFailedMessage))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!pendingEmail || isActive || isResending) return
    setIsResending(true)
    try {
      await resendVerificationLink(pendingEmail)
      startCooldown()
      toast.success(t('Verification email sent'))
    } catch (error: unknown) {
      handleServerError(
        AuthOperationError.from(error, t('Failed to send verification email'))
      )
    } finally {
      setIsResending(false)
    }
  }

  if (pendingEmail) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className='border-black/[0.11] dark:border-white/15 flex size-11 items-center justify-center rounded-full border'>
          <Mail className='text-foreground size-[18px]' strokeWidth={1.9} />
        </div>
        <p className='text-foreground mt-5 text-[19px] leading-tight font-semibold tracking-[-0.02em]'>
          {t('Check your inbox')}
        </p>
        <p className='text-muted-foreground mt-2 text-[14px] leading-relaxed'>
          {t(
            'We sent a verification link to {{email}}. Open it to finish creating your account — you will be signed in automatically.',
            { email: pendingEmail }
          )}
        </p>

        <Button
          type='button'
          variant='outline'
          className='border-black/[0.11] dark:border-white/15 mt-6 h-12 w-full justify-center gap-2 rounded-lg text-[15px] font-semibold'
          disabled={isActive || isResending}
          onClick={handleResend}
        >
          {isResending ? <Loader2 className='size-4 animate-spin' /> : null}
          {isActive
            ? t('Resend in {{seconds}}s', { seconds: secondsLeft })
            : t('Resend email')}
        </Button>

        <button
          type='button'
          className='text-muted-foreground hover:text-foreground mt-3 self-center text-sm font-medium transition-colors'
          onClick={() => setPendingEmail(null)}
        >
          {t('Use a different email')}
        </button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        noValidate
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-[13.5px] font-semibold text-foreground'>
                {t('Email / admin username')}
              </FormLabel>
              <FormControl>
                <Input
                  className='h-12 rounded-lg border-black/[0.11] px-4 text-[15px] shadow-none dark:border-white/15'
                  placeholder={t('name@example.com / admin')}
                  type='text'
                  inputMode='text'
                  autoComplete='username'
                  autoCapitalize='none'
                  spellCheck={false}
                  disabled={!passwordLoginEnabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel className='text-[13.5px] font-semibold text-foreground'>
                {t('Password')}
              </FormLabel>
              <FormControl>
                <PasswordInput
                  className='[&_input]:h-12 [&_input]:rounded-lg [&_input]:border-black/[0.11] [&_input]:px-4 [&_input]:text-[15px] [&_input]:shadow-none dark:[&_input]:border-white/15'
                  placeholder={t('Enter your password')}
                  autoComplete='current-password'
                  disabled={!passwordLoginEnabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
              {onForgotPassword ? (
                <button
                  type='button'
                  onClick={onForgotPassword}
                  className='text-muted-foreground hover:text-foreground absolute end-0 -top-0.5 z-10 text-sm font-medium transition-colors'
                >
                  {t('Forgot password?')}
                </button>
              ) : (
                <Link
                  to='/forgot-password'
                  className='text-muted-foreground hover:text-foreground absolute end-0 -top-0.5 z-10 text-sm font-medium transition-colors'
                >
                  {t('Forgot password?')}
                </Link>
              )}
            </FormItem>
          )}
        />

        {!passwordLoginEnabled && (
          <p className='text-muted-foreground text-sm'>
            {t('Password sign-in is disabled. Contact your administrator.')}
          </p>
        )}

        <p className='text-muted-foreground -mt-1 text-[12.5px] leading-relaxed'>
          {t(
            'No account yet? Confirming your email creates one — we never ask for a password twice.'
          )}
        </p>

        {isTurnstileEnabled && (
          <div>
            <Turnstile
              key={turnstileWidgetKey}
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
            />
          </div>
        )}

        <LegalConsent
          status={status}
          checked={agreedToLegal}
          onCheckedChange={setAgreedToLegal}
          className='mt-1'
        />

        <Button
          type='submit'
          className='mt-1 h-12 w-full justify-center gap-2 rounded-lg text-[15px] font-semibold'
          disabled={
            !passwordLoginEnabled || isLoading || !agreedToLegal
          }
        >
          {t('Continue')}
          {isLoading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <ArrowRight className='size-4' />
          )}
        </Button>
      </form>
    </Form>
  )
}
