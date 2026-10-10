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
import { api } from '@/lib/api'
import { buildOAuthAuthorizationUrl } from '@/lib/oauth'
import {
  AuthOperationError,
  authRequestOptions,
  authResult,
} from '@/lib/secure-verification'

import { createOAuthAuthorization } from '../api'
import { openOAuthPopup } from '../lib/oauth-popup'
import { encryptPassword } from '../lib/password-encryption'
import type { SystemStatus } from '../types'
import type {
  SecurityProof,
  SecurityProofScope,
  VerificationInput,
  VerificationOperation,
  VerificationRequirements,
} from './types'

export async function checkVerificationMethods(
  scope: SecurityProofScope,
  signal?: AbortSignal
): Promise<VerificationRequirements> {
  return await authResult<VerificationRequirements>(
    api.get('/api/verify/methods', {
      ...authRequestOptions,
      params: { scope },
      signal,
      disableDuplicate: true,
    })
  )
}

export async function verify(
  input: VerificationInput,
  operation: VerificationOperation,
  passwordEncryptionEnabled: boolean,
  signal: AbortSignal
): Promise<SecurityProof> {
  try {
    const operationFields = {
      scope: operation.scope,
      ...(operation.context ? { context: operation.context } : {}),
    }
    let proof: SecurityProof
    switch (input.method) {
      case 'session':
        proof = await authResult<SecurityProof>(
          api.post(
            '/api/verify',
            { method: 'session', ...operationFields },
            {
              ...authRequestOptions,
              signal,
            }
          )
        )
        break
      case 'password': {
        const passwordFields = passwordEncryptionEnabled
          ? await encryptPassword(input.password)
          : { password: input.password }
        signal.throwIfAborted()
        proof = await authResult<SecurityProof>(
          api.post(
            '/api/verify',
            { method: input.method, ...operationFields, ...passwordFields },
            { ...authRequestOptions, signal }
          )
        )
        break
      }
      case 'oauth':
        proof = await verifyOAuth(input.provider, operation, signal)
        break
    }
    signal.throwIfAborted()
    if (
      !proof.proof_token ||
      proof.scope !== operation.scope ||
      proof.method !== input.method ||
      proof.expires_at * 1000 <= Date.now()
    ) {
      throw new AuthOperationError('Verification proof was not returned')
    }
    return proof
  } catch (error) {
    throw AuthOperationError.from(error)
  }
}

async function verifyOAuth(
  provider: string,
  operation: VerificationOperation,
  signal: AbortSignal
): Promise<SecurityProof> {
  const exchange = await openOAuthPopup({
    provider,
    intent: 'verify',
    signal,
    prepare: async (popupSignal) => {
      const [authorization, status] = await Promise.all([
        createOAuthAuthorization(provider, 'verify', operation, popupSignal),
        authResult<SystemStatus>(
          api.get('/api/status', {
            ...authRequestOptions,
            signal: popupSignal,
            disableDuplicate: true,
          })
        ),
      ])
      return {
        state: authorization.state,
        url:
          authorization.authorizationUrl ??
          buildOAuthAuthorizationUrl(provider, authorization.state, status),
      }
    },
  })
  try {
    const callback = exchange.callback
    const proof = await authResult<SecurityProof>(
      api.get(`/api/oauth/${provider}`, {
        ...authRequestOptions,
        singleUseAuthorization: true,
        disableDuplicate: true,
        signal: exchange.signal,
        params: {
          state: callback.state,
          code: callback.code,
          error: callback.error,
          error_description: callback.errorDescription,
        },
      })
    )
    exchange.signal.throwIfAborted()
    exchange.finish({ success: true })
    return proof
  } catch (error) {
    const failure = AuthOperationError.from(
      exchange.signal.aborted ? exchange.signal.reason : error
    )
    exchange.finish({ success: false, message: failure.message })
    throw failure
  }
}
