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
import { Check, Copy, Loader2 } from 'lucide-react'
import { useState, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { MaskedValueTrigger } from '@/components/masked-value-display'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'

import type { ApiKey } from '../types'
import { useApiKeys } from './api-keys-provider'

/**
 * Neutral chip, the console design's unit of "a value, not a status". Grayscale
 * only (spec §6: chrome stays colorless), so it reads as data rather than as a
 * semantic state.
 */
export function NeutralChip(props: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground inline-flex max-w-40 items-center truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        props.className
      )}
    >
      {props.children}
    </span>
  )
}

export function ApiKeyCell(props: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const {
    resolveRealKey,
    resolvedKeys,
    loadingKeys,
    copiedKeyId,
    markKeyCopied,
  } = useApiKeys()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const isLoading = !!loadingKeys[props.apiKey.id]
  const resolvedFullKey = resolvedKeys[props.apiKey.id]
  const isCopied = copiedKeyId === props.apiKey.id
  const maskedKey = `sk-${props.apiKey.key}`

  const handlePopoverOpen = useCallback(
    (open: boolean) => {
      setPopoverOpen(open)
      if (open && !resolvedFullKey) {
        resolveRealKey(props.apiKey.id)
      }
    },
    [resolvedFullKey, resolveRealKey, props.apiKey.id]
  )

  const handleCopy = useCallback(async () => {
    const realKey = resolvedFullKey || (await resolveRealKey(props.apiKey.id))
    if (!realKey) return

    const ok = await copyToClipboard(realKey)
    if (ok) markKeyCopied(props.apiKey.id)
  }, [resolvedFullKey, resolveRealKey, props.apiKey.id, markKeyCopied])

  let copyIcon = <Copy className='size-3.5' />
  let copyTooltip = t('Copy API key')
  if (isLoading) {
    copyIcon = <Loader2 className='size-3.5 animate-spin' />
    copyTooltip = t('Loading...')
  } else if (isCopied) {
    copyIcon = <Check className='size-3.5 text-[var(--success-text)]' />
    copyTooltip = t('Copied!')
  }

  return (
    <div className='flex max-w-full min-w-0 items-center gap-1'>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
        <PopoverTrigger render={<MaskedValueTrigger />}>
          <span className='truncate'>{maskedKey}</span>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto max-w-[min(90vw,28rem)]'
          align='start'
        >
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs'>{t('Full API Key')}</p>
            {isLoading ? (
              <div className='flex items-center gap-2 py-2'>
                <Loader2 className='size-3.5 animate-spin' />
                <span className='text-muted-foreground text-xs'>
                  {t('Loading...')}
                </span>
              </div>
            ) : (
              <input
                readOnly
                value={resolvedFullKey || maskedKey}
                autoFocus
                onFocus={(e) => e.target.select()}
                className='bg-muted/50 w-full min-w-[280px] rounded-md border px-3 py-2 font-mono text-xs outline-none'
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-foreground size-6 shrink-0'
              onClick={handleCopy}
              disabled={isLoading}
            />
          }
        >
          {copyIcon}
        </TooltipTrigger>
        <TooltipContent>{copyTooltip}</TooltipContent>
      </Tooltip>
    </div>
  )
}

type ApiKeyRestrictionProps = {
  apiKey: ApiKey
  detailsTrigger?: 'hover' | 'click'
}

export function ModelLimitsCell(props: ApiKeyRestrictionProps) {
  const { t } = useTranslation()
  const models = props.apiKey.model_limits_enabled
    ? (props.apiKey.model_limits || '').split(',').filter(Boolean)
    : []

  return (
    <ApiKeyRestrictionCell
      items={models}
      label={t('{{count}} models', { count: models.length })}
      title={t('Models')}
      emptyLabel={t('All models')}
      detailsTrigger={props.detailsTrigger}
    />
  )
}

export function IpRestrictionsCell(props: ApiKeyRestrictionProps) {
  const { t } = useTranslation()
  const ips = (props.apiKey.allow_ips || '')
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean)

  return (
    <ApiKeyRestrictionCell
      items={ips}
      label={t('{{count}} IP(s)', { count: ips.length })}
      title={t('IP Restriction')}
      emptyLabel={t('No restriction')}
      detailsTrigger={props.detailsTrigger}
    />
  )
}

function ApiKeyRestrictionCell(props: {
  items: string[]
  label: string
  title: string
  emptyLabel: string
  detailsTrigger?: 'hover' | 'click'
}) {
  if (!props.items.length) {
    if (props.detailsTrigger === 'click') {
      return (
        <span className='inline-flex items-center gap-1.5 text-xs'>
          <span className='text-muted-foreground'>{props.title}</span>
          <span>{props.emptyLabel}</span>
        </span>
      )
    }
    return <NeutralChip>{props.emptyLabel}</NeutralChip>
  }

  const details = (
    <div className='max-h-[200px] space-y-1 overflow-y-auto text-xs'>
      {props.items.map((item) => (
        <div key={item} className='font-mono break-all'>
          {item}
        </div>
      ))}
    </div>
  )

  if (props.detailsTrigger === 'click') {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              aria-label={`${props.title}: ${props.label}`}
              className='h-7 max-w-full justify-start px-0 text-xs font-normal underline decoration-dotted underline-offset-4'
            />
          }
        >
          {props.label}
        </PopoverTrigger>
        <PopoverContent align='start' className='max-w-[calc(100vw-2rem)]'>
          <PopoverTitle>{props.title}</PopoverTitle>
          {details}
        </PopoverContent>
      </Popover>
    )
  }

  const visible = props.items.slice(0, 2)
  const overflow = props.items.length - visible.length

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className='flex max-w-full min-w-0 flex-wrap items-center gap-1' />
        }
      >
        {visible.map((item) => (
          <NeutralChip key={item}>{item}</NeutralChip>
        ))}
        {overflow > 0 && <NeutralChip>{`+${overflow}`}</NeutralChip>}
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-xs'>
        {details}
      </TooltipContent>
    </Tooltip>
  )
}
