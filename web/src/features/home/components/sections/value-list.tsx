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
import type { ReactNode } from 'react'

import { SectionHeading, SectionShell } from '../section-shell'

/**
 * Four claims, one per row.
 *
 * A definition list rather than four cards: the cards would each need their own
 * border, icon and padding, which turns four short sentences into a wall of
 * boxes. Rows separated by a hairline let the eye scan the labels (left, bold)
 * and stop only where it wants detail (right), and the mono chip in every row
 * keeps the block anchored to the same material as the terminal above.
 */
export function ValueList() {
  const { t } = useTranslation()

  const rows: { label: string; body: string; example: ReactNode }[] = [
    {
      label: t('One key'),
      body: t(
        'The same key calls every model you have enabled. To switch, change the model name in the request — the endpoint and the credential stay put.'
      ),
      example: (
        <>
          <Mono>deepseek-v4-flash</Mono>
          <Mono>glm-5.3</Mono>
          <Mono>gpt-5</Mono>
        </>
      ),
    },
    {
      label: t('Both API formats'),
      body: t(
        'OpenAI Chat Completions and Responses, and Anthropic Messages, with streaming and tool calls. A client built for either one works unchanged.'
      ),
      example: (
        <>
          <Mono>/v1/chat/completions</Mono>
          <Mono>/v1/messages</Mono>
        </>
      ),
    },
    {
      label: t('One allowance'),
      body: t(
        'One monthly quota per account, shared by every model and every key. No daily or weekly caps unless the operator sets them, and self-hosted means none of it leaves your machine.'
      ),
      example: (
        <>
          <Mono>quota</Mono>
          <Mono>rate limit</Mono>
        </>
      ),
    },
    {
      label: t('One bill'),
      body: t(
        'One invoice instead of one per vendor. Every request records its tokens, latency, channel and cost, so a line on the bill can always be traced back to a line in the log.'
      ),
      example: (
        <>
          <Mono>logs</Mono>
          <Mono>usage</Mono>
        </>
      ),
    },
  ]

  return (
    <SectionShell id='why'>
      <SectionHeading
        label={t('Why a gateway')}
        title={t('One account instead of one per provider')}
        lede={t(
          'No separate accounts, keys and invoices for each AI lab. This is what you get instead.'
        )}
      />

      <dl className='border-t border-border'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='grid grid-cols-1 gap-3 border-b border-border py-7 md:grid-cols-[208px_minmax(0,1fr)] md:gap-8'
          >
            <dt className='lp-display text-[17px] font-semibold text-foreground'>
              {row.label}
            </dt>
            <dd>
              <p className='max-w-[42rem] text-[16px] leading-[1.62] text-muted-foreground'>
                {row.body}
              </p>
                      <div className='mt-3 flex flex-wrap gap-1.5'>{row.example}</div>
            </dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  )
}

function Mono(props: { children: ReactNode }) {
  return (
    <span className='lp-mono rounded border border-border px-1.5 py-0.5 text-[12px] text-muted-foreground'>
      {props.children}
    </span>
  )
}
