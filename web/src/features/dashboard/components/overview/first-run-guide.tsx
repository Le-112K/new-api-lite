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
import {
  ArrowRight,
  Copy,
  KeyRound,
  RadioTower,
  Rocket,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface OnboardingStep {
  title: string
  description: string
  to: '/keys' | '/channels' | '/usage-logs'
  icon: LucideIcon
  adminOnly?: boolean
}

function getOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function buildFirstRequest(endpoint: string): string {
  return [
    `curl ${endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    '  -H "Authorization: Bearer sk-..." \\',
    `  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

/**
 * First-run state for a brand-new instance.
 *
 * The page swaps to the analytics layout as soon as real usage exists (see
 * `useOverviewData().hasData`), so this only ever renders when the instance
 * genuinely has nothing to chart. The "send your first request" panel is carried
 * over from the previous overview, which is the one part of it that was
 * genuinely useful.
 */
export function FirstRunGuide() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        title: t('Create a token'),
        description: t(
          'A token scoped to your app, with an optional quota cap and allowed models.'
        ),
        to: '/keys',
        icon: KeyRound,
      },
      {
        title: t('Add a channel'),
        description: t('Connect your upstream provider under Channels.'),
        to: '/channels',
        icon: RadioTower,
        adminOnly: true,
      },
      {
        title: t('Send your first request'),
        description: t(
          'Point your base_url at this gateway and call any model with the token you just created.'
        ),
        to: '/usage-logs',
        icon: TerminalSquare,
      },
    ],
    [t]
  )

  const visibleSteps = steps.filter((step) => !step.adminOnly || isAdmin)
  const request = useMemo(
    () => buildFirstRequest(`${getOrigin()}/v1/chat/completions`),
    []
  )

  const handleCopy = async () => {
    const copied = await copyToClipboard(request)
    if (copied) {
      toast.success(t('Copied to clipboard'))
    } else {
      toast.error(t('Failed to copy to clipboard'))
    }
  }

  return (
    <section className='bg-card overflow-hidden rounded-2xl border shadow-xs'>
      <div className='flex flex-col items-center px-5 py-10 text-center sm:px-8'>
        <IconBadge tone='neutral' size='lg' decorative={false}>
          <Rocket />
        </IconBadge>

        <h3 className='mt-3 text-base font-semibold'>{t('No usage yet')}</h3>
        <p className='text-muted-foreground mt-1 max-w-[44ch] text-sm leading-relaxed'>
          {t(
            'Connect in three steps and your first usage chart appears here in minutes.'
          )}
        </p>

        <ol className='mt-6 grid w-full max-w-4xl gap-2.5 text-left sm:grid-cols-3'>
          {visibleSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.title}>
                <Link
                  to={step.to}
                  className={cn(
                    'bg-background hover:bg-muted/50 focus-visible:ring-ring flex h-full flex-col gap-2 rounded-xl border p-3.5 transition-colors outline-none focus-visible:ring-2'
                  )}
                >
                  <span className='flex items-center gap-2'>
                    <span className='bg-foreground text-background grid size-5 shrink-0 place-content-center rounded-full text-[11px] font-bold'>
                      {index + 1}
                    </span>
                    <Icon
                      className='text-muted-foreground size-4 shrink-0'
                      aria-hidden='true'
                    />
                    <span className='truncate text-sm font-semibold'>
                      {step.title}
                    </span>
                  </span>
                  <span className='text-muted-foreground text-xs leading-relaxed'>
                    {step.description}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>

        <div className='mt-6 flex w-full max-w-4xl flex-col gap-2 text-left'>
          <div className='flex items-center justify-between gap-2'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('First API request')}
            </span>
            <Button
              variant='outline'
              size='sm'
              className='h-7 gap-1.5 px-2 text-xs'
              onClick={handleCopy}
              aria-label={t('Copy ready-to-run curl')}
            >
              <Copy data-icon='inline-start' />
              {t('Copy')}
            </Button>
          </div>
          <pre className='bg-muted/50 text-muted-foreground overflow-x-auto rounded-xl p-3 font-mono text-[11px] leading-relaxed whitespace-pre'>
            {request}
          </pre>
        </div>

        <div className='mt-6 flex flex-wrap items-center justify-center gap-2'>
          <Button render={<Link to='/keys' />}>
            <KeyRound data-icon='inline-start' />
            {t('Create your first token')}
          </Button>
          <Button variant='outline' render={<Link to='/pricing' />}>
            {t('Pricing')}
            <ArrowRight data-icon='inline-end' />
          </Button>
        </div>
      </div>
    </section>
  )
}
