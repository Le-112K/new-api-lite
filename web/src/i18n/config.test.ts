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
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'

import { lazyLocaleBackend } from './config'

function readNamespace(
  language: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    lazyLocaleBackend.read(language, 'translation', (err, data) => {
      if (err) reject(err as Error)
      else resolve(data as Record<string, unknown>)
    })
  })
}

describe('lazy locale backend', () => {
  it('returns the namespace map, not the translation-wrapped file', async () => {
    for (const language of ['en', 'zhCN'] as const) {
      const data = await readNamespace(language)
      // The locale JSON files are `{ translation: { ... } }`. i18next stores
      // the backend's return value as the namespace value, so returning the
      // wrapper would make every lookup miss and fall back to the raw key.
      expect(data).not.toHaveProperty('translation')
      expect(typeof data['Password Login']).toBe('string')
    }
  })

  it('serves the Chinese strings for zhCN and English for en', async () => {
    const zh = await readNamespace('zhCN')
    const en = await readNamespace('en')
    expect(zh['Password Login']).toBe('密码登录')
    expect(en['Password Login']).toBe('Password Login')
    // Keys are English source strings, so a failed lookup silently looks like
    // correct English — assert a value that differs from its key.
    expect(zh['Password Login']).not.toBe('Password Login')
  })
})

describe('i18n with the lazy backend', () => {
  it('translates after switching languages', async () => {
    const instance = i18next.createInstance()
    await instance.use(lazyLocaleBackend).init({
      lng: 'en',
      fallbackLng: 'en',
      supportedLngs: ['en', 'zhCN'],
      load: 'currentOnly',
      nsSeparator: false,
      interpolation: { escapeValue: false },
    })

    expect(instance.t('Password Login')).toBe('Password Login')

    await instance.changeLanguage('zhCN')
    expect(instance.t('Password Login')).toBe('密码登录')

    await instance.changeLanguage('en')
    expect(instance.t('Password Login')).toBe('Password Login')
  })
})
