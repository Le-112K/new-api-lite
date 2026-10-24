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
 * Layout, type scale and colour follow the reference measurement for
 * measurement. The colour set is VSCode Dark+ — the same palette the reference
 * uses in its code cards — applied by token role rather than by "make it look
 * green": `$` prompts take the comment green, variable names take the
 * identifier blue, values take the string orange, command names take the
 * function yellow, and tool verbs take the teal that marks a running action.
 * That is why a reader can tell at a glance which part of a line is a name and
 * which is a value; a single accent colour cannot.
 *
 * The split is ours: left runs the Anthropic protocol, right runs the OpenAI
 * one, so the two-column layout doubles as the "both API formats" proof.
 *
 * Everything is static except the cursor. A looping typing animation would
 * read as a demo; a still transcript reads as a log. The cursor blinks the way
 * a real shell cursor does — hard on/off via `visibility`, 1.4s — because a
 * soft fade reads as decoration.
 */

/** VSCode Dark+ palette, keyed by the role each colour plays in a shell line. */
const SYNTAX = {
  prompt: '#6A9955', // $ — comment green
  key: '#9CDCFE', // ANTHROPIC_BASE_URL — identifier blue
  eq: '#D4D4D4', // = — plain
  str: '#CE9178', // "https://…" — string orange
  cmd: '#DCDCAA', // claude — function yellow
  step: '#4EC9B0', // ● Read — teal, marks a running tool
  file: '#D4D4D4', // src/routes/login.ts — plain
  add: '#89D185', // +38
  del: '#F14C4C', // −4
  ok: '#89D185', // ✓
}

export function HeroConsole(props: { className?: string }) {
  const origin =
    typeof window === 'undefined' ? 'https://your-gateway.com' : window.location.origin

  return (
    <div
      className={
        'lp-mono overflow-hidden rounded-[16px] border border-black/[0.11] bg-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.3),0_28px_60px_-28px_rgba(0,0,0,0.5)] dark:border-white/10 dark:bg-[#141416] ' +
        (props.className ?? '')
      }
    >
      {/* Title bar — 41px tall: 12px padding plus the 17px line box */}
      <div className='relative flex items-center justify-center border-b border-white/10 px-4 py-3'>
        <div className='absolute left-4 flex gap-1.5'>
          <span className='size-2.5 rounded-full bg-white/25' />
          <span className='size-2.5 rounded-full bg-white/25' />
          <span className='size-2.5 rounded-full bg-white/25' />
        </div>
        <span className='text-[12px] text-white/45'>~/app — zsh</span>
      </div>

      <div className='grid grid-cols-1 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0'>
        <Pane
          tool='claude'
          env={[
            ['ANTHROPIC_BASE_URL', origin],
            ['ANTHROPIC_AUTH_TOKEN', 'apx_live_••••d41e'],
          ]}
          run='claude'
          meta='Claude Code · sonnet-5.5 · gateway'
          ask='Rate-limit /login and add tests'
          steps={[
            ['Read', 'src/routes/login.ts'],
            ['Edit', 'src/routes/login.ts', '+38', '−4'],
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
          ask='Add soft delete to invoices'
          steps={[
            ['Edit', 'db/schema.ts', '+12', '−2'],
            ['Write', 'db/migrations/0042.sql', '+19'],
            ['Run', 'pnpm test  42 passed'],
          ]}
          done='Done  ·  2 files  ·  31k tokens'
        />
      </div>
    </div>
  )
}

/**
 * One CLI session. Both panes share this shape so they line up row for row.
 *
 * Diff counts sit on their own line, indented to a fixed column rather than to
 * the end of the filename: the reference keeps `+38` at the same x for every
 * verb, and a fixed indent is what makes the two panes read as aligned columns
 * instead of ragged text.
 */
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
      <div className='mb-3 flex items-center gap-1.5 text-[12px] text-white/55'>
        <span className='text-[13px] leading-none'>✳</span>
        <span>{props.tool}</span>
      </div>

      <div className='min-w-0 text-[13.5px] leading-[25px]'>
        {/* 整行是一个内联流，而不是「$ + key=value」两个 flex 子项：
            flex-wrap 会在超宽时把 `$` 单独挤成一行，真实终端是 `$` 留在行首、
            长 URL 在中间断开。用 break-all 让任意位置都能断。 */}
        {props.env.map(([key, value]) => (
          <div key={key} className='break-all'>
            <span style={{ color: SYNTAX.prompt }}>$</span>{' '}
            <span style={{ color: SYNTAX.key }}>{key}</span>
            <span style={{ color: SYNTAX.eq }}>=</span>
            <span style={{ color: SYNTAX.str }}>{value}</span>
          </div>
        ))}
        <div className='break-all'>
          <span style={{ color: SYNTAX.prompt }}>$</span>{' '}
          <span style={{ color: SYNTAX.cmd }}>{props.run}</span>
        </div>

        <div className='mt-3 text-white/40'>{props.meta}</div>

        <div className='mt-2.5 flex items-baseline gap-2'>
          <span className='text-white/35'>›</span>
          <span className='text-white'>{props.ask}</span>
        </div>

        <div className='mt-2 space-y-[3px]'>
          {props.steps.map(([verb, file, add, del]) => (
            <div key={file}>
              <div className='flex items-baseline gap-x-2'>
                <span style={{ color: SYNTAX.step }}>●</span>
                <span style={{ color: SYNTAX.step }}>{verb}</span>
                <span style={{ color: SYNTAX.file }}>{file}</span>
              </div>
              {add || del ? (
                <div className='flex items-baseline gap-x-3 pl-[46px]'>
                  {add ? <span style={{ color: SYNTAX.add }}>{add}</span> : null}
                  {del ? <span style={{ color: SYNTAX.del }}>{del}</span> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className='mt-3 flex items-center gap-2'>
          <span style={{ color: SYNTAX.ok }}>✓</span>
          <span className='text-white'>{props.done}</span>
        </div>

        <div className='mt-2 flex items-center gap-2'>
          <span style={{ color: SYNTAX.prompt }}>$</span>
          {/* Hard blink (visibility, not opacity) so it reads as a shell cursor. */}
          <span className='lp-cursor inline-block h-[14px] w-[7px] bg-white/75' />
        </div>
      </div>
    </div>
  )
}
