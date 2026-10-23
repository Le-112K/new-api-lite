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
import { Languages, Check, ChevronDown } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

/** 落地页导航上的短标签，和参考站一样只显示语言代码 */
const SHORT_LABELS: Record<string, string> = { en: 'EN', zhCN: '中文' }

export function LanguageSwitcher(props: { variant?: 'default' | 'landing' }) {
  const { i18n, t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const currentLanguage = normalizeInterfaceLanguage(i18n.language)
  const handleChangeLanguage = useCallback(
    async (code: string) => {
      await i18n.changeLanguage(code)
      if (user) {
        try {
          await api.put('/api/user/self', { language: code })
        } catch {
          // Best-effort persistence; don't block the UI on failure
        }
      }
    },
    [i18n, user]
  )

  return (
    <DropdownMenu modal={false}>
      {props.variant === 'landing' ? (
        <DropdownMenuTrigger
          render={
            <Button
              variant='outline'
              data-shape='pill'
              className='h-9 gap-1 rounded-full border-black/[0.11] bg-transparent px-3 text-[13px] font-semibold text-foreground hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]'
            />
          }
        >
          {SHORT_LABELS[currentLanguage] ?? currentLanguage.toUpperCase()}
          <ChevronDown className='size-3.5 opacity-50' />
          <span className='sr-only'>{t('Change language')}</span>
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={<Button variant='ghost' size='icon' className='h-9 w-9' />}
        >
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>{t('Change language')}</span>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align='end'>
        {INTERFACE_LANGUAGE_OPTIONS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLanguage(lang.code)}
          >
            {lang.label}
            <Check
              size={14}
              className={cn(
                'ms-auto',
                currentLanguage !== lang.code && 'hidden'
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
