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
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionShell } from '../section-shell'

/** Clients with a step-by-step guide in the docs; brand names stay untranslated. */
const CLIENTS = [
  'Claude Code',
  'Codex CLI',
  'Cursor',
  'OpenCode',
  'Cherry Studio',
  'DeepChat',
  'AionUi',
  'OpenClaw',
]

/**
 * "Change two settings."
 *
 * The one block on the page a visitor can verify in ten seconds, so it gets a
 * grey band — the only non-white section above the closing block. That
 * alternation does the separating work here instead of a border, which is what
 * lets the two dark code cards sit on the page without another frame around
 * them.
 *
 * Layout follows the reference: copy and the guide list on the left, the two
 * snippets stacked on the right at 12px radius. The URLs are derived from
 * `location.origin` because the gateway is self-hosted — a hardcoded demo
 * domain would produce copy that never works.
 */
export function Connect() {
  const { t } = useTranslation()
  const origin =
    typeof window === 'undefined' ? 'https://your-gateway.com' : window.location.origin

  return (
    <SectionShell id='connect' className='bg-secondary'>
      <div className='grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,467px)_minmax(0,1fr)] lg:gap-10'>
        <div>
          <p className='mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
            {t('Setup')}
          </p>
          <h2 className='lp-display text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.15] font-semibold text-foreground'>
            {t('Change two settings. Keep your tools.')}
          </h2>
          <p className='mt-4 max-w-[30rem] text-[16px] leading-[1.62] text-muted-foreground'>
            {t(
              'Claude Code, Codex CLI, Cursor and the official SDKs all read a base URL and a key. Point them here and every model answers on the same key.'
            )}
          </p>

          <p className='mt-9 mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
            {t('Step-by-step guides')}
          </p>
          <div className='grid max-w-[30rem] grid-cols-2 gap-x-8 gap-y-2.5'>
            {CLIENTS.map((client) => (
              <span key={client} className='text-[14px] text-foreground'>
                {client}
              </span>
            ))}
          </div>
        </div>

        <div className='space-y-4'>
          <Snippet
            label={t('Anthropic format')}
            code={`export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="sk-your-key"`}
          />
          <Snippet
            label={t('OpenAI format')}
            code={`export OPENAI_BASE_URL="${origin}/v1"
export OPENAI_API_KEY="sk-your-key"`}
          />
        </div>
      </div>
    </SectionShell>
  )
}

/**
 * One copyable snippet. The copied state is local and self-reverting: a toast
 * would cover the button the user just pressed and is heavier than the action
 * deserves. Radius and surface match the hero terminal so the two dark objects
 * on the page read as the same material.
 */
function Snippet(props: { label: string; code: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked (insecure origin) — the text stays selectable */
    }
  }

  return (
    <div className='overflow-hidden rounded-xl bg-[#0a0a0a]'>
      <div className='flex items-center justify-between border-b border-white/[0.08] px-5 py-2.5'>
        <span className='lp-mono text-[11.5px] text-white/45'>{props.label}</span>
        <button
          type='button'
          onClick={copy}
          className='lp-mono inline-flex items-center gap-1.5 text-[11.5px] text-white/45 transition-colors hover:text-white/85'
          aria-label={t('Copy')}
        >
          {copied ? (
            <Check className='size-3' aria-hidden />
          ) : (
            <Copy className='size-3' aria-hidden />
          )}
          {copied ? t('Copied') : t('Copy')}
        </button>
      </div>
      <pre className='lp-mono overflow-x-auto px-5 py-4 text-[13.5px] leading-[1.75] text-white/85'>
        {props.code}
      </pre>
    </div>
  )
}
