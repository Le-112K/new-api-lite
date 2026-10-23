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

import { SectionHeading, SectionShell } from '../section-shell'

/** Clients with a step-by-step guide in the docs; brand names stay untranslated. */
const CLIENTS = [
  'Cherry Studio',
  'Claude Code',
  'Codex CLI',
  'Cursor',
  'OpenCode',
  'DeepChat',
  'AionUi',
  'OpenClaw',
]

/**
 * "Change two settings."
 *
 * Every other gateway page promises compatibility; this block is the only place
 * a visitor can verify it in ten seconds. So the two snippets are the section,
 * not an illustration of it: real base URLs, real export lines, and a copy
 * button that yields something pasteable.
 *
 * The URLs are computed from `location.origin` because the gateway is
 * self-hosted — hardcoding a demo domain would produce copy that never works.
 */
export function Connect() {
  const { t } = useTranslation()
  const origin =
    typeof window === 'undefined' ? 'https://your-gateway.com' : window.location.origin

  return (
    <SectionShell id='connect'>
      <SectionHeading
        label={t('Setup')}
        title={t('Change two settings. Keep your tools.')}
        lede={t(
          'Claude Code, Codex CLI, Cursor and the official SDKs all read a base URL and a key. Point them here and every model answers on the same key.'
        )}
      />

      <div className='overflow-hidden rounded-xl border border-border'>
        <div className='grid grid-cols-1 gap-px bg-border lg:grid-cols-2'>
          <Snippet
            protocol='Anthropic'
            caption={t('For Claude Code and the Messages API')}
            code={`export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="sk-your-key"`}
          />
          <Snippet
            protocol='OpenAI'
            caption={t('For Codex CLI, Cursor and Chat Completions')}
            code={`export OPENAI_BASE_URL="${origin}/v1"
export OPENAI_API_KEY="sk-your-key"`}
          />
        </div>
      </div>

      <div className='mt-10'>
        <p className='mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
          {t('Apps with setup guides')}
        </p>
        <div className='flex flex-wrap gap-2'>
          {CLIENTS.map((client) => (
            <span
              key={client}
              className='rounded-full border border-border px-3 py-1 text-[12.5px] text-muted-foreground'
            >
              {client}
            </span>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}

/**
 * One copyable snippet. The copied state is local and self-reverting: a toast
 * would cover the button the user just pressed and is heavier than the action
 * deserves.
 */
function Snippet(props: { protocol: string; caption: string; code: string }) {
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
    <div className='bg-background p-6'>
      <div className='mb-4 flex items-baseline justify-between gap-3'>
        <span className='font-mono text-[12.5px] font-medium text-foreground'>
          {props.protocol}
        </span>
        <span className='text-[11.5px] text-muted-foreground'>{props.caption}</span>
      </div>

      <div className='relative overflow-hidden rounded-lg bg-[#0B0B0C] dark:bg-[#17171A]'>
        <button
          type='button'
          onClick={copy}
          className='absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-mono text-[10.5px] text-white/45 transition-colors hover:border-white/20 hover:text-white/80'
          aria-label={t('Copy')}
        >
          {copied ? (
            <Check className='size-3' aria-hidden />
          ) : (
            <Copy className='size-3' aria-hidden />
          )}
          {copied ? t('Copied') : t('Copy')}
        </button>
        <pre className='overflow-x-auto px-4 py-4 pr-20 font-mono text-[11.5px] leading-[1.9] text-white/70'>
          {props.code}
        </pre>
      </div>
    </div>
  )
}
