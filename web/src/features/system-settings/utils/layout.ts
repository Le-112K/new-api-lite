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
 * Layout hints for a settings pane.
 *
 * The settings surface spans panes with one switch (e.g. "Token limits") and
 * panes with twenty controls (e.g. "Basic authentication"). Rather than forcing
 * every pane into one grid, each section declares how heavy it is and the
 * shared shell adapts:
 *
 * - `compact`  few controls → one narrow reading column, so a lone input reads
 *              as a form instead of an empty half-panel.
 * - `regular`  the default two-column grid for clustered field groups.
 *
 * Width can be overridden independently because table-shaped panes (model
 * pricing, scheduled tasks) need horizontal room without changing the rhythm
 * of their form controls.
 */
export type SettingsDensity = 'compact' | 'regular'

export type SettingsWidth = 'narrow' | 'default' | 'wide'

export type SettingsLayoutHint = {
  density?: SettingsDensity
  width?: SettingsWidth
}

const WIDTH_CLASS: Record<SettingsWidth, string> = {
  narrow: 'max-w-[660px]',
  default: 'max-w-[880px]',
  wide: 'max-w-[1080px]',
}

const DENSITY_WIDTH: Record<SettingsDensity, SettingsWidth> = {
  compact: 'narrow',
  regular: 'default',
}

export function resolveSettingsLayout(hint?: SettingsLayoutHint) {
  const density = hint?.density ?? 'regular'
  const width = hint?.width ?? DENSITY_WIDTH[density]
  return { density, width, contentMaxWidth: WIDTH_CLASS[width] }
}
