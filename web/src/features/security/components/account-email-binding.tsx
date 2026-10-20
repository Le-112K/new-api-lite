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
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/features/profile/types'

import { EmailBindDialog } from './dialogs/email-bind-dialog'

interface AccountEmailBindingProps {
  profile: UserProfile | null
  onUpdate: () => void
}

export function AccountEmailBinding({
  profile,
  onUpdate,
}: AccountEmailBindingProps) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const email = profile?.email

  return (
    <>
      <ul
        aria-label={t('Account Bindings')}
        className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'
      >
        <li className='flex min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <div className='bg-muted shrink-0 rounded-md p-1.5'>
              <Mail className='h-4 w-4' />
            </div>
            <div className='min-w-0'>
              <div className='flex items-center gap-1.5'>
                <p className='truncate text-sm font-medium' title={t('Email')}>
                  {t('Email')}
                </p>
                {email && (
                  <StatusBadge
                    label={t('Bound')}
                    variant='success'
                    copyable={false}
                  />
                )}
              </div>
              <p className='text-muted-foreground truncate text-xs'>
                {email || t('Not bound')}
              </p>
            </div>
          </div>
          <Button
            variant='outline'
            size='sm'
            className='h-7 shrink-0 px-2.5 text-xs'
            onClick={() => setDialogOpen(true)}
          >
            {t(email ? 'Change' : 'Bind')}
          </Button>
        </li>
      </ul>

      <EmailBindDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentEmail={email}
        onSuccess={onUpdate}
      />
    </>
  )
}
