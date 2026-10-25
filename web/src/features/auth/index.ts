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
// ============================================================================
// API Functions
// ============================================================================

export {
  authEntry,
  verifyEmailLink,
  resendVerificationLink,
  logout,
  sendPasswordResetEmail,
  bindEmail,
} from './api'

// ============================================================================
// Types
// ============================================================================

export type {
  AuthEntryPayload,
  AuthEntryResponse,
  AuthEntryResult,
  PasswordResetPayload,
  BindEmailPayload,
  ApiResponse,
  SystemStatus,
  AuthFormProps,
} from './types'

// ============================================================================
// Constants & Schemas
// ============================================================================

export {
  authEntryFormSchema,
  forgotPasswordFormSchema,
  otpFormSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  OTP_LENGTH,
  BACKUP_CODE_LENGTH,
  BACKUP_CODE_REGEX,
  OTP_REGEX,
  PASSWORD_RESET_COUNTDOWN,
} from './constants'

// ============================================================================
// Utilities
// ============================================================================


export {
  isValidOTP,
  isValidBackupCode,
  formatBackupCode,
  cleanBackupCode,
  isValidEmail,
} from './lib/validation'

// ============================================================================
// Hooks
// ============================================================================

export { useTurnstile } from './hooks/use-turnstile'
export { useAuthRedirect } from './hooks/use-auth-redirect'

// ============================================================================
// Components
// ============================================================================

export { AuthLayout } from './auth-layout'
export { TermsFooter } from './components/terms-footer'
export { LegalConsent } from './components/legal-consent'
