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
import { cn } from '@/lib/utils'

/**
 * Brand mark: a sharp geometric "N" for New API.
 *
 * Drawn as three solid paths on a 926×528 canvas so it renders at 35×20 like
 * the reference lockup — two stems and a connecting diagonal, with the diagonal
 * dropped to 70% opacity. That single lighter plane is what keeps a flat
 * monochrome mark from reading as a blob at 20px tall: it gives the eye an
 * edge to catch, and it lets the mark sit next to a heavy wordmark without
 * competing with it.
 *
 * `currentColor` throughout, so the mark inherits text colour and inverts with
 * the theme without a second asset.
 */
export function BrandMark(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 926 528'
      fill='currentColor'
      className={cn('block', props.className)}
      aria-hidden='true'
      focusable='false'
    >
      {/* Left stem */}
      <path d='M0 0h150v528H0z' />
      {/* Diagonal — lighter so the lockup keeps a readable edge at 20px */}
      <path d='M150 0h150l476 528H626z' fillOpacity='0.7' />
      {/* Right stem */}
      <path d='M776 0h150v528H776z' />
    </svg>
  )
}
