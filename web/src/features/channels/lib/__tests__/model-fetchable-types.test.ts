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

import { MODEL_FETCHABLE_TYPES, RETAINED_CHANNEL_TYPES } from '../../constants'

describe('model-fetchable channel types', () => {
  // Every retained channel type must expose the upstream model discovery
  // entry points (drawer section, row action, table action). A type missing
  // from the set silently forces operators to type model names by hand.
  test('every retained channel type can fetch its upstream model list', () => {
    const missing = RETAINED_CHANNEL_TYPES.filter(
      (channelType) => !MODEL_FETCHABLE_TYPES.has(channelType)
    )
    expect(missing).toEqual([])
  })

  // Volcano Ark (type 45) serves the OpenAI protocol under /api/v3; the
  // backend reuses the adaptor URL rule for discovery, so the type only
  // needs to be listed here for the UI to offer fetching.
  test('VolcEngine channels can fetch their upstream model list', () => {
    expect(MODEL_FETCHABLE_TYPES.has(45)).toBe(true)
  })
})
