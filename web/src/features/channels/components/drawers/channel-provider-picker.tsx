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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AutoGroupFlowBorder } from '@/features/keys/components/auto-group-visuals'
import { useMediaQuery } from '@/hooks/use-media-query'

import {
  CHANNEL_PROVIDER_PRESENTATION,
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_SUB2API,
  REMOVED_CHANNEL_TYPES,
  type ChannelProviderPresentation,
} from '../../constants'
import { CHANNEL_TYPE_ADVANCED_CUSTOM } from '../../lib/advanced-custom'
import type { ChannelProviderTarget } from '../../lib/channel-configuration'
import { ChannelTypeLogo } from '../channel-type-badge'

type ChannelProviderPickerProps = {
  isCreating?: boolean
  currentProvider?: ChannelProviderTarget | null
  disabled: boolean
  onSelect: (target: ChannelProviderTarget) => void
}

export function ChannelProviderPicker(props: ChannelProviderPickerProps) {
  const { t } = useTranslation()
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [search, setSearch] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const filter = selectedFilter
  const keyword = search.trim().toLocaleLowerCase()
  const options = useMemo(() => {
    const entries: Array<{
      id: string
      label: string
      target: ChannelProviderTarget
      description?: string
      detail?: string
      badge?: ChannelProviderPresentation['badge']
      searchText: string
    }> = []
    for (const option of CHANNEL_TYPE_OPTIONS) {
      if (filter === 'plugin') continue
      // Keep legacy Zhipu available when editing existing channels.
      if (props.isCreating && option.value === 16) continue
      if (props.isCreating && option.value === 7) continue
      const isCustom =
        option.value === 8 || option.value === CHANNEL_TYPE_ADVANCED_CUSTOM
      const isGateway =
        option.value === CHANNEL_TYPE_NEW_API ||
        option.value === CHANNEL_TYPE_SUB2API
      if (filter === 'gateway' && !isGateway) continue
      if (filter === 'custom' && !isCustom) continue
      if (filter === 'builtin' && isCustom) continue
      const presentation = CHANNEL_PROVIDER_PRESENTATION[option.value]
      entries.push({
        id: `builtin:${option.value}`,
        label: t(option.label),
        target: { kind: 'builtin', type: option.value },
        description: presentation ? t(presentation.descriptionKey) : undefined,
        detail: presentation?.detailKey
          ? t(presentation.detailKey)
          : undefined,
        badge: presentation?.badge,
        searchText: `${option.value} ${option.label} ${t(option.label)}`,
      })
    }
    return entries.filter((entry) =>
      entry.searchText.toLocaleLowerCase().includes(keyword)
    )
  }, [filter, keyword, props.isCreating, t])

  const customType = Number(search.trim())
  const canUseCustomType =
    (filter === 'all' || filter === 'custom') &&
    /^\d+$/.test(search.trim()) &&
    Number.isSafeInteger(customType) &&
    customType > 0 &&
    !CHANNEL_TYPE_OPTIONS.some((option) => option.value === customType) &&
    // Types removed in this fork stay selectable only while they are the
    // channel's current type, so existing rows keep rendering correctly while
    // new channels cannot be created with them (the API rejects those too).
    (!REMOVED_CHANNEL_TYPES.has(customType) ||
      customType === props.currentProvider?.type)
  const currentProviderId =
    props.currentProvider?.kind === 'builtin'
      ? `builtin:${props.currentProvider.type}`
      : undefined

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => setSelectedFilter(String(value))}
      className='min-h-0 flex-1 gap-4 p-4 sm:p-6'
    >
      <TabsList
        aria-label={t('Provider source')}
        className='max-w-full shrink-0 flex-wrap justify-start group-data-horizontal/tabs:h-auto'
      >
        <TabsTrigger value='all' className='h-auto'>
          {t('All')}
        </TabsTrigger>
        <TabsTrigger value='builtin' className='h-auto'>
          {t('Built-in')}
        </TabsTrigger>
        <TabsTrigger value='gateway' className='h-auto'>
          {t('Gateways')}
        </TabsTrigger>
        <TabsTrigger value='custom' className='h-auto'>
          {t('Custom')}
        </TabsTrigger>
      </TabsList>
      {/* Keep the search and command state when changing categories. */}
      <TabsContent
        value={filter}
        keepMounted
        className='flex min-h-0 flex-1 flex-col gap-4'
      >
        <Command
          label={t('Search providers or type numbers')}
          defaultValue={currentProviderId}
          shouldFilter={false}
          className='min-h-0 flex-1 bg-transparent p-0'
        >
          <CommandInput
            autoFocus
            className='placeholder:text-muted-foreground'
            value={search}
            onValueChange={setSearch}
            placeholder={t('Search providers or type numbers')}
            aria-label={t('Search providers or type numbers')}
          />
          <CommandList className='mt-3 max-h-none min-h-0 flex-1'>
            <CommandEmpty>{t('No matching provider')}</CommandEmpty>
            <CommandGroup className='p-1 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:gap-2.5 md:[&_[cmdk-group-items]]:grid-cols-2 xl:[&_[cmdk-group-items]]:grid-cols-3'>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  aria-current={
                    option.id === currentProviderId ? true : undefined
                  }
                  data-checked={option.id === currentProviderId}
                  aria-label={`${option.label} ${t('Built-in')} #${option.target.type}`}
                  aria-description={
                    [
                      option.badge && t(option.badge.labelKey),
                      option.detail || option.description,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  disabled={props.disabled}
                  onSelect={() => props.onSelect(option.target)}
                  className='data-selected:border-primary/50 data-selected:bg-primary/5 min-h-24 flex-col items-stretch justify-between gap-2.5 rounded-lg border p-3 md:min-h-32 [&>svg]:hidden'
                >
                  {option.target.kind === 'builtin' &&
                    option.target.type === CHANNEL_TYPE_ADVANCED_CUSTOM && (
                      <AutoGroupFlowBorder
                        shouldReduceMotion={
                          shouldReduceMotion || props.disabled
                        }
                      />
                    )}
                  <span className='flex min-w-0 items-start gap-2.5'>
                    <span className='shrink-0'>
                      <ChannelTypeLogo
                        type={option.target.type}
                        size={20}
                      />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                        <span
                          className='max-w-full truncate font-medium'
                          title={option.label}
                        >
                          {option.label}
                        </span>
                        {option.badge && (
                          <StatusBadge
                            label={t(option.badge.labelKey)}
                            variant={
                              option.badge.tone === 'warning'
                                ? 'warning'
                                : 'info'
                            }
                            copyable={false}
                            size='sm'
                            className={
                              option.badge.tone === 'warning'
                                ? 'bg-warning/10 text-xs text-[color-mix(in_oklab,var(--warning)_50%,var(--foreground))]'
                                : 'bg-primary/10 text-xs text-[color-mix(in_oklab,var(--primary)_50%,var(--foreground))]'
                            }
                          />
                        )}
                      </span>
                      {option.description && (
                        <span
                          className='text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed break-words'
                          title={option.detail || option.description}
                        >
                          {option.description}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className='flex min-w-0 items-center gap-2'>
                    <Badge
                      variant={
                        option.id === currentProviderId ? 'default' : 'secondary'
                      }
                      className='shrink-0 rounded-md px-1.5 py-0 text-[10px] font-normal'
                    >
                      {option.id === currentProviderId
                        ? t('Current')
                        : t('Built-in')}
                    </Badge>
                    <span className='text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums'>
                      #{option.target.type}
                    </span>
                  </span>
                </CommandItem>
              ))}
              {canUseCustomType && (
                <CommandItem
                  value={`custom:${customType}`}
                  aria-current={
                    currentProviderId === `builtin:${customType}`
                      ? true
                      : undefined
                  }
                  data-checked={currentProviderId === `builtin:${customType}`}
                  aria-label={t('Use channel type {{type}}', {
                    type: customType,
                  })}
                  disabled={props.disabled}
                  onSelect={() =>
                    props.onSelect({ kind: 'builtin', type: customType })
                  }
                  className='data-selected:border-primary/50 data-selected:bg-primary/5 min-h-24 gap-2.5 rounded-lg border p-3 md:min-h-32 [&>svg]:hidden'
                >
                  <span className='shrink-0'>
                    <ChannelTypeLogo type={customType} size={20} />
                  </span>
                  <span className='min-w-0 break-words'>
                    {t('Use channel type {{type}}', { type: customType })}
                  </span>
                  {currentProviderId === `builtin:${customType}` && (
                    <Badge>{t('Current')}</Badge>
                  )}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </TabsContent>
    </Tabs>
  )
}
