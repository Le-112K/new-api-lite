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
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthDialog } from '@/features/auth/components/auth-dialog'
import { buildAuthDialogHref } from '@/features/auth/lib/auth-dialog'
import { useNotifications } from '@/hooks/use-notifications'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'
import { BuilinLogotype } from '@/components/brand-mark'

const AUTH_PROMPT_SECONDS = 5

type AuthPromptTarget = {
  title: string
  href: string
}

export interface PublicHeaderProps {
  navLinks?: TopNavLink[]
  mobileLinks?: TopNavLink[]
  navContent?: React.ReactNode
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showNavigation?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  className?: string
  /**
   * `landing` 是落地页专用的扁平导航条：整条通栏、白底 80% + 12px 模糊、
   * 1px 下发丝线、链接 14px/500 内边距 8×12、圆角 6px。默认样式是控制台用的
   * 悬浮胶囊（滚动后收缩），两者共用同一套数据与交互，只换外框。
   */
  variant?: 'default' | 'landing'
}

export function PublicHeader(props: PublicHeaderProps) {
  const {
    navLinks = defaultTopNavLinks,
    showThemeSwitch = true,
    showLanguageSwitcher = true,
    logo: customLogo,
    siteName: customSiteName,
    homeUrl = '/',
    showAuthButtons = true,
    showNotifications = true,
  } = props

  const isLanding = props.variant === 'landing'

  const { t } = useTranslation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authPromptTarget, setAuthPromptTarget] =
    useState<AuthPromptTarget | null>(null)
  const [authPromptSecondsLeft, setAuthPromptSecondsLeft] =
    useState(AUTH_PROMPT_SECONDS)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const dynamicLinks = useTopNavLinks()
  const notifications = useNotifications()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const locationHref = routerState.location.href

  // Sign in opens the auth dialog in place: the pathname must not change, so we
  // only add `?auth=signin` to the current URL.
  const openAuthDialog = useCallback(() => {
    const url = new URL(locationHref, window.location.origin)
    navigate({
      href: buildAuthDialogHref(url.pathname, url.search, 'sign-in'),
    })
  }, [navigate, locationHref])

  const user = auth.user
  const isAuthenticated = !!user
  const displaySiteName = customSiteName || systemName
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  let logoContent: ReactNode = (
    <HeaderLogo
      src={systemLogo}
      loading={loading}
      logoLoaded={logoLoaded}
      className='size-full rounded-lg object-contain'
    />
  )
  if (customLogo) logoContent = customLogo
  if (loading) logoContent = <Skeleton className='size-full rounded-lg' />

  let authContent = (
    <Button
      size='sm'
      className={
        isLanding
          ? 'h-10 rounded-lg px-4 text-sm font-semibold'
          : 'h-8 rounded-lg px-3.5 text-xs font-medium'
      }
      onClick={openAuthDialog}
    >
      {t('Sign in')}
    </Button>
  )
  if (isAuthenticated) authContent = <ProfileDropdown />
  if (loading) authContent = <Skeleton className='h-8 w-20 rounded-lg' />

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!authPromptTarget) return

    const intervalId = window.setInterval(() => {
      setAuthPromptSecondsLeft((seconds) => Math.max(seconds - 1, 0))
    }, 1000)

    const timeoutId = window.setTimeout(() => {
      const redirect = authPromptTarget.href
      setAuthPromptTarget(null)
      navigate({ to: '/sign-in', search: { redirect } })
    }, AUTH_PROMPT_SECONDS * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [authPromptTarget, navigate])

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptTarget(null)
    setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
  }, [])

  const navigateToSignIn = useCallback(() => {
    const redirect = authPromptTarget?.href || '/'
    setAuthPromptTarget(null)
    navigate({ to: '/sign-in', search: { redirect } })
  }, [authPromptTarget?.href, navigate])

  const handleNavLinkClick = useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      link: TopNavLink,
      closeMobile = false
    ) => {
      if (link.disabled) {
        event.preventDefault()
        return
      }

      if (link.requiresAuth) {
        event.preventDefault()
        if (closeMobile) {
          setMobileOpen(false)
        }
        setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
        setAuthPromptTarget({
          title: t(link.title),
          href: link.href,
        })
        return
      }

      if (closeMobile) {
        setMobileOpen(false)
      }
    },
    [t]
  )

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50',
          isLanding
            ? 'border-b border-black/[0.06] bg-white/80 backdrop-blur-[12px] dark:border-white/10 dark:bg-[#0a0a0a]/80'
            : 'pointer-events-none'
        )}
      >
        <div
          className={cn(
            'mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            isLanding
              ? 'pointer-events-auto max-w-none px-6 md:px-12'
              : cn(
                  'pointer-events-auto',
                  scrolled ? 'max-w-[52rem] px-3 pt-3' : 'max-w-7xl px-4 pt-0 md:px-6'
                )
          )}
        >
          <nav
            className={cn(
              'flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
              isLanding
                ? 'h-16 gap-6'
                : cn(
                    'gap-2',
                    scrolled
                      ? 'bg-background/60 ring-border/50 h-12 rounded-2xl pr-1.5 pl-4 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.02)] ring-[0.5px] backdrop-blur-2xl dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,0.4)]'
                      : 'h-16 px-2'
                  )
            )}
          >
            {/* Logo */}
            {/* 落地页给品牌区固定宽度：设成 flex-none 会让容器查询把站名隐藏，
                而 flex-1 又会和链接组平分空间、把链接挤到右边。固定宽度两头都避开了。 */}
            <div
              className={cn(
                '@container/system-brand flex min-w-0 items-center gap-1',
                isLanding ? 'w-[220px] shrink-0' : 'flex-1 lg:min-w-36'
              )}
            >
              <Link
                to={homeUrl}
                className='group flex min-w-0 items-center gap-2.5'
              >
                {isLanding ? (
                  /* 品牌区是构造式几何字标（web/brand/IDENTITY.md），
                     名字即标识，不再叠一层文本字标；currentColor 随主题反色。 */
                  <BuilinLogotype className='h-[22px] w-auto shrink-0 text-foreground' />
                ) : (
                  <>
                    <div
                      className={cn(
                        'flex shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-105',
                        'size-7'
                      )}
                    >
                      {logoContent}
                    </div>
                    <span
                      className='max-w-48 truncate text-sm font-semibold tracking-tight'
                      title={displaySiteName}
                    >
                      {loading ? (
                        <Skeleton className='h-4 w-16' />
                      ) : (
                        displaySiteName
                      )}
                    </span>
                  </>
                )}
              </Link>
            </div>

            {/* Desktop nav */}
            <div
              className={cn(
                'hidden min-w-0 items-center lg:flex',
                isLanding ? 'flex-1 gap-2' : ''
              )}
            >
              {/* 落地页把「链接」与「图标+登录」拆成两段：链接在导航条里居中，
                  图标与按钮贴右，和参考站的分布一致。默认样式仍是一个整体。 */}
              <div
                className={cn(
                  'flex min-w-0 items-center',
                  isLanding ? 'flex-1 justify-center gap-1' : 'gap-0.5'
                )}
              >
              {links.map((link) => {
                const isActive = pathname === link.href
                if (link.external) {
                  return (
                    <a
                      key={`${link.title}:${link.href}`}
                      href={link.href}
                      title={t(link.title)}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-disabled={link.disabled}
                      tabIndex={link.disabled ? -1 : undefined}
                      onClick={(event) => handleNavLinkClick(event, link)}
                      className={cn(
                        'text-muted-foreground hover:text-foreground min-w-0 truncate text-sm font-medium transition-colors duration-200',
                        isLanding
                          ? 'rounded-md px-3 py-2'
                          : 'rounded-lg px-3 py-1.5',
                        link.disabled && 'pointer-events-none opacity-50'
                      )}
                    >
                      {t(link.title)}
                    </a>
                  )
                }
                return (
                  <Link
                    key={`${link.title}:${link.href}`}
                    to={link.href}
                    title={t(link.title)}
                    disabled={link.disabled}
                    onClick={(event) => handleNavLinkClick(event, link)}
                    className={cn(
                      'min-w-0 truncate text-sm font-medium transition-colors duration-200',
                      isLanding
                        ? 'rounded-md px-3 py-2'
                        : 'rounded-lg px-3 py-1.5',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      link.disabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    {t(link.title)}
                  </Link>
                )
              })}
              </div>

              {(showLanguageSwitcher ||
                showThemeSwitch ||
                showNotifications) &&
                !isLanding && (
                  <div className='bg-border/40 mx-2 h-4 w-px' />
                )}

              {showLanguageSwitcher && <LanguageSwitcher variant={props.variant} />}
              {showThemeSwitch && <ThemeSwitch variant={props.variant} />}
              {showNotifications && !isLanding && (
                <NotificationPopover
                  open={notifications.popoverOpen}
                  onOpenChange={notifications.setPopoverOpen}
                  unreadCount={notifications.unreadCount}
                  activeTab={notifications.activeTab}
                  onTabChange={notifications.setActiveTab}
                  notice={notifications.notice}
                  announcements={notifications.announcements}
                  loading={notifications.loading}
                />
              )}

              {showAuthButtons && (
                <>
                  {!isLanding && (
                    <div className='bg-border/40 mx-1 h-4 w-px' />
                  )}
                  {/* 参考站这一对是「纯文字 Sign in + 黑底 Get started」，
                      两者都通向登录；未登录时给两个入口，已登录仍走头像下拉。 */}
                  {isLanding && !isAuthenticated && !loading ? (
                    <>
                      <Button
                        variant='ghost'
                        className='h-10 rounded-lg px-4 text-sm font-semibold text-foreground/75 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        onClick={openAuthDialog}
                      >
                        {t('Sign in')}
                      </Button>
                      <Button
                        className='h-10 rounded-lg px-4 text-sm font-semibold'
                        onClick={openAuthDialog}
                      >
                        {t('Get started')}
                      </Button>
                    </>
                  ) : (
                    authContent
                  )}
                </>
              )}
            </div>

            {/* Mobile: compact actions + hamburger */}
            <div className='flex shrink-0 items-center gap-2 lg:hidden'>
              {showThemeSwitch && <ThemeSwitch variant={props.variant} />}
              {showAuthButtons && !loading && isAuthenticated && (
                <ProfileDropdown />
              )}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-9'
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={t('Toggle navigation menu')}
              >
                <div className='relative size-4'>
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] rotate-45' : 'top-[3px]'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'scale-x-0 opacity-0' : 'opacity-100'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] -rotate-45' : 'top-[11px]'
                    )}
                  />
                </div>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        className={cn(
          'bg-background/98 fixed inset-0 z-40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:pointer-events-none lg:hidden',
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      >
        <div className='flex h-full flex-col justify-between px-8 pt-20 pb-10'>
          <nav className='flex flex-col gap-1'>
            {links.map((link, i) => {
              const isActive = pathname === link.href
              const linkClassName = cn(
                'flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                mobileOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-4 opacity-0',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                link.disabled && 'pointer-events-none opacity-50'
              )
              const transitionStyle = {
                transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms',
              }
              if (link.external) {
                return (
                  <a
                    key={`${link.title}:${link.href}`}
                    href={link.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-disabled={link.disabled}
                    tabIndex={link.disabled ? -1 : undefined}
                    onClick={(event) => handleNavLinkClick(event, link, true)}
                    className={linkClassName}
                    style={transitionStyle}
                  >
                    {t(link.title)}
                  </a>
                )
              }
              return (
                <Link
                  key={`${link.title}:${link.href}`}
                  to={link.href}
                  disabled={link.disabled}
                  onClick={(event) => handleNavLinkClick(event, link, true)}
                  className={linkClassName}
                  style={transitionStyle}
                >
                  {t(link.title)}
                </Link>
              )
            })}
          </nav>

          <div
            className={cn(
              'flex flex-col gap-3 transition-all duration-500',
              mobileOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-4 opacity-0'
            )}
            style={{ transitionDelay: mobileOpen ? '250ms' : '0ms' }}
          >
            {showAuthButtons && isAuthenticated && (
              <Link
                to='/dashboard'
                onClick={() => setMobileOpen(false)}
                className='bg-foreground text-background inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80'
              >
                {t('Go to Dashboard')}
              </Link>
            )}
            {showAuthButtons && !isAuthenticated && (
              <Button
                onClick={() => {
                  setMobileOpen(false)
                  openAuthDialog()
                }}
                className='bg-foreground text-background h-10 w-full justify-center rounded-lg text-sm font-medium transition-opacity hover:bg-foreground/90 active:opacity-80'
              >
                {t('Sign in')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!authPromptTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeAuthPrompt()
          }
        }}
        title={t('Sign in required')}
        description={t('Please sign in to view {{module}}.', {
          module: authPromptTarget?.title || '',
        })}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        footer={
          <>
            <Button variant='outline' onClick={closeAuthPrompt}>
              {t('Cancel')}
            </Button>
            <Button onClick={navigateToSignIn}>{t('Sign in now')}</Button>
          </>
        }
      >
        <div className='bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
          {t('Redirecting to sign in in {{seconds}} seconds.', {
            seconds: authPromptSecondsLeft,
          })}
        </div>
      </Dialog>

      <AuthDialog />
    </>
  )
}
