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
 * Console chart colour bridge.
 *
 * The flow sankey and the user analytics charts render through
 * `@visactor/react-vchart`, i.e. a `<canvas>` — a canvas `fill` cannot hold a
 * CSS custom property, so those charts must be handed concrete colour strings.
 * Rather than duplicate the palette in TypeScript (which the console design
 * spec forbids: `styles/console-tokens.css` is the single source of truth),
 * this module reads the *computed* value of the tokens off the document root.
 *
 * Only token **names** appear below; every value lives in
 * `styles/console-tokens.css` (spec §2 categorical ramp, §7 chart structure).
 */

/** `--cat-1..7`: the CVD-checked categorical ramp. `--cat-7` = neutral catch-all. */
export const CONSOLE_CATEGORICAL_VARS = [
  '--cat-1',
  '--cat-2',
  '--cat-3',
  '--cat-4',
  '--cat-5',
  '--cat-6',
  '--cat-7',
] as const

const STRUCTURAL_VARS = {
  text: '--cx-text',
  text2: '--cx-text-2',
  text3: '--cx-text-3',
  line: '--cx-line',
  lineStrong: '--cx-line-strong',
  fill1: '--cx-fill-1',
  chartGrid: '--cx-chart-grid',
  chartAxis: '--cx-chart-axis',
  tickBg: '--cx-chart-tick-bg',
  tickFg: '--cx-chart-tick-fg',
  divUp: '--div-up-2',
  divDown: '--div-down-2',
  successStrong: '--success-strong',
  warningStrong: '--warning-strong',
  destructiveStrong: '--destructive-strong',
} as const

export interface ConsoleChartTokens {
  /** Resolved `--cat-1..7`, in ramp order. */
  categorical: readonly string[]
  text: string
  text2: string
  text3: string
  line: string
  lineStrong: string
  fill1: string
  chartGrid: string
  chartAxis: string
  tickBg: string
  tickFg: string
  divUp: string
  divDown: string
  successStrong: string
  warningStrong: string
  destructiveStrong: string
}

const EMPTY_TOKENS: ConsoleChartTokens = {
  categorical: CONSOLE_CATEGORICAL_VARS.map(() => ''),
  text: '',
  text2: '',
  text3: '',
  line: '',
  lineStrong: '',
  fill1: '',
  chartGrid: '',
  chartAxis: '',
  tickBg: '',
  tickFg: '',
  divUp: '',
  divDown: '',
  successStrong: '',
  warningStrong: '',
  destructiveStrong: '',
}

function readVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim()
}

/**
 * Snapshot the console tokens currently in effect. Call from an effect (never
 * during SSR): `getComputedStyle` needs a live document, and the values flip
 * with the `light`/`dark` class the theme provider puts on `<html>`.
 */
export function getConsoleChartTokens(
  root: HTMLElement | null = typeof document === 'undefined'
    ? null
    : document.documentElement
): ConsoleChartTokens {
  if (!root || typeof window === 'undefined') return EMPTY_TOKENS

  const styles = window.getComputedStyle(root)
  const resolve = (name: string) => readVar(styles, name)

  return {
    categorical: CONSOLE_CATEGORICAL_VARS.map(resolve),
    text: resolve(STRUCTURAL_VARS.text),
    text2: resolve(STRUCTURAL_VARS.text2),
    text3: resolve(STRUCTURAL_VARS.text3),
    line: resolve(STRUCTURAL_VARS.line),
    lineStrong: resolve(STRUCTURAL_VARS.lineStrong),
    fill1: resolve(STRUCTURAL_VARS.fill1),
    chartGrid: resolve(STRUCTURAL_VARS.chartGrid),
    chartAxis: resolve(STRUCTURAL_VARS.chartAxis),
    tickBg: resolve(STRUCTURAL_VARS.tickBg),
    tickFg: resolve(STRUCTURAL_VARS.tickFg),
    divUp: resolve(STRUCTURAL_VARS.divUp),
    divDown: resolve(STRUCTURAL_VARS.divDown),
    successStrong: resolve(STRUCTURAL_VARS.successStrong),
    warningStrong: resolve(STRUCTURAL_VARS.warningStrong),
    destructiveStrong: resolve(STRUCTURAL_VARS.destructiveStrong),
  }
}

/**
 * Ordinal ramp for a chart with `count` series: take `--cat-1 → --cat-7` in
 * order and fold everything past the seventh into `--cat-7` (the neutral
 * "Other" slot). Never invents an eighth hue (spec §2.4 / §12.5).
 */
export function consoleOrdinalPalette(
  tokens: ConsoleChartTokens,
  count: number
): string[] {
  const ramp = tokens.categorical
  const neutral = ramp.at(-1) ?? ''
  const size = Math.max(count, 1)
  return Array.from({ length: size }, (_, index) =>
    index < ramp.length - 1 ? (ramp[index] ?? neutral) : neutral
  )
}

/** Cycle the categorical ramp by index, for identity maps of unknown length. */
export function consoleCategoricalAt(
  tokens: ConsoleChartTokens,
  index: number
): string {
  const ramp = tokens.categorical
  if (ramp.length === 0) return ''
  return ramp[index % ramp.length] ?? ramp[0]
}
