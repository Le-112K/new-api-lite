import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PasswordInput } from '../password-input'

function setup() {
  render(<PasswordInput aria-label='password' defaultValue='Test@2026' />)
  return {
    input: screen.getByLabelText('password') as HTMLInputElement,
    toggle: screen.getByRole('button'),
  }
}

describe('PasswordInput 显示/隐藏切换', () => {
  it('默认以密文呈现，图标表示“点一下会显示”', () => {
    const { input, toggle } = setup()

    expect(input).toHaveAttribute('type', 'password')
    // 图标语义跟着“点击后的动作”走：隐藏时按钮说“显示密码”
    expect(toggle).toHaveAccessibleName('Show password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('点击后切换为明文，内容不丢、焦点不跑', async () => {
    const { input, toggle } = setup()
    input.focus()

    await userEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    expect(input.value).toBe('Test@2026')
    // 点按钮不该把焦点从输入框抢走，否则用户要继续输入时得再点一次
    expect(document.activeElement).toBe(input)
    expect(toggle).toHaveAccessibleName('Hide password')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('再点一次回到密文，且光标停在原位置', async () => {
    const { input, toggle } = setup()

    await userEvent.click(toggle)
    input.focus()
    input.setSelectionRange(3, 3)
    await userEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'password')
    expect(input.value).toBe('Test@2026')
    expect(input.selectionStart).toBe(3)
    expect(input.selectionEnd).toBe(3)
  })
})
