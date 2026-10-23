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
/**
 * The hero's proof object: one dark console, two rows, two protocols.
 *
 * A marketing page for an API gateway has exactly one thing to prove before
 * anyone reads a feature list — that pointing an existing CLI at this base URL
 * actually works. So the visual is not an illustration but a transcript: the
 * two `export` lines a user will really type, the agent that answers, and the
 * token count that comes back. The rows are the two protocols side by side
 * (Anthropic messages / OpenAI chat completions), which is the product's
 * single strongest claim, stated without a sentence of copy.
 *
 * Everything is static: no timers, no fake streaming. A looping animation here
 * would read as a demo; a still transcript reads as a log.
 */
export function HeroConsole(props: { className?: string }) {
  const origin =
    typeof window === 'undefined' ? 'https://your-gateway.com' : window.location.origin

  return (
    <div
      className={
        'overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0C] dark:border-white/[0.07] dark:bg-[#141416] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.16)] ' +
        (props.className ?? '')
      }
    >
      {/* Title bar — three dots, a caption, and the only saturated mark on the
          card, which tells the eye the transcript ended successfully. */}
      <div className='flex items-center justify-between border-b border-white/[0.08] px-5 py-3'>
        <div className='flex items-center gap-3'>
          <div className='flex gap-1.5'>
            <span className='size-2 rounded-full bg-white/15' />
            <span className='size-2 rounded-full bg-white/15' />
            <span className='size-2 rounded-full bg-white/15' />
          </div>
          <span className='font-mono text-[11px] tracking-[0.06em] text-white/35'>
            one key · two protocols
          </span>
        </div>
        <span className='flex items-center gap-1.5 font-mono text-[11px] text-white/40'>
          <span className='size-1.5 rounded-full bg-[#6EE7A8]' />
          200 OK
        </span>
      </div>

      <ConsoleRow
        tool='claude'
        protocol='Anthropic messages'
        lines={[
          ['export', 'ANTHROPIC_BASE_URL', `"${origin}"`],
          ['export', 'ANTHROPIC_AUTH_TOKEN', '"sk-live-••••7f2a"'],
        ]}
        command='claude'
        prompt='fix the failing login test'
        steps={['read  src/routes/login.ts', 'edit  +38 −4', 'test  42 passed']}
        meta='8.4k tokens · 1.2s'
      />

      <ConsoleRow
        className='border-t border-white/[0.08]'
        tool='codex'
        protocol='OpenAI chat'
        lines={[
          ['export', 'OPENAI_BASE_URL', `"${origin}/v1"`],
          ['export', 'OPENAI_API_KEY', '"sk-live-••••7f2a"'],
        ]}
        command='codex'
        prompt='add soft delete to invoices'
        steps={['edit  db/schema.ts', 'new   0042_soft_delete.sql', 'test  42 passed']}
        meta='6.1k tokens · 0.9s'
      />
    </div>
  )
}

/**
 * One CLI session. The left gutter names the tool, the body is the transcript.
 * Keeping the tool name out of the transcript lines means the two rows line up
 * typographically even though one is an Anthropic client and one is an OpenAI
 * client.
 */
function ConsoleRow(props: {
  tool: string
  protocol: string
  lines: [string, string, string][]
  command: string
  prompt: string
  steps: string[]
  meta: string
  className?: string
}) {
  return (
    <div
      className={
        'grid grid-cols-[62px_1fr] gap-x-3 px-4 py-5 sm:px-5 md:grid-cols-[84px_1fr] md:gap-x-4 ' +
        (props.className ?? '')
      }
    >
      <div className='pt-0.5'>
        <div className='font-mono text-[12.5px] text-white/80'>{props.tool}</div>
        <div className='mt-1 font-mono text-[10px] leading-[1.4] text-white/25'>
          {props.protocol}
        </div>
      </div>

      <div className='min-w-0 font-mono text-[12px] leading-[1.85] text-white/55'>
        {/* The export lines wrap instead of truncating: the base URL is the one
            string on this card a visitor actually needs to read, and an ellipsis
            that eats everything after `https://` would defeat the whole block on
            a phone. */}
        {props.lines.map((line) => (
          <div key={line[1]} className='flex flex-wrap items-baseline gap-x-1'>
            <span className='text-white/25'>$</span>
            <span className='text-white/30'>{line[0]}</span>
            <span className='text-white/55'>{line[1]}</span>
            <span className='break-all text-white/80'>{`=${line[2]}`}</span>
          </div>
        ))}
        <div className='mt-1 flex flex-wrap items-baseline gap-x-1.5'>
          <span className='text-white/25'>$</span>
          <span className='text-white/75'>{props.command}</span>
          <span className='text-white/25'>›</span>
          <span className='text-white/45'>{props.prompt}</span>
          <span className='inline-block h-3 w-1.5 translate-y-[2px] bg-white/50 align-baseline motion-safe:animate-pulse' />
        </div>
        <div className='mt-1.5 space-y-[1px]'>
          {props.steps.map((step) => (
            <div key={step} className='flex items-center gap-2 text-white/40'>
              <span className='text-[#6EE7A8]'>✓</span>
              <span className='truncate'>{step}</span>
            </div>
          ))}
        </div>
        <div className='mt-2 text-[10.5px] text-white/30'>{props.meta}</div>
      </div>
    </div>
  )
}
