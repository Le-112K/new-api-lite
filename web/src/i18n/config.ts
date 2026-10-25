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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'

// Locales load through a backend instead of inline `resources`: en.json and
// zh.json together are over half a megabyte of JSON and used to make up more
// than half of the entry chunk, on the critical path of every visitor. The
// dynamic import below turns each locale into its own async chunk, fetched in
// parallel with the other initial chunks; main.tsx gates the first render on
// `i18nReady` so components never mount with raw keys.
const lazyLocaleBackend = {
  type: 'backend' as const,
  init() {},
  read(
    language: string,
    _namespace: string,
    callback: (err: unknown, data?: unknown) => void
  ) {
    void (async () => {
      const file = language === 'zhCN' ? 'zh' : 'en'
      try {
        const module = await import(`./locales/${file}.json`)
        callback(null, module.default)
      } catch (error) {
        callback(error)
      }
    })()
  },
}

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(lazyLocaleBackend)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'zhCN'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Only two locales are bundled. Browsers report `zh-CN`/`zh-TW`/`zh`, all
      // of which map onto `zhCN`; every other code passes through and is then
      // rejected by `supportedLngs`, so it falls back to English.
      convertDetectedLanguage,
    },
  })

export default i18n
