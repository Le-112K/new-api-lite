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
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

type SynClass = 'cmd' | 'key' | 'str' | 'num' | 'mut' | 'hl' | 'pun'

/** [syntax tier, text] — one entry per coloured span in the approved prototype. */
type CodeToken = readonly [SynClass, string]

interface TerminalDemo {
  id: string
  labelKey: string
  method: string
  endpoint: string
  request: readonly (readonly CodeToken[])[]
  response: readonly (readonly CodeToken[])[]
}

// Payloads transcribed span-for-span from the approved prototype
// (deliverables/aperture-landing.html, 1405-1447) — do not paraphrase.
// The language is grayscale only, so the tiers below are steps of grey.
const TERMINAL_DEMOS: readonly TerminalDemo[] = [
  {
    id: 'chat',
    labelKey: 'Chat',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    request: [
      [['cmd', 'curl'], ['pun', ' '], ['mut', '$APERTURE'], ['pun', '/v1/chat/completions \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Authorization: Bearer sk-••••"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Content-Type: application/json"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-d'], ['pun', ' '], ['str', '\'{']],
      [['pun', '    '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '    '], ['key', '"messages"'], ['pun', ': [']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"system"'], ['pun', ', '], ['key', '"content"'], ['pun', ': '], ['str', '"Be brief."'], ['pun', ' },']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"user"'], ['pun', ', '], ['key', '"content"'], ['pun', ': '], ['str', '"Hi"'], ['pun', ' }']],
      [['pun', '    ],']],
      [['pun', '    '], ['key', '"temperature"'], ['pun', ': '], ['num', '0.7'], ['pun', ',']],
      [['pun', '    '], ['key', '"top_p"'], ['pun', ': '], ['num', '1'], ['pun', ',']],
      [['pun', '    '], ['key', '"max_tokens"'], ['pun', ': '], ['num', '512'], ['pun', ',']],
      [['pun', '    '], ['key', '"frequency_penalty"'], ['pun', ': '], ['num', '0'], ['pun', ',']],
      [['pun', '    '], ['key', '"presence_penalty"'], ['pun', ': '], ['num', '0'], ['pun', ',']],
      [['pun', '    '], ['key', '"stream"'], ['pun', ': '], ['num', 'true']],
      [['pun', '  }\'']],
    ],
    response: [
      [['pun', '{']],
      [['pun', '  '], ['key', '"id"'], ['pun', ': '], ['str', '"chatcmpl-9xK2"'], ['pun', ',']],
      [['pun', '  '], ['key', '"object"'], ['pun', ': '], ['str', '"chat.completion"'], ['pun', ',']],
      [['pun', '  '], ['key', '"created"'], ['pun', ': '], ['num', '1732000000'], ['pun', ',']],
      [['pun', '  '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '  '], ['key', '"choices"'], ['pun', ': [{']],
      [['pun', '    '], ['key', '"index"'], ['pun', ': '], ['num', '0'], ['pun', ',']],
      [['pun', '    '], ['key', '"message"'], ['pun', ': {']],
      [['pun', '      '], ['key', '"role"'], ['pun', ': '], ['str', '"assistant"'], ['pun', ',']],
      [['pun', '      '], ['key', '"content"'], ['pun', ': '], ['hl', '"…"']],
      [['pun', '    },']],
      [['pun', '    '], ['key', '"finish_reason"'], ['pun', ': '], ['str', '"stop"']],
      [['pun', '  }],']],
      [['pun', '  '], ['key', '"usage"'], ['pun', ': {']],
      [['pun', '    '], ['key', '"prompt_tokens"'], ['pun', ': '], ['num', '9'], ['pun', ',']],
      [['pun', '    '], ['key', '"completion_tokens"'], ['pun', ': '], ['num', '18'], ['pun', ',']],
      [['pun', '    '], ['key', '"total_tokens"'], ['pun', ': '], ['num', '27']],
      [['pun', '  }']],
      [['pun', '}']],
    ],
  },
  {
    id: 'responses',
    labelKey: 'Responses',
    method: 'POST',
    endpoint: '/v1/responses',
    request: [
      [['cmd', 'curl'], ['pun', ' '], ['mut', '$APERTURE'], ['pun', '/v1/responses \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Authorization: Bearer sk-••••"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Content-Type: application/json"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-d'], ['pun', ' '], ['str', '\'{']],
      [['pun', '    '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '    '], ['key', '"input"'], ['pun', ': [']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"system"'], ['pun', ', '], ['key', '"content"'], ['pun', ': '], ['str', '"Be brief."'], ['pun', ' },']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"user"'], ['pun', ', '], ['key', '"content"'], ['pun', ': '], ['str', '"Hi"'], ['pun', ' }']],
      [['pun', '    ],']],
      [['pun', '    '], ['key', '"max_output_tokens"'], ['pun', ': '], ['num', '512'], ['pun', ',']],
      [['pun', '    '], ['key', '"temperature"'], ['pun', ': '], ['num', '0.7'], ['pun', ',']],
      [['pun', '    '], ['key', '"top_p"'], ['pun', ': '], ['num', '1'], ['pun', ',']],
      [['pun', '    '], ['key', '"metadata"'], ['pun', ': { '], ['key', '"trace"'], ['pun', ': '], ['str', '"demo"'], ['pun', ' },']],
      [['pun', '    '], ['key', '"truncation"'], ['pun', ': '], ['str', '"auto"'], ['pun', ',']],
      [['pun', '    '], ['key', '"stream"'], ['pun', ': '], ['num', 'true'], ['pun', ',']],
      [['pun', '    '], ['key', '"store"'], ['pun', ': '], ['num', 'false']],
      [['pun', '  }\'']],
    ],
    response: [
      [['pun', '{']],
      [['pun', '  '], ['key', '"id"'], ['pun', ': '], ['str', '"resp_9xK2"'], ['pun', ',']],
      [['pun', '  '], ['key', '"object"'], ['pun', ': '], ['str', '"response"'], ['pun', ',']],
      [['pun', '  '], ['key', '"created_at"'], ['pun', ': '], ['num', '1732000000'], ['pun', ',']],
      [['pun', '  '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '  '], ['key', '"status"'], ['pun', ': '], ['str', '"completed"'], ['pun', ',']],
      [['pun', '  '], ['key', '"output"'], ['pun', ': [{']],
      [['pun', '    '], ['key', '"type"'], ['pun', ': '], ['str', '"message"'], ['pun', ',']],
      [['pun', '    '], ['key', '"role"'], ['pun', ': '], ['str', '"assistant"'], ['pun', ',']],
      [['pun', '    '], ['key', '"content"'], ['pun', ': [{']],
      [['pun', '      '], ['key', '"type"'], ['pun', ': '], ['str', '"output_text"'], ['pun', ',']],
      [['pun', '      '], ['key', '"text"'], ['pun', ': '], ['hl', '"…"']],
      [['pun', '    }]']],
      [['pun', '  }],']],
      [['pun', '  '], ['key', '"usage"'], ['pun', ': {']],
      [['pun', '    '], ['key', '"input_tokens"'], ['pun', ': '], ['num', '9'], ['pun', ',']],
      [['pun', '    '], ['key', '"output_tokens"'], ['pun', ': '], ['num', '18'], ['pun', ',']],
      [['pun', '    '], ['key', '"total_tokens"'], ['pun', ': '], ['num', '27']],
      [['pun', '  }']],
      [['pun', '}']],
    ],
  },
  {
    id: 'messages',
    labelKey: 'Messages',
    method: 'POST',
    endpoint: '/v1/messages',
    request: [
      [['cmd', 'curl'], ['pun', ' '], ['mut', '$APERTURE'], ['pun', '/v1/messages \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"x-api-key: sk-••••"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"anthropic-version: 2023-06-01"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Content-Type: application/json"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-d'], ['pun', ' '], ['str', '\'{']],
      [['pun', '    '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '    '], ['key', '"system"'], ['pun', ': '], ['str', '"Be brief."'], ['pun', ',']],
      [['pun', '    '], ['key', '"messages"'], ['pun', ': [']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"user"'], ['pun', ', '], ['key', '"content"'], ['pun', ': '], ['str', '"Hi"'], ['pun', ' }']],
      [['pun', '    ],']],
      [['pun', '    '], ['key', '"max_tokens"'], ['pun', ': '], ['num', '1024'], ['pun', ',']],
      [['pun', '    '], ['key', '"temperature"'], ['pun', ': '], ['num', '0.7'], ['pun', ',']],
      [['pun', '    '], ['key', '"stream"'], ['pun', ': '], ['num', 'true']],
      [['pun', '  }\'']],
    ],
    response: [
      [['pun', '{']],
      [['pun', '  '], ['key', '"id"'], ['pun', ': '], ['str', '"msg_9xK2"'], ['pun', ',']],
      [['pun', '  '], ['key', '"type"'], ['pun', ': '], ['str', '"message"'], ['pun', ',']],
      [['pun', '  '], ['key', '"role"'], ['pun', ': '], ['str', '"assistant"'], ['pun', ',']],
      [['pun', '  '], ['key', '"model"'], ['pun', ': '], ['str', '"any-upstream-model"'], ['pun', ',']],
      [['pun', '  '], ['key', '"content"'], ['pun', ': [{']],
      [['pun', '    '], ['key', '"type"'], ['pun', ': '], ['str', '"text"'], ['pun', ',']],
      [['pun', '    '], ['key', '"text"'], ['pun', ': '], ['hl', '"…"']],
      [['pun', '  }],']],
      [['pun', '  '], ['key', '"stop_reason"'], ['pun', ': '], ['str', '"end_turn"'], ['pun', ',']],
      [['pun', '  '], ['key', '"stop_sequence"'], ['pun', ': '], ['num', 'null'], ['pun', ',']],
      [['pun', '  '], ['key', '"usage"'], ['pun', ': {']],
      [['pun', '    '], ['key', '"input_tokens"'], ['pun', ': '], ['num', '12'], ['pun', ',']],
      [['pun', '    '], ['key', '"output_tokens"'], ['pun', ': '], ['num', '19']],
      [['pun', '  }']],
      [['pun', '}']],
    ],
  },
  {
    id: 'gemini',
    labelKey: 'Gemini',
    method: 'POST',
    endpoint: '/v1beta/models/{model}:generateContent',
    request: [
      [['cmd', 'curl'], ['pun', ' '], ['mut', '$APERTURE'], ['pun', '/v1beta/models/'], ['mut', '{model}'], ['pun', ':generateContent \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"x-goog-api-key: sk-••••"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-H'], ['pun', ' '], ['str', '"Content-Type: application/json"'], ['pun', ' \\']],
      [['pun', '  '], ['mut', '-d'], ['pun', ' '], ['str', '\'{']],
      [['pun', '    '], ['key', '"contents"'], ['pun', ': [']],
      [['pun', '      { '], ['key', '"role"'], ['pun', ': '], ['str', '"user"'], ['pun', ',']],
      [['pun', '        '], ['key', '"parts"'], ['pun', ': [{ '], ['key', '"text"'], ['pun', ': '], ['str', '"Hi"'], ['pun', ' }] }']],
      [['pun', '    ],']],
      [['pun', '    '], ['key', '"generationConfig"'], ['pun', ': {']],
      [['pun', '      '], ['key', '"temperature"'], ['pun', ': '], ['num', '0.7'], ['pun', ',']],
      [['pun', '      '], ['key', '"maxOutputTokens"'], ['pun', ': '], ['num', '512']],
      [['pun', '    }']],
      [['pun', '  }\'']],
    ],
    response: [
      [['pun', '{']],
      [['pun', '  '], ['key', '"candidates"'], ['pun', ': [{']],
      [['pun', '    '], ['key', '"content"'], ['pun', ': {']],
      [['pun', '      '], ['key', '"role"'], ['pun', ': '], ['str', '"model"'], ['pun', ',']],
      [['pun', '      '], ['key', '"parts"'], ['pun', ': [{ '], ['key', '"text"'], ['pun', ': '], ['hl', '"…"'], ['pun', ' }]']],
      [['pun', '    },']],
      [['pun', '    '], ['key', '"finishReason"'], ['pun', ': '], ['str', '"STOP"'], ['pun', ',']],
      [['pun', '    '], ['key', '"index"'], ['pun', ': '], ['num', '0']],
      [['pun', '  }],']],
      [['pun', '  '], ['key', '"usageMetadata"'], ['pun', ': {']],
      [['pun', '    '], ['key', '"promptTokenCount"'], ['pun', ': '], ['num', '9'], ['pun', ',']],
      [['pun', '    '], ['key', '"candidatesTokenCount"'], ['pun', ': '], ['num', '16'], ['pun', ',']],
      [['pun', '    '], ['key', '"totalTokenCount"'], ['pun', ': '], ['num', '25']],
      [['pun', '  },']],
      [['pun', '  '], ['key', '"modelVersion"'], ['pun', ': '], ['str', '"gemini-2.0"']],
      [['pun', '}']],
    ],
  },
]

const SYN_CLASS: Record<SynClass, string> = {
  cmd: 'font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]',
  key: 'text-[#48484A] dark:text-[#C7C7CC]',
  str: 'text-[#86868B]',
  num: 'font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]',
  mut: 'text-[#AEAEB2]',
  hl: 'rounded-[4px] bg-[#F2F2F4] px-[5px] font-semibold text-[#1D1D1F] dark:bg-white/[0.08] dark:text-white',
  pun: 'text-[#6E6E73] dark:text-[#A1A1A6]',
}

const LINE_REVEAL = cn(
  'block whitespace-pre animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both',
  'delay-[calc(var(--i,0)*110ms)] motion-reduce:animate-none'
)

const CYCLE_INTERVAL = 4500

interface HeroTerminalDemoProps {
  className?: string
}

export function HeroTerminalDemo(props: HeroTerminalDemoProps) {
  const { t } = useTranslation()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [activeIndex, setActiveIndex] = useState(0)
  const [revealKey, setRevealKey] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const rowRef = useRef<HTMLDivElement>(null)
  const underlineRef = useRef<HTMLSpanElement>(null)

  const syncUnderline = useCallback(() => {
    const row = rowRef.current
    const bar = underlineRef.current
    if (!row || !bar) return
    const active = row.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (!active) return
    bar.style.setProperty('--u-x', `${active.offsetLeft}px`)
    bar.style.setProperty('--u-w', `${active.offsetWidth}px`)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TERMINAL_DEMOS.length)
      setRevealKey((key) => key + 1)
    }, CYCLE_INTERVAL)
    intervalRef.current = id
    return () => clearInterval(id)
  }, [reduceMotion])

  useEffect(() => {
    syncUnderline()
  }, [activeIndex, syncUnderline])

  // Re-seat the indicator on card resize, and when the monospace webfont swaps
  // in — the swap changes each tab's width, not the row's, so watch the tabs too.
  useEffect(() => {
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => syncUnderline())
    observer.observe(row)
    row.querySelectorAll('[role="tab"]').forEach((tab) => observer.observe(tab))
    return () => observer.disconnect()
  }, [syncUnderline])

  const handleValueChange = useCallback((next: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const nextIndex = TERMINAL_DEMOS.findIndex((demo) => demo.id === next)
    if (nextIndex < 0) return
    setActiveIndex(nextIndex)
    setRevealKey((key) => key + 1)
  }, [])

  const activeDemo = TERMINAL_DEMOS[activeIndex]

  return (
    <Tabs
      value={activeDemo.id}
      onValueChange={handleValueChange}
      className={cn(
        'relative w-full gap-0 overflow-hidden rounded-2xl border border-black/10 bg-white',
        'shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none',
        props.className
      )}
    >
      {/* Tab bar — the sliding underline is positioned against this row. */}
      <div
        ref={rowRef}
        className='relative flex items-center border-b border-black/10 px-2 pt-1.5 dark:border-white/10'
      >
        <TabsList
          aria-label={t('API surfaces')}
          className={cn(
            'group/tabs-list h-auto w-fit flex-none items-center justify-start gap-1 rounded-none bg-transparent p-0',
            'text-[11px] sm:text-xs group-data-horizontal/tabs:h-auto'
          )}
        >
          {TERMINAL_DEMOS.map((demo) => (
            <TabsTrigger
              key={demo.id}
              value={demo.id}
              className={cn(
                'relative h-auto flex-none rounded-none border-0 border-b-0 bg-transparent px-2.5 py-2.5',
                'text-[11px] font-medium tracking-wide shadow-none transition-colors sm:px-3 sm:text-xs',
                'text-[#86868B] hover:text-[#0A0A0A]',
                'data-active:bg-transparent data-active:text-[#0A0A0A] data-active:shadow-none',
                'group-data-[variant=default]/tabs-list:data-active:shadow-none',
                'dark:text-white/40 dark:hover:text-white/80 dark:data-active:border-transparent',
                'dark:data-active:bg-transparent dark:data-active:text-white'
              )}
            >
              {t(demo.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <span
          ref={underlineRef}
          aria-hidden='true'
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 h-0.5 w-[var(--u-w,0px)]',
            'translate-x-[var(--u-x,0px)] rounded-t-[2px] bg-[#0A0A0A]',
            'transition-[translate,width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
            'motion-reduce:transition-none dark:bg-white'
          )}
        />

        <span className='ml-auto flex flex-none items-center gap-[7px] pr-1.5 font-mono text-[10px] tracking-[0.08em] text-[#6E6E73] uppercase dark:text-[#A1A1A6]'>
          <span
            aria-hidden='true'
            className='terminal-demo-pulse size-1.5 rounded-full bg-[#0A0A0A] dark:bg-white'
          />
          200 OK
        </span>
      </div>

      {TERMINAL_DEMOS.map((demo) => (
        <TabsContent
          key={demo.id}
          value={demo.id}
          keepMounted
          className='min-h-[340px] p-6 outline-none'
        >
          <div
            key={revealKey}
            className='grid grid-cols-1 gap-y-[26px] lg:grid-cols-2 lg:gap-y-0'
          >
            {/* Request */}
            <div className='min-w-0 lg:pr-[30px]'>
              <p className='mb-3.5 font-sans text-[10px] font-semibold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/35'>
                {t('Request')}
              </p>
              <div className='mb-[15px] flex items-center gap-[10px] border-b border-black/10 pb-[13px] dark:border-white/10'>
                <span className='flex-none rounded-[6px] border border-black/15 px-2 py-[3px] font-mono text-[10px] font-semibold tracking-[0.08em] text-[#1D1D1F] dark:border-white/20 dark:text-white'>
                  {demo.method}
                </span>
                <code className='truncate font-mono text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]'>
                  {demo.endpoint}
                </code>
              </div>
              <pre className='m-0 min-w-0 overflow-x-auto font-mono text-[13px] leading-[1.85] whitespace-normal text-[#6E6E73] dark:text-[#A1A1A6]'>
                <CodeLines lines={demo.request} />
              </pre>
            </div>

            {/* Response */}
            <div className='min-w-0 border-t border-black/10 pt-[22px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-[30px] dark:border-white/10'>
              <p className='mb-3.5 font-sans text-[10px] font-semibold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/35'>
                {t('Response')}
              </p>
              <pre className='m-0 min-w-0 overflow-x-auto font-mono text-[13px] leading-[1.85] whitespace-normal text-[#6E6E73] dark:text-[#A1A1A6]'>
                <CodeLines lines={demo.response} />
              </pre>
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

function CodeLines(props: { lines: readonly (readonly CodeToken[])[] }) {
  return props.lines.map((line, index) => (
    // eslint-disable-next-line react/no-array-index-key -- frozen literal, never reordered
    <span key={index} className={LINE_REVEAL} style={{ '--i': index } as CSSProperties}>
      {line.map((token, tokenIndex) => (
        // eslint-disable-next-line react/no-array-index-key -- token order is the identity
        <span key={tokenIndex} className={SYN_CLASS[token[0]]}>
          {token[1]}
        </span>
      ))}
    </span>
  ))
}
