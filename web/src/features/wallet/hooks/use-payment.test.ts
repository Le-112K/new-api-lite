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

import { requestPaymentAmount } from './use-payment'

describe('payment amount calculation', () => {
  test('uses the regular amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(120, 'alipay', {
      regular: async (request) => {
        calls.push(`regular:${request.amount}`)
        return { success: true, data: '18.75' }
      },
    })

    expect(amount).toBe(18.75)
    expect(calls).toEqual(['regular:120'])
  })

  test('returns zero when the calculator reports a failure', async () => {
    const amount = await requestPaymentAmount(120, 'alipay', {
      regular: async () => ({ success: false, data: '1' }),
    })

    expect(amount).toBe(0)
  })
})
