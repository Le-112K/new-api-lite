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
import { describe, expect, it } from 'vitest'

import { buildPricingChanges, type ModelPricingConfig } from '../api'
import {
  applyPricingDraft,
  pricingFromDraft,
  pricingOptions,
  pricingRow,
} from '../pricing'

describe('shared model pricing', () => {
  it('keeps an explicit zero price and drops an empty one', () => {
    expect(pricingFromDraft({ name: 'example', price: '' })).toEqual({})
    expect(pricingFromDraft({ name: 'example', price: '0' })).toEqual({
      ModelPrice: 0,
    })
    expect(pricingFromDraft({ name: 'example', price: '0.25' })).toEqual({
      ModelPrice: 0.25,
    })
  })

  it('round-trips a fixed price without inventing token ratios', () => {
    const values = pricingFromDraft(pricingRow('example', { ModelPrice: 0.4 }))
    expect(values).toEqual({ ModelPrice: 0.4 })
    expect(pricingRow('example', values)).toMatchObject({
      name: 'example',
      price: '0.4',
    })
  })

  it('does not persist another model’s configured price when editing one model', () => {
    const options = pricingOptions({
      ModelPrice: '{"edited":1,"other":9}',
    })
    const snapshot: ModelPricingConfig = {
      options,
      empty_version: 'empty',
      entries: [
        {
          model_name: 'edited',
          version: 'v1',
          configured: { ModelPrice: 1 },
          effective: { ModelPrice: 1 },
        },
        {
          model_name: 'other',
          version: 'v1',
          configured: { ModelPrice: 9 },
          effective: { ModelPrice: 9 },
        },
      ],
    }
    const after = applyPricingDraft(options, {
      name: 'edited',
      price: '2',
    })
    expect(buildPricingChanges(snapshot, options, after)).toEqual([
      {
        model_name: 'edited',
        expected_version: 'v1',
        pricing: { ModelPrice: 2 },
      },
    ])
  })

  it('applies one draft to several targets while keeping untouched prices', () => {
    const options = pricingOptions({
      ModelPrice: '{"source":1,"target":5,"untouched":7}',
    })
    const after = applyPricingDraft(options, { name: 'source', price: '3' }, [
      'source',
      'target',
    ])
    expect(JSON.parse(after.ModelPrice)).toEqual({
      source: 3,
      target: 3,
      untouched: 7,
    })
  })

  it('rejects invalid prices instead of silently coercing them', () => {
    for (const price of ['-1', 'NaN', 'Infinity', 'invalid']) {
      expect(() => pricingFromDraft({ name: 'example', price })).toThrow()
    }
  })
})
