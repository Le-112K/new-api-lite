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
 *
 * Height is not content-driven: the reference pins the body at `lg:min-h-[480px]`
 * so the window keeps its presence even when a pane runs short. Reproducing
 * that floor is what restores the 523px card — without it the same transcript
 * renders 64px shorter and the hero reads as a thin strip.
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
      {/* Title bar — 41px: 12px padding plus a 17px line box */}
      <div className='relative flex items-center justify-center border-b border-white/10 px-4 py-3'>
        <div className='absolute left-4 flex gap-1.5' aria-hidden>
          <span className='size-2.5 rounded-full bg-white/25' />
          <span className='size-2.5 rounded-full bg-white/25' />
          <span className='size-2.5 rounded-full bg-white/25' />
        </div>
        <span className='text-[12px] leading-[17px] text-white/45'>~/app — zsh</span>
      </div>

      {/* Body floor: 380px on small screens, 480px from lg up. */}
      <div className='grid min-h-[380px] grid-cols-1 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0 lg:min-h-[480px]'>
        <Pane
          tool='claude'
          env={[
            ['ANTHROPIC_BASE_URL', origin],
            ['ANTHROPIC_AUTH_TOKEN', 'apx_live_••••d41e'],
          ]}
          run='claude'
          meta='Claude Code  ·  sonnet-5.5  ·  gateway'
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
          meta='Codex  ·  gpt-6-luna  ·  gateway'
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
 * The pane is `flex-col` with a bordered 41px header row and a 20px-padded
 * transcript below; that split is what gives the window its proportions. Every
 * transcript row is `flex gap-2.5` with a fixed 12px gutter, so `$`, `●`, `›`
 * and `✓` all sit on one vertical rail and the text column lines up across
 * rows. Diff counts go on their own row, indented a further 24px — the
 * reference keeps `+38` at the same x for every verb, and a fixed indent is
 * what makes the two panes read as aligned columns rather than ragged text.
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
    <div className='flex min-w-0 flex-col'>
      {/* Session header — 41px, its own hairline. */}
      <div className='flex items-center gap-2 border-b border-white/10 px-5 py-3'>
        <span className='text-[14px] leading-none text-white/55' aria-hidden>
          ✳
        </span>
        <span className='truncate text-[12px] leading-4 text-white/55'>{props.tool}</span>
      </div>

      <div className='flex-1 overflow-hidden px-5 py-5 text-[13.5px] leading-[25px]'>
        {props.env.map(([key, value]) => (
          <Row key={key} gutter='$' gutterColor={SYNTAX.prompt}>
            <span style={{ color: SYNTAX.key }}>{key}</span>
            <span style={{ color: SYNTAX.eq }}>=</span>
            <span style={{ color: SYNTAX.str }}>{value}</span>
          </Row>
        ))}
        <Row gutter='$' gutterColor={SYNTAX.prompt}>
          <span style={{ color: SYNTAX.cmd }}>{props.run}</span>
        </Row>

        {/* Empty gutter keeps the meta line on the same text rail. */}
        <Row className='mt-2 mb-1'>
          <span className='text-white/40'>{props.meta}</span>
        </Row>

        <Row className='mt-3' gutter='›' gutterColor='rgba(255,255,255,0.35)'>
          <span className='text-white'>{props.ask}</span>
        </Row>

        {props.steps.map(([verb, file, add, del]) => (
          <div key={file}>
            <Row gutter='●' gutterColor={SYNTAX.step}>
              <span style={{ color: SYNTAX.step }}>{verb}</span>{' '}
              <span style={{ color: SYNTAX.file }}>{file}</span>
            </Row>
            {add || del ? (
              <Row className='pl-6'>
                {add ? <span style={{ color: SYNTAX.add }}>{add}</span> : null}
                {del ? <span style={{ color: SYNTAX.del }}>{del}</span> : null}
              </Row>
            ) : null}
          </div>
        ))}

        <Row className='mt-2.5' gutter='✓' gutterColor={SYNTAX.ok}>
          <span className='text-white'>{props.done}</span>
        </Row>

        <Row className='mt-1' gutter='$' gutterColor={SYNTAX.prompt}>
          {/* Hard blink (visibility, not opacity) so it reads as a shell cursor. */}
          <span className='lp-cursor inline-block h-[14px] w-[7px] bg-white/75' />
        </Row>
      </div>
    </div>
  )
}

/**
 * One transcript row: a fixed 12px gutter for the prompt/bullet, then the text
 * column. `whitespace-pre` keeps the double spaces in the metadata lines, and
 * the text column truncates with an ellipsis rather than wrapping — a wrapped
 * URL would break the column rail that makes the two panes readable.
 */
function Row(props: {
  children: React.ReactNode
  gutter?: string
  gutterColor?: string
  className?: string
}) {
  return (
    <div
      className={
        'flex gap-2.5 whitespace-pre ' + (props.className ?? '')
      }
    >
      <span
        className='w-3 shrink-0 select-none text-center'
        style={props.gutterColor ? { color: props.gutterColor } : undefined}
        aria-hidden
      >
        {props.gutter ?? ''}
      </span>
      <span className='min-w-0 overflow-hidden text-ellipsis'>{props.children}</span>
    </div>
  )
}
