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
import type { Row } from '@tanstack/react-table'
import {
  Trash2,
  Edit,
  Loader2,
  ArrowRightLeft,
  Copy,
  Link,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { encodeChannelConnectionInfo } from '@/lib/channel-connection-info'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { handleServerError } from '@/lib/handle-server-error'

import { updateApiKeyStatus } from '../api'
import { API_KEY_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { apiKeySchema } from '../types'
import { useApiKeys } from './api-keys-provider'

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address as string
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

/**
 * Row actions, laid out the way the console design reads them: the two
 * reversible/primary verbs (enable-disable, revoke) sit in the open, and the
 * long tail (edit, copy, connection string, CC Switch) folds into a menu so the
 * row stays quiet. Nothing the previous page offered was dropped — the menu is
 * the same set of operations it had, plus the toggle and revoke that used to be
 * icon buttons.
 */
export function DataTableRowActions<TData>(props: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const apiKey = apiKeySchema.parse(props.row.original)
  const {
    setOpen,
    setCurrentRow,
    triggerRefresh,
    setResolvedKey,
    resolveRealKey,
    loadingKeys,
  } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const isRealKeyLoading = Boolean(loadingKeys[apiKey.id])

  const toggleLabel = isEnabled ? t('Disable') : t('Enable')

  const handleToggleStatus = async () => {
    const newStatus = isEnabled
      ? API_KEY_STATUS.DISABLED
      : API_KEY_STATUS.ENABLED

    setIsTogglingStatus(true)
    try {
      const result = await updateApiKeyStatus(apiKey.id, newStatus)
      if (result.success) {
        const message = isEnabled
          ? t(SUCCESS_MESSAGES.API_KEY_DISABLED)
          : t(SUCCESS_MESSAGES.API_KEY_ENABLED)
        toast.success(message)
        triggerRefresh()
      } else {
        handleServerError(result, t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsTogglingStatus(false)
    }
  }

  return (
    <div className='flex items-center justify-end gap-1'>
      <Button
        variant='ghost'
        size='sm'
        onClick={handleToggleStatus}
        disabled={isTogglingStatus}
        className='text-muted-foreground hover:text-foreground h-7 px-2 text-xs font-medium'
      >
        {isTogglingStatus && <Loader2 className='size-3.5 animate-spin' />}
        {toggleLabel}
      </Button>

      <Button
        variant='destructive'
        size='sm'
        onClick={() => {
          setCurrentRow(apiKey)
          setOpen('delete')
        }}
        /* Revoking is irreversible, so the spec (§5.1) wants the controlled
           red as a SOLID fill — the theme's own `--destructive` is grayscaled by
           the apple-bw skin, which is why the `-strong` console token is used
           here. The verb stays explicit and the click opens the confirm dialog
           (rules R-D1/R-D2). */
        className='h-7 bg-[var(--destructive-strong)] px-2 text-xs font-medium text-[var(--destructive-on-strong)] hover:bg-[var(--destructive-strong)]/90 dark:bg-[var(--destructive-strong)] dark:text-[var(--destructive-on-strong)] dark:hover:bg-[var(--destructive-strong)]/90'
      >
        {t('Revoke key')}
      </Button>

      <DataTableRowActionMenu
        ariaLabel={t('Open menu')}
        contentClassName='w-[200px]'
        modal={false}
      >
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('update')
          }}
        >
          {t('Edit')}
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isRealKeyLoading}
          onClick={async () => {
            const realKey = await resolveRealKey(apiKey.id)
            if (!realKey) return
            const ok = await copyToClipboard(realKey)
            if (ok) toast.success(t('Copied'))
          }}
        >
          {t('Copy Key')}
          <DropdownMenuShortcut>
            <Copy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isRealKeyLoading}
          onClick={async () => {
            const realKey = await resolveRealKey(apiKey.id)
            if (!realKey) return
            const connStr = encodeChannelConnectionInfo(
              realKey,
              getServerAddress()
            )
            const ok = await copyToClipboard(connStr)
            if (ok) toast.success(t('Copied'))
          }}
        >
          {t('Copy Connection Info')}
          <DropdownMenuShortcut>
            <Link size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            const realKey = await resolveRealKey(apiKey.id)
            if (!realKey) return
            setResolvedKey(realKey)
            setCurrentRow(apiKey)
            setOpen('cc-switch')
          }}
        >
          {t('CC Switch')}
          <DropdownMenuShortcut>
            <ArrowRightLeft size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
