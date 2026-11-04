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
import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'
import { Input } from './ui/input'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
}

/**
 * 带「显示/隐藏密码」的输入框。
 *
 * 三个容易踩的点，都在这里一次性处理掉：
 * 1. 图标语义：图标描述「点一下会发生什么」。密码隐藏时给睁眼（点是显示），
 *    显示时给划线眼。反过来的话，用户看到的是「已经隐藏」的图标，却以为
 *    点了才会隐藏，状态和预期永远差一步。
 * 2. 点击不失焦：按钮按下会抢走输入框焦点，光标位置也一起丢。这里在
 *    onMouseDown 阶段阻止默认行为，焦点留在输入框内。
 * 3. 切换后光标不乱跳：input 的 type 从 password 变 text 时浏览器会把光标
 *    甩到末尾。切换前记下选区，切换后还原。
 *
 * 另外给输入框留出右侧内边距，否则长密码会钻到图标底下。
 */
export function PasswordInput({
  className,
  disabled,
  ref,
  ...props
}: PasswordInputProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const caretRef = React.useRef<[number, number] | null>(null)

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ;(ref as React.RefObject<HTMLInputElement | null>).current = node
      }
    },
    [ref]
  )

  const toggleVisibility = () => {
    const input = inputRef.current
    if (input) {
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? start
      caretRef.current = [start, end]
    }
    setShowPassword((prev) => !prev)
  }

  React.useLayoutEffect(() => {
    const input = inputRef.current
    const caret = caretRef.current
    if (!input || !caret) return
    caretRef.current = null
    input.focus()
    try {
      input.setSelectionRange(caret[0], caret[1])
    } catch {
      // 个别浏览器不允许对 password 类型设置选区，忽略即可，值本身不受影响
    }
  }, [showPassword])

  return (
    <div className={cn('relative rounded-md', className)}>
      <Input
        type={showPassword ? 'text' : 'password'}
        ref={setInputRef}
        disabled={disabled}
        className='pe-11'
        {...props}
      />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleVisibility}
        aria-label={showPassword ? t('Hide password') : t('Show password')}
        aria-pressed={showPassword}
        className='text-muted-foreground hover:text-foreground absolute end-1 top-1/2 size-8 -translate-y-1/2 rounded-md'
      >
        {showPassword ? (
          <EyeOff size={16} aria-hidden='true' />
        ) : (
          <Eye size={16} aria-hidden='true' />
        )}
      </Button>
    </div>
  )
}
