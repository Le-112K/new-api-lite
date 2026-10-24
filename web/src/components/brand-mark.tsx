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
 * builin brand system — see web/brand/IDENTITY.md.
 *
 * The wordmark is a constructed geometric lowercase, not typeset text: fixed
 * 16u stem width, 72u x-height, 104u ascender, flat terminals. The signature
 * detail is the two square i-dots (18×18) — they read as gateway nodes and
 * carry the "routing" half of the brand story while the word itself says
 * built-in (builin = built-in minus one t).
 *
 * Everything is `currentColor`, so a single asset inverts with the theme and
 * works in one-colour print. No gradients, no strokes, no shadows — that is a
 * hard rule of the identity, not a preference.
 */

/** Primary logotype. 320×120 viewBox, content spans y=6…112. */
export function BuilinLogotype(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 320 120'
      fill='currentColor'
      className={cn('block', props.className)}
      role='img'
      aria-label='builin'
      focusable='false'
    >
      {/* b */}
      <path d='M0 8h16v104H0z' />
      <path d='M16 40h32v16H16zM48 40h16v72H48zM16 96h32v16H16z' />
      {/* u */}
      <path d='M80 40h16v56h32V40h16v72H80z' />
      {/* i — square node dot */}
      <path d='M160 40h16v72h-16zM160 6h18v18h-18z' />
      {/* l */}
      <path d='M192 8h16v104h-16z' />
      {/* i — square node dot */}
      <path d='M224 40h16v72h-16zM224 6h18v18h-18z' />
      {/* n */}
      <path d='M256 40h64v16h-48v56h-16z' />
    </svg>
  )
}

/**
 * Monogram for app icons, avatars and favicons at 24px and above. The
 * container is a squircle (22% radius) in Ink with the letter in Paper; at
 * 16px use the simplified flat version instead — see IDENTITY.md §2.2.
 */
export function BuilinMonogram(props: {
  className?: string
  /** Background colour class; defaults to ink. */
  tone?: 'ink' | 'paper'
}) {
  const isInk = props.tone !== 'paper'
  return (
    <svg
      viewBox='0 0 200 200'
      className={cn('block', props.className)}
      role='img'
      aria-label='builin'
      focusable='false'
    >
      <rect width='200' height='200' rx='44' fill={isInk ? 'currentColor' : 'none'} />
      <g fill={isInk ? 'var(--color-background-primary, #fff)' : 'currentColor'}>
        <path d='M56 40h20v120H56z' />
        <path d='M76 82h40v20H76zM116 82h20v88h-20zM76 150h40v20H76z' />
      </g>
    </svg>
  )
}

/**
 * Module mark — outer frame + nested block = a built-in unit. Auxiliary only
 * (watermarks, loading states, stickers); never a substitute for the name.
 */
export function BuilinModule(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 200 200'
      className={cn('block', props.className)}
      role='img'
      aria-label='builin module'
      focusable='false'
    >
      <rect width='200' height='200' rx='44' fill='currentColor' />
      <rect
        x='48'
        y='48'
        width='104'
        height='104'
        rx='10'
        fill='none'
        stroke='var(--color-background-primary, #fff)'
        strokeWidth='14'
      />
      <rect
        x='84'
        y='84'
        width='32'
        height='32'
        fill='var(--color-background-primary, #fff)'
      />
    </svg>
  )
}
