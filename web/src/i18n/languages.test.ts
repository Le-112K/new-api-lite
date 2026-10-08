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

import { convertDetectedLanguage } from './languages'

describe('convertDetectedLanguage', () => {
  test('maps every Chinese variant onto the single bundled locale', () => {
    // Only `zhCN` is bundled, so Traditional-Chinese tags that `supportedLngs`
    // would otherwise reject must resolve to Simplified rather than English.
    expect(convertDetectedLanguage('zh-TW')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-HK')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-MO')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-Hant-TW')).toBe('zhCN')
    expect(convertDetectedLanguage('zh')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-CN')).toBe('zhCN')
    expect(convertDetectedLanguage('zh-Hans')).toBe('zhCN')
  })

  test('keeps already-normalized interface codes stable (localStorage round-trip)', () => {
    // i18next caches the resolved code to localStorage, and the detector runs
    // this converter on the cached value at every page load — if `zhCN` does not
    // survive the round-trip, a user who picked Chinese is flipped to English on
    // the next load and the cache is overwritten, making the flip permanent.
    expect(convertDetectedLanguage('zhCN')).toBe('zhCN')
    // `zhTW` was a supported code before Traditional Chinese was dropped, so a
    // pre-existing cache entry must land on `zhCN` too.
    expect(convertDetectedLanguage('zhTW')).toBe('zhCN')
  })

  test('passes non-Chinese values through unchanged', () => {
    // These are handed back untouched; i18next's own `supportedLngs` matching
    // rejects anything that is not `en`, which is what produces the fallback.
    expect(convertDetectedLanguage('en')).toBe('en')
    expect(convertDetectedLanguage('fr-FR')).toBe('fr-FR')
    expect(convertDetectedLanguage('ja')).toBe('ja')
  })
})
