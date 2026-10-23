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
import { describe, expect, test } from 'vitest'

import {
  buildAuthDialogClosedHref,
  buildAuthDialogHref,
  parseAuthDialogState,
} from '../auth-dialog'

describe('auth dialog URL state', () => {
  test('treats a missing auth parameter as closed and keeps the default pane', () => {
    expect(parseAuthDialogState('')).toEqual({ open: false, mode: 'sign-in' })
    expect(parseAuthDialogState('?redirect=%2Fdashboard')).toEqual({
      open: false,
      mode: 'sign-in',
    })
  })

  test('reads the open pane and the requested destination from the query', () => {
    expect(parseAuthDialogState('?auth=signin')).toEqual({
      open: true,
      mode: 'sign-in',
      redirectTo: undefined,
    })
    expect(parseAuthDialogState('?auth=signup&redirect=%2Fdashboard')).toEqual({
      open: true,
      mode: 'sign-up',
      redirectTo: '/dashboard',
    })
    expect(parseAuthDialogState('?auth=forgot')).toEqual({
      open: true,
      mode: 'forgot-password',
      redirectTo: undefined,
    })
  })

  test('ignores an unknown auth value instead of opening the dialog', () => {
    expect(parseAuthDialogState('?auth=verify')).toEqual({
      open: false,
      mode: 'sign-in',
    })
  })

  test('opening preserves unrelated query parameters', () => {
    expect(buildAuthDialogHref('/', '', 'sign-in')).toBe('/?auth=signin')
    expect(buildAuthDialogHref('/', '?foo=1', 'sign-up')).toBe(
      '/?foo=1&auth=signup'
    )
    expect(buildAuthDialogHref('/', '', 'forgot-password')).toBe(
      '/?auth=forgot'
    )
  })

  test('closing drops the auth parameter and the stale destination', () => {
    expect(buildAuthDialogClosedHref('/', '?auth=signin')).toBe('/')
    expect(
      buildAuthDialogClosedHref('/', '?auth=signin&redirect=%2Fdashboard')
    ).toBe('/')
    expect(buildAuthDialogClosedHref('/', '?foo=1&auth=forgot')).toBe('/?foo=1')
  })

  test('a built href round-trips back through the parser', () => {
    const href = buildAuthDialogHref('/', '?redirect=%2Fkeys', 'sign-up')
    expect(href).toBe('/?redirect=%2Fkeys&auth=signup')
    expect(parseAuthDialogState(href.slice(href.indexOf('?')))).toEqual({
      open: true,
      mode: 'sign-up',
      redirectTo: '/keys',
    })
  })
})
