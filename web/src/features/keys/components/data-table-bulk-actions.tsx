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
import type { Table } from '@tanstack/react-table'
import { Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import type { ApiKey } from '../types'
import { ApiKeysMultiDeleteDialog } from './api-keys-multi-delete-dialog'
import { useApiKeys } from './api-keys-provider'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

/**
 * Selection bar, rendered *inside* the table card so it reads as part of the
 * panel (the console design's flush footer) rather than a floating toolbar.
 *
 * Both bulk capabilities the page already had are kept: copy the selected real
 * keys as a `name<TAB>key` block, and revoke the selection through the existing
 * two-step confirm dialog.
 */
export function DataTableBulkActions<TData>(props: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const { resolveRealKeysBatch } = useApiKeys()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const selectedRows = props.table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBatchCopy = useCallback(async () => {
    if (selectedRows.length === 0) return

    setIsCopying(true)
    try {
      const ids = selectedRows.map((row) => (row.original as ApiKey).id)
      const keysMap = await resolveRealKeysBatch(ids)

      const lines: string[] = []
      for (const row of selectedRows) {
        const apiKey = row.original as ApiKey
        const realKey = keysMap[apiKey.id]
        if (realKey) {
          lines.push(`${apiKey.name}\t${realKey}`)
        }
      }

      if (lines.length > 0) {
        const ok = await copyToClipboard(lines.join('\n'))
        if (ok) {
          toast.success(t('Copied {{count}} key(s)', { count: lines.length }))
        } else {
          toast.error(t('Failed to copy keys'))
        }
      }
    } catch {
      toast.error(t('Failed to copy keys'))
    } finally {
      setIsCopying(false)
    }
  }, [selectedRows, resolveRealKeysBatch, t])

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div className='bg-[var(--emphasis-soft)] flex flex-wrap items-center gap-2.5 border-t px-4 py-2.5 text-sm sm:px-5'>
        <KeyRound
          className='text-muted-foreground size-4 shrink-0'
          aria-hidden='true'
        />
        <span className='text-muted-foreground'>
          <span className='text-foreground font-semibold tabular-nums'>
            {selectedCount}
          </span>{' '}
          {t('selected')}
        </span>
        <span className='flex-1' />

        <Button
          variant='outline'
          size='sm'
          onClick={handleBatchCopy}
          disabled={isCopying}
          className='h-7 gap-1.5 px-2.5 text-xs'
        >
          {isCopying ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <Copy className='size-3.5' />
          )}
          {t('Copy selected keys')}
        </Button>
        <Button
          variant='destructive'
          size='sm'
          onClick={() => setShowDeleteConfirm(true)}
          className='h-7 gap-1.5 px-2.5 text-xs'
        >
          <Trash2 className='size-3.5' />
          {t('Delete selected API keys')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => props.table.resetRowSelection()}
          className='text-muted-foreground hover:text-foreground h-7 px-2.5 text-xs'
        >
          {t('Cancel')}
        </Button>
      </div>

      <ApiKeysMultiDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        table={props.table}
      />
    </>
  )
}
