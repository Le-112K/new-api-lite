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
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { ChangePasswordDialog } from '../components/dialogs/change-password-dialog'
import { DeleteAccountDialog } from '../components/dialogs/delete-account-dialog'
import { EmailBindDialog } from '../components/dialogs/email-bind-dialog'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

let client: QueryClient
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {})
})

afterEach(() => {
  cleanup()
  client.clear()
  navigate.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset('idle')
})

it('requires verification after username confirmation and cancels without deleting the account', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.delete',
        methods: [{ method: 'password', available: true }],
        oauth_providers: [],
        password_encryption_enabled: false,
      },
    },
  })
  const remove = vi.spyOn(api, 'delete').mockResolvedValue({
    data: { success: true, data: {} },
  })
  const user = userEvent.setup()
  render(<DeleteAccountDialog open username='user' onOpenChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Delete Account' })).toBeDisabled()
  await user.type(screen.getByRole('textbox'), 'user')
  await user.click(screen.getByRole('button', { name: 'Delete Account' }))
  expect(
    await screen.findByLabelText('Password', { selector: 'input' })
  ).toBeVisible()
  expect(remove).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeVisible()
  )
  expect(remove).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
})

it('allows a common new password after verifying the current password once', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.password.change',
        methods: [{ method: 'password', available: true }],
        oauth_providers: [],
        password_encryption_enabled: false,
      },
    },
  })
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.password.change',
        method: 'password',
        proof_token: 'password-proof',
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    },
  })
  const put = vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: true, data: { has_password: true } },
  })
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(
    <ChangePasswordDialog open username='user' onOpenChange={onOpenChange} />
  )
  expect(screen.getByText('Use 8–128 characters.')).toBeVisible()
  await user.type(screen.getByLabelText('Current Password'), 'current-password')
  await user.type(screen.getByLabelText('New Password'), 'password123')
  await user.type(screen.getByLabelText('Confirm New Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Change Password' }))
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(get).toHaveBeenCalledWith(
    '/api/verify/methods',
    expect.objectContaining({ params: { scope: 'account.password.change' } })
  )
  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      method: 'password',
      password: 'current-password',
      scope: 'account.password.change',
    }),
    expect.anything()
  )
  expect(put).toHaveBeenCalledWith(
    '/api/user/self',
    expect.objectContaining({
      original_password: 'current-password',
      password: 'password123',
    }),
    expect.objectContaining({
      headers: { 'X-Security-Proof': 'password-proof' },
      singleUseAuthorization: true,
    })
  )
})

it.each(['unmount', 'account change'])(
  'aborts a pending password operation on %s without duplicate submission',
  async (reason) => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'first-user', role: 1 })
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          scope: 'account.password.change',
          methods: [{ method: 'password', available: true }],
          oauth_providers: [],
          password_encryption_enabled: false,
        },
      },
    })
    const proofResponse = {
      data: {
        success: true,
        data: {
          scope: 'account.password.change',
          method: 'password',
          proof_token: 'pending-proof',
          expires_at: Math.floor(Date.now() / 1000) + 60,
        },
      },
    }
    let resolveProof!: (response: typeof proofResponse) => void
    const pending = new Promise<typeof proofResponse>((resolve) => {
      resolveProof = resolve
    })
    const post = vi.spyOn(api, 'post').mockReturnValue(pending)
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true, data: {} } })
    const user = userEvent.setup()
    const view = render(
      <ChangePasswordDialog open username='user' onOpenChange={vi.fn()} />
    )
    await user.type(
      screen.getByLabelText('Current Password'),
      'current-password'
    )
    await user.type(
      screen.getByLabelText('New Password'),
      'account-password!42'
    )
    await user.type(
      screen.getByLabelText('Confirm New Password'),
      'account-password!42'
    )
    const submit = screen.getByRole('button', { name: 'Change Password' })
    await user.click(submit)
    await waitFor(() => expect(post).toHaveBeenCalledOnce())
    expect(submit).toBeDisabled()
    await user.dblClick(submit)
    if (reason === 'unmount') {
      view.unmount()
    } else {
      act(() =>
        useAuthStore
          .getState()
          .auth.setUser({ id: 2, username: 'second-user', role: 1 })
      )
      expect(screen.getByLabelText('Current Password')).toHaveValue('')
      expect(screen.getByLabelText('New Password')).toHaveValue('')
    }
    expect(post.mock.calls[0][2]?.signal?.aborted).toBe(true)
    await act(async () => {
      resolveProof(proofResponse)
    })
    expect(post).toHaveBeenCalledOnce()
    expect(put).not.toHaveBeenCalled()
  }
)

it('sets a first password after verifying an existing factor without asking for a current password', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.password.set',
        methods: [{ method: 'password', available: true }],
        oauth_providers: [],
        password_encryption_enabled: false,
      },
    },
  })
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.password.set',
        method: 'password',
        proof_token: 'first-password-proof',
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    },
  })
  const put = vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: true, data: { has_password: true } },
  })
  const user = userEvent.setup()
  render(
    <ChangePasswordDialog
      open
      username='user'
      hasPassword={false}
      onOpenChange={vi.fn()}
    />
  )
  expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument()
  await user.type(
    screen.getByLabelText('New Password'),
    'first-account-password!42'
  )
  await user.type(
    screen.getByLabelText('Confirm New Password'),
    'first-account-password!42'
  )
  await user.click(screen.getByRole('button', { name: 'Set Password' }))
  await user.type(
    await screen.findByLabelText('Password', {
      selector: 'input',
    }),
    '123456'
  )
  await user.click(screen.getByRole('button', { name: 'Verify' }))
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
  expect(post).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][1]).toEqual({
    password: 'first-account-password!42',
  })
})

it('confirms both email addresses after identity verification and freezes the submitted address', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        scope: 'account.binding.bind',
        methods: [{ method: 'password', available: true }],
        oauth_providers: [],
        password_encryption_enabled: false,
      },
    },
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/verify') {
      return {
        data: {
          success: true,
          data: {
            scope: 'account.binding.bind',
            method: 'password',
            proof_token: 'email-proof',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      }
    }
    if (url === '/api/oauth/email/bind/start') {
      return {
        data: {
          success: true,
          data: {
            flow_token: 'email-flow',
            email: 'new@example.com',
            current_email: 'o***@example.com',
            old_email_required: true,
            expires_at: Math.floor(Date.now() / 1000) + 600,
            resend_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      }
    }
    return { data: { success: true, data: {} } }
  })
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(
    <EmailBindDialog
      open
      currentEmail='old@example.com'
      onOpenChange={vi.fn()}
      onSuccess={onSuccess}
    />
  )
  await user.type(screen.getByLabelText('Email Address'), 'new@example.com')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await user.type(
    await screen.findByLabelText('Password', { selector: 'input' }),
    'current-password'
  )
  await user.click(screen.getByRole('button', { name: 'Verify' }))
  expect(await screen.findByLabelText('Email Address')).toBeDisabled()
  await user.type(
    await screen.findByLabelText('New email verification code'),
    '123456'
  )
  await user.type(
    screen.getByLabelText('Current email verification code'),
    '654321'
  )
  await user.click(screen.getByRole('button', { name: 'Confirm email' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  expect(post).toHaveBeenCalledWith(
    '/api/oauth/email/bind',
    { flow_token: 'email-flow', new_code: '123456', old_code: '654321' },
    expect.objectContaining({ singleUseAuthorization: true })
  )
})

it('translates the delete confirmation as a sentence and preserves the literal username on language change', async () => {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'zh',
    fallbackLng: false,
    nsSeparator: false,
    resources: { en, zh },
    interpolation: { escapeValue: false },
  })
  const username = 'admin <b>name</b>'
  render(
    <I18nextProvider i18n={i18n}>
      <DeleteAccountDialog open username={username} onOpenChange={vi.fn()} />
    </I18nextProvider>
  )
  expect(
    screen.getByRole('textbox', { name: `输入 ${username} 以确认` })
  ).toBeVisible()
  await act(() => i18n.changeLanguage('en'))
  expect(
    screen.getByRole('textbox', { name: `Type ${username} to confirm` })
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Delete Account' })).toBeDisabled()
})
