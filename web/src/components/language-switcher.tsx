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
import { Languages } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

/** 落地页导航上的短标签，和参考站一样只显示语言代码 */
const SHORT_LABELS: Record<string, string> = { en: 'EN', zhCN: '中文' }

/**
 * 语言切换。
 *
 * 全站只有中英两套，下拉菜单是多余的一步：点一下就该切过去。按钮显示**当前**
 * 语言，点击切到另一种。切换后按钮标签与页面文案一起更新——它们都读
 * `i18n.language`，由 `useTranslation` 订阅 languageChanged 触发重渲染。
 */
export function LanguageSwitcher(props: { variant?: 'default' | 'landing' }) {
  const { i18n, t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const currentLanguage = normalizeInterfaceLanguage(i18n.language)
  const nextLanguage = currentLanguage === 'zhCN' ? 'en' : 'zhCN'
  const nextLabel =
    INTERFACE_LANGUAGE_OPTIONS.find((lang) => lang.code === nextLanguage)
      ?.label ?? nextLanguage

  const handleToggleLanguage = useCallback(async () => {
    await i18n.changeLanguage(nextLanguage)
    // 登录用户的语言偏好写到服务端，换设备登录也能延续。
    if (user) {
      try {
        await api.put('/api/user/self', { language: nextLanguage })
      } catch {
        // 尽力而为：持久化失败不该阻断切换本身
      }
    }
  }, [i18n, nextLanguage, user])

  if (props.variant === 'landing') {
    return (
      <Button
        variant='outline'
        data-shape='pill'
        onClick={handleToggleLanguage}
        aria-label={`${t('Change language')}: ${nextLabel}`}
        title={`${t('Change language')}: ${nextLabel}`}
        className='text-foreground h-9 gap-1.5 rounded-full border-black/[0.11] bg-transparent px-3 text-[13px] font-semibold hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]'
      >
        <Languages className='size-3.5 opacity-60' />
        {SHORT_LABELS[currentLanguage] ?? currentLanguage.toUpperCase()}
      </Button>
    )
  }

  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={handleToggleLanguage}
      aria-label={`${t('Change language')}: ${nextLabel}`}
      title={`${t('Change language')}: ${nextLabel}`}
      className='h-9 w-9'
    >
      <Languages className='size-[1.2rem]' />
    </Button>
  )
}
