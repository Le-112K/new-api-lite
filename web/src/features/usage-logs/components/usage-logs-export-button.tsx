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
import { Download } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'

import type { UsageLog } from '../data/schema'
import { resolveUsageLogStatus } from '../lib/log-status'

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * `导出 CSV / Export CSV` from the page head. Exports the rows currently in
 * the table (the page the operator is looking at) — the same rows the
 * `本页合计 / Page total` strip sums — using the labels the table shows.
 */
export function UsageLogsExportButton(props: {
  table: Table<Record<string, unknown>> | null
}) {
  const { t, i18n } = useTranslation()
  const table = props.table

  const handleExport = useCallback(() => {
    if (table == null) return

    const logs = table
      .getRowModel()
      .rows.map((row) => row.original as unknown as UsageLog)
    const header = [
      t('Time'),
      t('User'),
      t('Channel'),
      t('Token'),
      t('Model'),
      t('Status'),
      t('Input tokens'),
      t('Output tokens'),
      t('Cost'),
      t('Duration'),
    ]
    const lines = [header.map(csvCell).join(',')]

    for (const log of logs) {
      const status = resolveUsageLogStatus(log, t, (key) => i18n.exists(key))
      const statusText =
        status.reason != null ? `${status.label} · ${status.reason}` : status.label
      lines.push(
        [
          formatTimestampToDate(log.created_at),
          log.username,
          log.channel_name ? `${log.channel_name} #${log.channel}` : `#${log.channel}`,
          log.token_name,
          log.model_name,
          statusText,
          log.prompt_tokens,
          log.completion_tokens,
          formatLogQuota(log.quota),
          log.use_time,
        ]
          .map(csvCell)
          .join(',')
      )
    }

    // BOM so Excel opens the file as UTF-8.
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage-logs-${new Date()
      .toISOString()
      .slice(0, 19)
      .replaceAll(':', '-')}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [table, t, i18n])

  return (
    <Button
      type='button'
      variant='outline'
      onClick={handleExport}
      disabled={table == null}
    >
      <Download className='size-4' aria-hidden='true' />
      {t('Export CSV')}
    </Button>
  )
}
