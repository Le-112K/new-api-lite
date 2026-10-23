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
 * The hero's proof object: one terminal window, two CLI sessions side by side.
 *
 * Layout and colour follow the reference (apmix.ai) measurement for measurement
 * — 16px radius, `#0a0a0a` surface, a `~/app — zsh` title bar, a hairline
 * divider between the panes, and a shell's own colour language: green `$`,
 * green tool bullets, green/red diff counts, dim metadata. A developer
 * recognises this as a real transcript in about a second, which is the only
 * claim a gateway page has to make before the fold.
 *
 * The split is ours: left runs the Anthropic protocol, right runs the OpenAI
 * one, so the two-column layout doubles as the "both API formats" proof.
 *
 * Everything is static. A looping animation would read as a demo; a still
 * transcript reads as a log.
 */
export function HeroConsole(props: { className?: string }) {
  const origin =
    typeof window === 'undefined' ? 'https://your-gateway.com' : window.location.origin

  return (
    <div
      className={
        'overflow-hidden rounded-2xl bg-[#0a0a0a] dark:bg-[#141416] shadow-[0_1px_2px_rgba(0,0,0,0.3),0_28px_60px_-28px_rgba(0,0,0,0.5)] ' +
        (props.className ?? '')
      }
    >
      {/* Title bar */}
      <div className='relative flex items-center justify-center border-b border-white/[0.08] px-4 py-2.5'>
        <div className='absolute left-4 flex gap-1.5'>
          <span className='size-2.5 rounded-full bg-white/[0.14]' />
          <span className='size-2.5 rounded-full bg-white/[0.14]' />
          <span className='size-2.5 rounded-full bg-white/[0.14]' />
        </div>
        <span className='lp-mono text-[11.5px] text-white/40'>~/app — zsh</span>
      </div>

      <div className='grid grid-cols-1 divide-y divide-white/[0.08] md:grid-cols-2 md:divide-x md:divide-y-0'>
        <Pane
          tool='claude'
          env={[
            ['ANTHROPIC_BASE_URL', origin],
            ['ANTHROPIC_AUTH_TOKEN', 'apx_live_••••d41e'],
          ]}
          run='claude'
          meta='Claude Code · sonnet-5.5 · gateway'
          ask='rate-limit /login and add tests'
          steps={[
            ['Read', 'src/routes/login.ts'],
            ['Edit', 'src/routes/login.ts', '+38', '-4'],
            ['Write', 'tests/login.test.ts', '+61'],
          ]}
          done='Done  ·  2 files  ·  48k tokens'
        />
        <Pane
          tool='codex'
          env={[
            ['OPENAI_BASE_URL', `${origin}/v1`],
            ['OPENAI_API_KEY', 'apx_live_••••d41e'],
          ]}
          run='codex "soft-delete invoices"'
          meta='Codex · gpt-6-luna · gateway'
          ask='add soft delete to invoices'
          steps={[
            ['Edit', 'db/schema.ts', '+12', '-2'],
            ['Write', 'db/migrations/0042.sql', '+19'],
            ['Run', 'pnpm test  42 passed'],
          ]}
          done='Done  ·  2 files  ·  31k tokens'
        />
      </div>
    </div>
  )
}

/** One CLI session. Both panes share this shape so they line up row for row. */
function Pane(props: {
  tool: string
  env: [string, string][]
  run: string
  meta: string
  ask: string
  steps: [string, string, string?, string?][]
  done: string
}) {
  return (
    <div className='min-w-0 px-4 py-3.5'>
      <div className='lp-mono mb-3 flex items-center gap-1.5 text-[11.5px] text-white/50'>
        <span className='text-[13px] leading-none'>✳</span>
        <span>{props.tool}</span>
      </div>

      <div className='lp-mono min-w-0 text-[11px] leading-[1.85]'>
        {props.env.map(([key, value]) => (
          <div key={key} className='flex flex-wrap items-baseline gap-x-1'>
            <span className='text-[#3fb950]'>$</span>
            <span className='break-all'>
              <span className='text-[#7ee787]'>{key}</span>
              <span className='text-white/30'>=</span>
              <span className='text-white/85'>{value}</span>
            </span>
          </div>
        ))}
        <div className='flex items-baseline gap-x-1'>
          <span className='text-[#3fb950]'>$</span>
          <span className='text-white/85'>{props.run}</span>
        </div>

        <div className='mt-3 text-[10.5px] text-white/30'>{props.meta}</div>

        <div className='mt-2.5 flex items-baseline gap-2'>
          <span className='text-white/30'>›</span>
          <span className='text-white/85'>{props.ask}</span>
        </div>

        <div className='mt-2 space-y-[3px]'>
          {props.steps.map(([verb, file, add, del]) => (
            <div key={file} className='flex flex-wrap items-baseline gap-x-2'>
              <span className='text-[#3fb950]'>●</span>
              <span className='w-10 shrink-0 text-white/60'>{verb}</span>
              <span className='text-white/70'>{file}</span>
              {add ? <span className='text-[#3fb950]'>{add}</span> : null}
              {del ? <span className='text-[#f85149]'>{del}</span> : null}
            </div>
          ))}
        </div>

        <div className='mt-3 flex items-center gap-2 text-white/55'>
          <span className='text-[#3fb950]'>✓</span>
          <span>{props.done}</span>
        </div>

        <div className='mt-2 flex items-center gap-2'>
          <span className='text-[#3fb950]'>$</span>
          <span className='inline-block h-3 w-1.5 bg-white/70 motion-safe:animate-pulse' />
        </div>
      </div>
    </div>
  )
}
