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

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AccentTone = 'bw'

interface ApiDemoConfig {
  id: string
  label: string
  method: 'POST' | 'GET'
  endpoint: string
  headers: string[]
  request: string[]
  response: string[]
  responseHighlights: string[]
  tokens: number
  latency: number
  accent: AccentTone
}

// Apple BW: single monochrome accent — black active, gray idle
const ACCENT_CLASSES: Record<
  AccentTone,
  {
    activeText: string
    activeBorder: string
    badge: string
  }
> = {
  bw: {
    activeText: 'text-[#0a0a0a] dark:text-white',
    activeBorder: 'border-[#0a0a0a] dark:border-white',
    badge: 'bg-[#0a0a0a] text-white dark:bg-white dark:text-black',
  },
}

const API_DEMOS: ApiDemoConfig[] = [
  {
    id: 'gpt-chat',
    label: 'Chat',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    headers: ['"Authorization: Bearer sk-••••"'],
    request: [
      '"model": "your-model",',
      '"messages": [',
      '  { "role": "user", "content": "..." }',
      ']',
    ],
    response: [
      '{',
      '  "choices": [{ "message": { "content": <text> } }],',
      '  "usage": { "total_tokens": <tokens> }',
      '}',
    ],
    responseHighlights: ['<text>', '<tokens>'],
    tokens: 27,
    latency: 142,
    accent: 'bw',
  },
  {
    id: 'responses',
    label: 'Responses',
    method: 'POST',
    endpoint: '/v1/responses',
    headers: ['"Authorization: Bearer sk-••••"'],
    request: ['"model": "your-model",', '"input": "..."'],
    response: [
      '{',
      '  "output": [{ "type": "output_text", "text": <text> }],',
      '  "usage": { "total_tokens": <tokens> }',
      '}',
    ],
    responseHighlights: ['<text>', '<tokens>'],
    tokens: 31,
    latency: 168,
    accent: 'bw',
  },
  {
    id: 'claude',
    label: 'Claude',
    method: 'POST',
    endpoint: '/v1/messages',
    headers: ['"x-api-key: sk-••••"', '"anthropic-version: 2023-06-01"'],
    request: [
      '"model": "your-model",',
      '"max_tokens": 1024,',
      '"messages": [',
      '  { "role": "user", "content": "..." }',
      ']',
    ],
    response: [
      '{',
      '  "content": [{ "type": "text", "text": <text> }],',
      '  "usage": { "input_tokens": <in>, "output_tokens": <out> }',
      '}',
    ],
    responseHighlights: ['<text>', '<in>', '<out>'],
    tokens: 29,
    latency: 156,
    accent: 'bw',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    method: 'POST',
    endpoint: '/v1beta/models/{model}:generateContent',
    headers: ['"x-goog-api-key: sk-••••"'],
    request: [
      '"contents": [',
      '  { "role": "user",',
      '    "parts": [{ "text": "..." }] }',
      ']',
    ],
    response: [
      '{',
      '  "candidates": [{ "content": { "parts": [{ "text": <text> }] } }],',
      '  "usageMetadata": { "totalTokenCount": <tokens> }',
      '}',
    ],
    responseHighlights: ['<text>', '<tokens>'],
    tokens: 25,
    latency: 93,
    accent: 'bw',
  },
]

const CYCLE_INTERVAL = 4500
const TRANSITION_MS = 220

interface HeroTerminalDemoProps {
  className?: string
}

export function HeroTerminalDemo(props: HeroTerminalDemoProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    intervalRef.current = setInterval(() => {
      setTransitioning(true)
      timeoutRef.current = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % API_DEMOS.length)
        setTransitioning(false)
      }, TRANSITION_MS)
    }, CYCLE_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleSelect = (index: number) => {
    if (index === activeIndex) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setTransitioning(true)
    timeoutRef.current = setTimeout(() => {
      setActiveIndex(index)
      setTransitioning(false)
    }, TRANSITION_MS)
  }

  const demo = API_DEMOS[activeIndex]
  const accent = ACCENT_CLASSES[demo.accent]

  return (
    <div className={cn('mx-auto w-full max-w-2xl', props.className)}>
      <div
        className={cn(
          'overflow-hidden rounded-[20px] border backdrop-blur-sm',
          'border-black/10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]',
          'dark:border-white/10 dark:bg-[#141414] dark:shadow-none'
        )}
      >
        {/* Tab strip — BW */}
        <div
          className={cn(
            'flex items-center gap-1 border-b px-2 sm:gap-1.5 sm:px-3',
            'border-black/10 dark:border-white/10'
          )}
        >
          {API_DEMOS.map((item, index) => {
            const tone = ACCENT_CLASSES[item.accent]
            const isActive = index === activeIndex
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(index)}
                className={cn(
                  'relative -mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[11px] font-medium tracking-wide transition-colors sm:px-3 sm:text-xs',
                  isActive
                    ? `${tone.activeBorder} ${tone.activeText}`
                    : 'border-transparent text-[#86868B] hover:text-[#0a0a0a] dark:text-white/40 dark:hover:text-white/80'
                )}
              >
                {item.label}
              </button>
            )
          })}
          <div className='ml-auto flex items-center gap-2 pr-2 sm:pr-3'>
            <span className='inline-block size-1.5 rounded-full bg-[#0a0a0a] dark:bg-white' />
            <span className='font-mono text-[10px] tracking-wider text-[#86868B] uppercase dark:text-white/40'>
              200 ok
            </span>
          </div>
        </div>

        {/* Endpoint row */}
        <div
          className={cn(
            'flex items-center gap-2.5 border-b bg-[#FBFBFB] px-5 py-3 dark:bg-white/[0.04]',
            'border-black/10 dark:border-white/10'
          )}
        >
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider',
              accent.badge
            )}
          >
            {demo.method}
          </span>
          <code
            className={cn(
              'truncate font-mono text-[12.5px] text-[#1d1d1f] transition-opacity duration-200 dark:text-white/70',
              transitioning ? 'opacity-0' : 'opacity-100'
            )}
          >
            {demo.endpoint}
          </code>
        </div>

        {/* Body — fixed rows so neither block shifts when switching demos */}
        <div className='grid h-[400px] grid-rows-[235px_minmax(0,1fr)] font-mono text-[12.5px] leading-[1.55]'>
          {/* Request */}
          <RequestBlock demo={demo} transitioning={transitioning} />

          {/* Response */}
          <ResponseBlock demo={demo} transitioning={transitioning} />
        </div>

        {/* Footer metrics — muted */}
        <div
          className={cn(
            'flex items-center justify-between border-t bg-[#FBFBFB] px-5 py-2.5 dark:bg-white/[0.03]',
            'border-black/10 dark:border-white/10'
          )}
        >
          <div className='flex items-center gap-3 text-[10px] tabular-nums text-[#86868B] dark:text-white/40'>
            <span className='flex items-center gap-1'>
              <span className='font-mono text-[#0a0a0a] dark:text-white'>{demo.latency}</span>
              <span className='tracking-wider uppercase'>ms</span>
            </span>
            <span className='size-1 rounded-full bg-black/10 dark:bg-white/15' />
            <span className='flex items-center gap-1'>
              <span className='font-mono text-[#0a0a0a] dark:text-white'>{demo.tokens}</span>
              <span className='tracking-wider uppercase'>tokens</span>
            </span>
            <span className='size-1 rounded-full bg-black/10 dark:bg-white/15' />
            <span className='flex items-center gap-1'>
              <span className='tracking-wider uppercase'>cost</span>
              <span className='font-mono text-[#0a0a0a] dark:text-white'>
                ${(demo.tokens * 0.00003).toFixed(5)}
              </span>
            </span>
          </div>
          <span className='font-mono text-[10px] tracking-wider text-[#86868B] uppercase dark:text-white/30'>
            stream · sse
          </span>
        </div>
      </div>
    </div>
  )
}

function RequestBlock(props: { demo: ApiDemoConfig; transitioning: boolean }) {
  const { demo, transitioning } = props

  return (
    <div className='relative bg-white px-5 py-4 dark:bg-[#141414]'>
      <SectionLabel>Request</SectionLabel>
      <div
        className={cn(
          'mt-2 transition-opacity duration-200',
          transitioning ? 'opacity-0' : 'opacity-100'
        )}
      >
        <CodeLine>
          <Command>curl</Command> <Flag>-X</Flag> <Flag>POST</Flag>{' '}
          <StringText>&quot;{demo.endpoint}&quot;</StringText>{' '}
          <Muted>{'\\'}</Muted>
        </CodeLine>
        {demo.headers.map((header) => (
          <CodeLine key={header} indent={2}>
            <Flag>-H</Flag> <StringText>{header}</StringText>{' '}
            <Muted>{'\\'}</Muted>
          </CodeLine>
        ))}
        <CodeLine indent={2}>
          <Flag>-d</Flag> <StringText>&apos;{'{'}</StringText>
        </CodeLine>
        {demo.request.map((line, i) => (
          <CodeLine key={i} indent={4}>
            {renderJsonLine(line)}
          </CodeLine>
        ))}
        <CodeLine indent={2}>
          <StringText>{'}'}&apos;</StringText>
        </CodeLine>
      </div>
    </div>
  )
}

function ResponseBlock(props: { demo: ApiDemoConfig; transitioning: boolean }) {
  const { demo, transitioning } = props

  return (
    <div
      className={cn(
        'relative border-t bg-[#FBFBFB] px-5 py-4 dark:bg-white/[0.02]',
        'border-black/10 dark:border-white/10'
      )}
    >
      <SectionLabel>Response</SectionLabel>
      <div
        className={cn(
          'mt-2 transition-opacity duration-200',
          transitioning ? 'opacity-0' : 'opacity-100'
        )}
      >
        {demo.response.map((line, i) => (
          <CodeLine key={i}>{renderResponseLine(line, demo)}</CodeLine>
        ))}
      </div>
    </div>
  )
}

function SectionLabel(props: { children: ReactNode }) {
  return (
    <span className='font-sans text-[10px] font-semibold tracking-[0.14em] text-[#86868B] uppercase dark:text-white/35'>
      {props.children}
    </span>
  )
}

const STRING_RE = /"[^"]*"/g
const PLACEHOLDER_RE = /<[a-z]+>/gi

function renderJsonLine(line: string): ReactNode {
  if (!line.trim()) return <Muted> </Muted>
  return tokenize(line)
}

function renderResponseLine(line: string, demo: ApiDemoConfig): ReactNode {
  if (!line.trim()) return <Muted> </Muted>

  const segments: ReactNode[] = []
  let cursor = 0
  const matches = [...line.matchAll(PLACEHOLDER_RE)]

  if (matches.length === 0) return tokenize(line)

  matches.forEach((match, idx) => {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push(
        <span key={`pre-${idx}`}>{tokenize(line.slice(cursor, start))}</span>
      )
    }
    const placeholder = match[0]
    if (placeholder === '<text>') {
      segments.push(
        <Accent key={`ph-${idx}`} accent={demo.accent}>
          {`"${truncateResponse(demo)}"`}
        </Accent>
      )
    } else if (placeholder === '<tokens>') {
      segments.push(<NumberText key={`ph-${idx}`}>{demo.tokens}</NumberText>)
    } else if (placeholder === '<in>') {
      segments.push(
        <NumberText key={`ph-${idx}`}>
          {Math.floor(demo.tokens * 0.4)}
        </NumberText>
      )
    } else if (placeholder === '<out>') {
      segments.push(
        <NumberText key={`ph-${idx}`}>
          {Math.ceil(demo.tokens * 0.6)}
        </NumberText>
      )
    } else {
      segments.push(<Muted key={`ph-${idx}`}>{placeholder}</Muted>)
    }
    cursor = start + placeholder.length
  })

  if (cursor < line.length) {
    segments.push(<span key='tail'>{tokenize(line.slice(cursor))}</span>)
  }

  return segments
}

function truncateResponse(demo: ApiDemoConfig): string {
  const map: Record<string, string> = {
    'gpt-chat': 'Chat request routed.',
    responses: 'Response workflow ready.',
    claude: 'Claude message routed.',
    gemini: 'Gemini request served.',
  }
  return map[demo.id] ?? '...'
}

function tokenize(input: string): ReactNode {
  const segments: ReactNode[] = []
  let cursor = 0
  const matches = [...input.matchAll(STRING_RE)]

  matches.forEach((match, idx) => {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push(
        <Muted key={`m-${idx}`}>{input.slice(cursor, start)}</Muted>
      )
    }
    const text = match[0]
    const after = input.slice(start + text.length).trimStart()
    const isKey = after.startsWith(':')
    if (isKey) {
      segments.push(<Key key={`k-${idx}`}>{text}</Key>)
    } else {
      segments.push(<StringText key={`s-${idx}`}>{text}</StringText>)
    }
    cursor = start + text.length
  })

  if (cursor < input.length) {
    segments.push(<Muted key='tail'>{input.slice(cursor)}</Muted>)
  }

  return segments
}

function CodeLine(props: { children: ReactNode; indent?: number }) {
  return (
    <div className='break-words whitespace-pre-wrap'>
      {props.indent ? (
        <span
          aria-hidden
          className='inline-block'
          style={{ width: `${props.indent}ch` }}
        />
      ) : null}
      {props.children}
    </div>
  )
}

function Command(props: { children: ReactNode }) {
  return (
    <span className='font-medium text-[#0a0a0a] dark:text-white'>{props.children}</span>
  )
}

function Flag(props: { children: ReactNode }) {
  return <span className='text-[#6E6E73] dark:text-white/60'>{props.children}</span>
}

function Key(props: { children: ReactNode }) {
  return <span className='text-[#0a0a0a] dark:text-white'>{props.children}</span>
}

function StringText(props: { children: ReactNode }) {
  return <span className='text-[#6E6E73] dark:text-white/55'>{props.children}</span>
}

function NumberText(props: { children: ReactNode }) {
  return <span className='font-medium text-[#0a0a0a] dark:text-white'>{props.children}</span>
}

function Muted(props: { children: ReactNode }) {
  return <span className='text-[#86868B] dark:text-white/35'>{props.children}</span>
}

function Accent(props: { children: ReactNode; accent: AccentTone }) {
  const tone = ACCENT_CLASSES[props.accent]
  return (
    <span className={cn('font-medium', tone.activeText)}>{props.children}</span>
  )
}
