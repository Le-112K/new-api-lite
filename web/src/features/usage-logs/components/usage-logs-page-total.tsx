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
import { useTranslation } from 'react-i18next'

import { formatLogQuota } from '@/lib/format'

/**
 * The design's `本页合计 / Page total` row.
 *
 * It sums the CURRENT PAGE (not the filtered range — that is the header
 * badge's job), so the footer and the rows can always be checked against each
 * other. The shared table primitives
 * (`src/components/data-table/**`, out of this feature's scope) expose no
 * `<tfoot>` slot and the markup cannot be injected from here, so this is a
 * hairline-topped strip pinned under the table rather than a real table row;
 * it carries exactly the design's four figures.
 */
export function UsageLogsPageTotal(props: {
  inputTokens: number
  outputTokens: number
  quota: number
  successCount: number
  rowCount: number
}) {
  const { t } = useTranslation()

  const figures: Array<{ label: string; value: string }> = [
    { label: t('Input tokens'), value: props.inputTokens.toLocaleString() },
    { label: t('Output tokens'), value: props.outputTokens.toLocaleString() },
    { label: t('Cost'), value: formatLogQuota(props.quota) },
  ]

  return (
    <div className='bg-muted/40 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t px-4 py-2.5 text-[13px]'>
      <span className='text-muted-foreground font-medium'>
        {t('Page total')}
      </span>
      <div className='ms-auto flex flex-wrap items-center gap-x-6 gap-y-1'>
        {figures.map((figure) => (
          <span key={figure.label} className='flex items-baseline gap-1.5'>
            <span className='text-muted-foreground/70 text-[11px]'>
              {figure.label}
            </span>
            <span className='font-mono font-semibold tabular-nums'>
              {figure.value}
            </span>
          </span>
        ))}
        <span className='flex items-baseline gap-1.5'>
          <span className='font-mono font-semibold tabular-nums'>
            {props.successCount} / {props.rowCount}
          </span>
          <span className='text-muted-foreground/70 text-[11px]'>
            {t('Success')}
          </span>
        </span>
      </div>
    </div>
  )
}
