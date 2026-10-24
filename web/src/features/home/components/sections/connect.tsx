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
import { ArrowRight, Check, Copy, SquareTerminal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { getLobeIcon } from '@/lib/lobe-icon'

import { SectionShell } from '../section-shell'

/**
 * Clients with a step-by-step guide. `slug` is what the guide URL carries, so
 * the docs side can resolve one page per tool without the homepage knowing any
 * of their URLs. Brand names stay untranslated.
 */
const GUIDES = [
  { name: 'Claude Code', slug: 'claude-code', icon: 'ClaudeCode' },
  { name: 'Codex CLI', slug: 'codex-cli', icon: 'Codex' },
  { name: 'Cursor', slug: 'cursor', icon: 'Cursor' },
  { name: 'OpenCode', slug: 'opencode', icon: 'OpenCode' },
  { name: 'Cherry Studio', slug: 'cherry-studio', icon: 'CherryStudio' },
  /* These two have no mark in the icon set; the list falls back to a generic
     terminal glyph rather than inventing a brand, which is also what the
     reference does for its "any SDK" row. */
  { name: 'DeepChat', slug: 'deepchat' },
  { name: 'AionUi', slug: 'aionui' },
  { name: 'OpenClaw', slug: 'openclaw', icon: 'OpenClaw' },
]

/** VSCode Dark+ palette, copied from the reference so the snippet reads as code. */
const SYNTAX = {
  keyword: 'text-[#C586C0]',
  plain: 'text-[#D4D4D4]',
  string: 'text-[#CE9178]',
}

/**
 * "Change two settings."
 *
 * The one block a visitor can verify in ten seconds, so it sits on the grey band
 * and is fenced by hairlines top and bottom — the same separator rhythm the
 * catalog block uses. Layout is the reference's 12-column grid rather than a
 * fixed two-column split: copy spans 5 columns, snippets span 7, and the 56px
 * gap keeps the two halves from reading as one table.
 *
 * URLs are derived from `location.origin` because the gateway is self-hosted; a
 * hardcoded demo domain would produce copy that never works.
 *
 * Every guide row is a link. The destination is whatever the operator configured
 * as `docs_link` (production points at the public docs site), with `?tool=<slug>`
 * appended so the docs side can show that tool's settings. The docs page itself
 * is out of scope here — only the entry point and the slug contract are.
 */
export function Connect() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const origin =
    typeof window === 'undefined'
      ? 'https://your-gateway.com'
      : window.location.origin

  /* Same destination the header's Docs link uses; falls back to the in-app path
     when the operator has not set one. */
  const docsBase = (status?.docs_link as string | undefined) || '/docs'
  const isExternalDocs = /^https?:\/\//i.test(docsBase)
  const guideHref = (slug: string) =>
    `${docsBase}${docsBase.includes('?') ? '&' : '?'}tool=${slug}`

  const snippets = [
    {
      label: t('Anthropic format'),
      lines: [
        { key: 'ANTHROPIC_BASE_URL', value: origin },
        { key: 'ANTHROPIC_AUTH_TOKEN', value: 'sk-your-key' },
      ],
      caption: t(
        'For Claude Code, the Anthropic SDKs and any client of the Messages API.'
      ),
    },
    {
      label: t('OpenAI format'),
      lines: [
        { key: 'OPENAI_BASE_URL', value: `${origin}/v1` },
        { key: 'OPENAI_API_KEY', value: 'sk-your-key' },
      ],
      caption: t(
        'For Codex CLI, Cursor, OpenCode, Cherry Studio and any client of Chat Completions or Responses.'
      ),
    },
  ]

  return (
    <SectionShell
      id='connect'
      className='border-b border-black/[0.11] bg-secondary dark:border-white/10'
    >
      <div className='grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-14'>
        <div className='lg:col-span-5'>
          <h2 className='lp-display text-[32px] leading-[1.08] font-semibold tracking-[-0.025em] text-foreground md:text-[44px]'>
            {t('Keep your tools. Change two settings.')}
          </h2>
          <p className='mt-4 max-w-[30rem] text-[16px] leading-[1.62] text-muted-foreground'>
            {t(
              'Claude Code, Codex CLI, Cursor and the official SDKs all read a base URL and an API key. Point them here, and every model answers on the same key.'
            )}
          </p>

          <p className='mt-10 text-[14px] font-semibold text-foreground'>
            {t('Step-by-step guides')}
          </p>
          <ul className='mt-2 grid grid-cols-2 gap-x-8'>
            {GUIDES.map((guide) => (
              <li key={guide.slug} className='border-b border-border'>
                <a
                  href={guideHref(guide.slug)}
                  {...(isExternalDocs
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className='group flex h-12 items-center gap-3 text-foreground'
                >
                  <span
                    className='flex size-[18px] shrink-0 items-center justify-center text-foreground/80'
                    aria-hidden
                  >
                    {guide.icon ? (
                      getLobeIcon(guide.icon, 18)
                    ) : (
                      <SquareTerminal className='size-[18px]' />
                    )}
                  </span>
                  <span className='text-[15px] font-medium transition-colors group-hover:text-foreground/70'>
                    {guide.name}
                  </span>
                  <ArrowRight
                    className='ml-auto size-[15px] shrink-0 text-[#a3a3a3] transition-transform group-hover:translate-x-0.5'
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className='lg:col-span-7'>
          <div className='space-y-4'>
            {snippets.map((snippet) => (
              <Snippet key={snippet.label} {...snippet} />
            ))}
          </div>
          <p className='mt-4 text-[14px] leading-[1.62] text-muted-foreground'>
            {t(
              'Replace sk-your-key with a key from your console. Each guide names the exact file and setting for its tool, plus the model to start with.'
            )}
          </p>
        </div>
      </div>
    </SectionShell>
  )
}

/**
 * One copyable snippet. The copied state is local and self-reverting: a toast
 * would cover the button the user just pressed and is heavier than the action
 * deserves.
 *
 * The card's anatomy is the reference's: 49px caption bar (label left, copy
 * right), a 20px-padded body, and a footer that explains who the snippet is for.
 * The 1px light border matters — without it the black slab has no edge against
 * the grey band.
 */
function Snippet(props: {
  label: string
  lines: { key: string; value: string }[]
  caption: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const plain = props.lines
    .map((line) => `export ${line.key}="${line.value}"`)
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked (insecure origin) — the text stays selectable */
    }
  }

  // 圆角写死 px：站内 `--radius` 是 1rem，`rounded-xl` 会算成 22.4px，
  // 参考站这里是 12px；`rounded-lg` / `rounded-md` 同样被放大，所以不用刻度类。
  return (
    <figure className='overflow-hidden rounded-[12px] border border-black/[0.11] bg-[#0a0a0a] dark:border-white/10 dark:bg-[#141416]'>
      <figcaption className='flex items-center justify-between border-b border-white/10 py-2 pr-2 pl-5'>
        <span className='text-[13px] text-white/55'>{props.label}</span>
        <button
          type='button'
          onClick={copy}
          className='inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-white/15 px-2.5 text-[11px] text-white/70 transition-colors hover:border-white/30 hover:text-white'
          aria-label={t('Copy')}
        >
          {copied ? (
            <Check className='size-3.5' aria-hidden />
          ) : (
            <Copy className='size-3.5' aria-hidden />
          )}
          {copied ? t('Copied') : t('Copy')}
        </button>
      </figcaption>

      <pre className='lp-mono overflow-x-auto p-5 text-[13.5px] leading-[1.9]'>
        <code className={SYNTAX.plain}>
          {props.lines.map((line, index) => (
            <span key={line.key}>
              {index > 0 ? '\n' : null}
              <span className={SYNTAX.keyword}>export</span>
              <span className={SYNTAX.plain}>{' '}{line.key}</span>
              <span className={SYNTAX.plain}>=</span>
              <span className={SYNTAX.string}>{'"'}{line.value}{'"'}</span>
            </span>
          ))}
        </code>
      </pre>

      <p className='border-t border-white/10 px-5 py-3 text-[13px] leading-[1.5] text-white/55'>
        {props.caption}
      </p>
    </figure>
  )
}
