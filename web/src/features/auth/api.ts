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
import axios from 'axios'

import { api, refreshAuthentication, type RefreshOutcome } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import {
  clearPasswordEncryptionCache,
  encryptPassword,
} from './lib/password-encryption'
import type {
  AuthEntryPayload,
  AuthEntryResponse,
  ApiResponse,
} from './types'

// ============================================================================
// Authentication APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Login & Logout
// ----------------------------------------------------------------------------

// Unified entry: signs an existing account in, or starts a verified signup.
export async function authEntry(
  payload: AuthEntryPayload
): Promise<AuthEntryResponse> {
  const turnstile = payload.turnstile ?? ''
  try {
    let passwordFields:
      | { password: string }
      | { password_encrypted: string; encryption_key_id: string }
    if (payload.passwordEncryptionEnabled) {
      const encryptedPassword = await encryptPassword(payload.password)
      passwordFields = {
        password_encrypted: encryptedPassword.password_encrypted,
        encryption_key_id: encryptedPassword.encryption_key_id,
      }
    } else {
      passwordFields = { password: payload.password }
    }
    const res = await api.post<AuthEntryResponse>(
      `/api/user/auth/entry?turnstile=${turnstile}`,
      {
        // Email for normal accounts, username for the root-only sign-in path.
        ...(payload.username
          ? { username: payload.username }
          : { email: payload.email }),
        agree_legal: payload.agreeLegal,
        ...passwordFields,
      },
      { skipAuthRefresh: true }
    )
    if (payload.passwordEncryptionEnabled && !res.data?.success) {
      clearPasswordEncryptionCache()
    }
    return res.data
  } catch (error: unknown) {
    if (payload.passwordEncryptionEnabled) {
      clearPasswordEncryptionCache()
    }
    throw error
  }
}

// Trade a mailed link for an account: the token is single use.
export async function verifyEmailLink(
  token: string
): Promise<AuthEntryResponse> {
  const res = await api.post<AuthEntryResponse>(
    '/api/user/auth/verify-email',
    { token },
    { skipAuthRefresh: true }
  )
  return res.data
}

// Ask for a new link. The server answers the same way whether or not a pending
// signup exists, so this cannot be used to probe for accounts.
export async function resendVerificationLink(
  email: string
): Promise<ApiResponse> {
  const res = await api.post(
    '/api/user/auth/resend-verification',
    { email },
    { skipAuthRefresh: true }
  )
  return res.data
}

interface LogoutRuntime {
  getExpectedSID: () => string | undefined
  request: (expectedSID?: string) => Promise<ApiResponse>
  refresh: () => Promise<RefreshOutcome>
}

export async function executeLogout(
  runtime: LogoutRuntime,
  allowMismatchRecovery = true
): Promise<ApiResponse> {
  try {
    return await runtime.request(runtime.getExpectedSID())
  } catch (error: unknown) {
    const code = axios.isAxiosError(error)
      ? error.response?.data?.code
      : undefined
    if (
      allowMismatchRecovery &&
      axios.isAxiosError(error) &&
      error.response?.status === 409 &&
      code === 'AUTH_SESSION_MISMATCH'
    ) {
      const outcome = await runtime.refresh()
      if (outcome.kind === 'authenticated') {
        return executeLogout(runtime, false)
      }
      if (outcome.kind === 'anonymous') {
        return { success: true, message: '' }
      }
    }
    throw error
  }
}

// User logout
export async function logout(): Promise<ApiResponse> {
  return executeLogout({
    getExpectedSID: () => useAuthStore.getState().auth.session?.sid,
    request: async (sid) => {
      const res = await api.post('/api/user/auth/logout', undefined, {
        headers: sid ? { 'X-Auth-Session': sid } : undefined,
        skipAuthRefresh: true,
        skipErrorHandler: true,
      })
      return res.data
    },
    refresh: refreshAuthentication,
  })
}

// ----------------------------------------------------------------------------
// Password Management
// ----------------------------------------------------------------------------

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  turnstile?: string
): Promise<ApiResponse> {
  const res = await api.get('/api/reset_password', {
    params: { email, turnstile },
  })
  return res.data
}

// ----------------------------------------------------------------------------
// Registration
// ----------------------------------------------------------------------------

// Confirm an authenticated, server-owned email binding flow.
export async function bindEmail(
  flowToken: string,
  newCode: string,
  oldCode = '',
  signal?: AbortSignal
): Promise<ApiResponse> {
  const res = await api.post(
    '/api/user/email/bind',
    {
      flow_token: flowToken,
      new_code: newCode,
      old_code: oldCode,
    },
    { singleUseAuthorization: true, signal }
  )
  return res.data
}
