import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SignOutDialog } from '@/components/sign-out-dialog'
import { Button } from '@/components/ui/button'

/**
 * 顶部右上角的退出登录入口。
 *
 * 取代了原来的头像下拉：账号相关入口（个人资料 / 安全与访问 / 钱包）已经在
 * 左侧栏里，头像菜单属于重复入口，这里只保留最高频的那一个动作。
 *
 * 交互：
 *   - hover：图标从 muted 变 foreground，并浮现统一的 ghost 背景块
 *   - 点击：先弹确认框（沿用 SignOutDialog），避免误触直接掉线
 *   - 确认中：按钮禁用，图标换成脉动样式，防止重复提交
 */
export function SignOutButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        disabled={pending}
        onClick={() => setOpen(true)}
        aria-label={t('Sign out')}
        title={t('Sign out')}
        className='text-muted-foreground hover:text-foreground size-9 rounded-lg disabled:opacity-40'
      >
        <LogOut
          className={
            pending ? 'size-[18px] animate-pulse' : 'size-[18px]'
          }
        />
      </Button>
      <SignOutDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setPending(false)
        }}
        onPendingChange={setPending}
      />
    </>
  )
}
