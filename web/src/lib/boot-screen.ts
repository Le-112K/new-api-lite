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
const BOOT_SCREEN_ID = 'boot'

/** Must match the `#boot` opacity transition in index.html. */
const FADE_MS = 200

/**
 * Hand the first paint over from the static boot screen to the React tree.
 *
 * `index.html` ships a brand mark so a reload never shows a blank sheet while
 * the bundle downloads. That placeholder sits on top of the app, so it has to
 * leave only once real content exists — otherwise it would hide the very page
 * it is covering. The root route calls this after it mounts; the fade keeps
 * the swap from reading as a flash.
 */
export function dismissBootScreen(): void {
  if (typeof document === 'undefined') return

  const boot = document.querySelector<HTMLElement>(`#${BOOT_SCREEN_ID}`)
  if (!boot || boot.dataset.dismissed === 'true') return

  // One frame of slack: the effect runs before the browser has painted the
  // content we are about to reveal.
  window.requestAnimationFrame(() => {
    boot.dataset.dismissed = 'true'
    window.setTimeout(() => boot.remove(), FADE_MS)
  })
}
