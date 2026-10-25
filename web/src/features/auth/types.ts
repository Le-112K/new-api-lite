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
import type { LoginResult } from './secure-verification/types'

// ============================================================================
// API Payloads
// ============================================================================

/**
 * The one payload the unified entry accepts. The server decides what it means:
 * a known address is a sign-in, an unknown one starts a verified signup.
 */
export interface AuthEntryPayload {
  /** Normal accounts sign in with their email. */
  email?: string
  /** Super administrators sign in with their username instead. */
  username?: string
  password: string
  /** Required by the server on the signup branch only. */
  agreeLegal: boolean
  turnstile?: string
  passwordEncryptionEnabled?: boolean
}

export type AuthEntryAction = 'login' | 'verify_email'

/** Returned when the submission was a signup and a link is on its way. */
export interface AuthEntryPendingResult {
  action: 'verify_email'
  email: string
}

export type AuthEntryResult = LoginResult | AuthEntryPendingResult

export interface AuthEntryResponse {
  success: boolean
  message: string
  data?: AuthEntryResult
}

export interface PasswordResetPayload {
  email: string
  turnstile?: string
}

export interface BindEmailPayload {
  flow_token: string
  new_code: string
  old_code?: string
}

// ============================================================================
// API Responses
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

// ============================================================================
// System Status
// ============================================================================

export interface SystemStatus {
  success?: boolean
  message?: string
  data?: {
    version?: string
    system_name?: string
    logo?: string
    turnstile_check?: boolean
    turnstile_site_key?: string
    display_in_currency?: boolean
    display_token_stat_enabled?: boolean
    quota_per_unit?: number
    quota_display_type?: string
    usd_exchange_rate?: number
    custom_currency_symbol?: string
    custom_currency_exchange_rate?: number
    user_agreement_enabled?: boolean
    privacy_policy_enabled?: boolean
    register_enabled?: boolean
    password_login_enabled?: boolean
    password_login_encryption_enabled?: boolean
    password_register_enabled?: boolean
    [key: string]: unknown
  }
  // Allow direct access to common properties
  version?: string
  system_name?: string
  logo?: string
  turnstile_check?: boolean
  turnstile_site_key?: string
  display_in_currency?: boolean
  display_token_stat_enabled?: boolean
  quota_per_unit?: number
  quota_display_type?: string
  usd_exchange_rate?: number
  custom_currency_symbol?: string
  custom_currency_exchange_rate?: number
  user_agreement_enabled?: boolean
  privacy_policy_enabled?: boolean
  register_enabled?: boolean
  password_login_enabled?: boolean
  password_login_encryption_enabled?: boolean
  password_register_enabled?: boolean
  [key: string]: unknown
}

// ============================================================================
// Form Props
// ============================================================================

export interface AuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}
