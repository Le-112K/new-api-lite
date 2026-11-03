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
import { useNavigate } from '@tanstack/react-router'
import i18n from 'i18next'
import { useCallback, useEffect, useRef } from 'react'

import {
  getSavedLanguage,
  sanitizeAuthRedirect,
} from '@/features/auth/lib/auth-redirect'
import { normalizeInterfaceLanguage } from '@/i18n/languages'
import { applyAuthBundle, isAuthBundle } from '@/lib/api'
import { AuthOperationError } from '@/lib/secure-verification'
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

/**
 * Hook for handling authentication redirects and user data management
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Handle successful login
   * @param userData - Optional user data from login response
   * @param redirectTo - Redirect path after login
   */
  const handleLoginSuccess = useCallback(
    async (bundle: AuthBundle, redirectTo?: string) => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return
      }
      applyAuthBundle(bundle)
      // 账号里存的语言可能是 "zh" 或 "zh-CN"，直接交给 i18next 会匹配不上
      // 内部代号 "zhCN"：语言包按未知语言回退到英文，界面于是「设置是中文、
      // 显示却是英文」，手动切一次语言才恢复。这里先归一到内部代号。
      const savedLang = normalizeInterfaceLanguage(
        getSavedLanguage(bundle.user)
      )
      if (savedLang !== i18n.language) {
        await i18n.changeLanguage(savedLang)
      }

      const targetPath =
        sanitizeAuthRedirect(redirectTo, window.location.origin) ?? '/dashboard'
      await navigate({ href: targetPath, replace: true })
    },
    [navigate, sessionID]
  )

  /**
   * Every primary login transport returns the same bundle-or-challenge contract.
   */
  const handleLoginResult = useCallback(
    async (result: unknown, redirectTo?: string): Promise<boolean> => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return false
      }
      if (isAuthBundle(result)) {
        await handleLoginSuccess(result, redirectTo)
        return true
      }
      throw new AuthOperationError('Login failed')
    },
    [handleLoginSuccess, navigate, sessionID]
  )

  /**
   * Redirect to login page
   */
  const redirectToLogin = useCallback(() => {
    void navigate({ to: '/sign-in', replace: true })
  }, [navigate])

  /**
   * Redirect to register page
   */
  const redirectToRegister = useCallback(() => {
    void navigate({ to: '/sign-up', replace: true })
  }, [navigate])

  return {
    handleLoginSuccess,
    handleLoginResult,
    redirectToLogin,
    redirectToRegister,
  }
}
