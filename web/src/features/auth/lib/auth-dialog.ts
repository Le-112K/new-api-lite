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
/**
 * URL contract for the auth dialog.
 *
 * The dialog's open state lives in the query string (`?auth=signin&redirect=…`)
 * rather than a global store: the URL survives a reload, is shareable, and keeps
 * the back button honest. That is also why the tab is part of the same param —
 * `auth` names both "is it open" and "which pane".
 */
export type AuthDialogMode = 'sign-in' | 'sign-up' | 'forgot-password'

export type AuthDialogState = {
  open: boolean
  mode: AuthDialogMode
  redirectTo?: string
}

const AUTH_PARAM = 'auth'
const REDIRECT_PARAM = 'redirect'

const MODE_TO_PARAM: Record<AuthDialogMode, string> = {
  'sign-in': 'signin',
  'sign-up': 'signup',
  'forgot-password': 'forgot',
}

const PARAM_TO_MODE: Record<string, AuthDialogMode> = {
  signin: 'sign-in',
  signup: 'sign-up',
  forgot: 'forgot-password',
}

export function parseAuthDialogState(search: string): AuthDialogState {
  // URLSearchParams tolerates a leading '?' and an empty string, so both the
  // router's `?a=1` form and a bare query string are accepted.
  const params = new URLSearchParams(search)
  const mode = PARAM_TO_MODE[params.get(AUTH_PARAM) ?? '']
  if (!mode) {
    return { open: false, mode: 'sign-in' }
  }
  const redirectTo = (params.get(REDIRECT_PARAM) ?? '').trim()
  return { open: true, mode, redirectTo: redirectTo || undefined }
}

export function buildAuthDialogHref(
  pathname: string,
  search: string,
  mode: AuthDialogMode
): string {
  const params = new URLSearchParams(search)
  params.set(AUTH_PARAM, MODE_TO_PARAM[mode])
  return withQuery(pathname, params)
}

export function buildAuthDialogClosedHref(
  pathname: string,
  search: string
): string {
  const params = new URLSearchParams(search)
  params.delete(AUTH_PARAM)
  // `redirect` only means something while the dialog is open; leaving it behind
  // litters the URL after close and makes a later open look like it came from
  // a different page.
  params.delete(REDIRECT_PARAM)
  return withQuery(pathname, params)
}

function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
