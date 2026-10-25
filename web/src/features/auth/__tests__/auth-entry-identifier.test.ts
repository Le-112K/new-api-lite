import { describe, expect, it } from 'vitest'

import { authEntryFormSchema } from '../constants'

describe('auth entry identifier', () => {
  it('accepts a plain email', () => {
    const result = authEntryFormSchema.safeParse({
      email: 'alice@example.com',
      password: 'secret',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a bare identifier for the root-only username path', () => {
    const result = authEntryFormSchema.safeParse({
      email: 'admin',
      password: 'secret',
    })
    expect(result.success).toBe(true)
  })

  it('still rejects a malformed email', () => {
    const result = authEntryFormSchema.safeParse({
      email: 'alice@',
      password: 'secret',
    })
    expect(result.success).toBe(false)
  })
})
