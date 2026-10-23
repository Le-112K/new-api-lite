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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { logout } from '@/features/auth/api'
import { clearAuthenticatedClientState } from '@/lib/auth-session'
import { handleServerError } from '@/lib/handle-server-error'
import { beginSignOutWindow, endSignOutWindow } from '@/lib/sign-out-window'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSigningOut, setIsSigningOut] = useState(false)
  // Signing out of a protected page means the content itself has to leave;
  // signing out from a public page is a light action that stays put.
  const onProtectedRoute = useRouterState({
    select: (state) =>
      state.matches.some((match) =>
        String(match.routeId).startsWith('/_authenticated')
      ),
  })

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      // Late 401s from in-flight requests are expected from here on — silence
      // them so the only message is the single "signed out" toast.
      beginSignOutWindow()
      const response = await logout()
      if (!response.success) {
        endSignOutWindow()
        handleServerError(response, t('Failed to sign out session'))
        return
      }

      await queryClient.cancelQueries()
      clearAuthenticatedClientState(queryClient)
      toast.success(t('Signed out'))
      if (onProtectedRoute) {
        void navigate({ to: '/', replace: true })
      }
    } catch (error: unknown) {
      endSignOutWindow()
      handleServerError(error, t('Failed to sign out session'))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Sign out')}
      desc={t(
        'Are you sure you want to sign out? You will need to sign in again to access your account.'
      )}
      confirmText={t('Sign out')}
      handleConfirm={handleSignOut}
      isLoading={isSigningOut}
      className='sm:max-w-sm'
    />
  )
}
