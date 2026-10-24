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
 * Uppercase constructed logotype: 16u stems, 104u cap height, 20u tracking,
 * flat terminals, no curves. The drawing is original — the only thing it shares
 * with any other gateway brand is the category convention (monochrome
 * geometric caps), which is a style, not an identity.
 *
 * `currentColor` throughout, so one asset inverts with the theme and works in
 * single-colour print. No gradients, strokes or shadows — hard rules of the
 * identity.
 */

/** Primary logotype. 370×120 viewBox, caps span y=8…112, 14u stems, 24u tracking. */
export function BuilinLogotype(props: { className?: string }) {
  return (
    <svg
      viewBox='0 0 370 120'
      fill='currentColor'
      className={cn('block', props.className)}
      role='img'
      aria-label='BUILIN'
      focusable='false'
    >
      {/* B */}
      <path d='M0 8h14v104H0z' />
      <path d='M14 8h28v14H14zM42 8h14v50H42zM14 51h28v14H14zM42 51h14v61H42zM14 98h28v14H14z' />
      {/* U */}
      <path d='M80 8h14v104H80zM124 8h14v104h-14zM80 98h58v14H80z' />
      {/* I */}
      <path d='M162 8h14v104h-14z' />
      {/* L */}
      <path d='M200 8h14v104h-14zM200 98h50v14h-50z' />
      {/* I */}
      <path d='M274 8h14v104h-14z' />
      {/* N */}
      <path d='M312 8h14v104h-14zM356 8h14v104h-14z' />
      <path d='M326 8h14l16 104h-14z' />
    </svg>
  )
}

/**
 * Monogram for app icons, avatars and favicons at 24px and above. Squircle
 * container at 22% radius, letter carved in Paper.
 */
export function BuilinMonogram(props: {
  className?: string
  /** Background tone; defaults to ink. */
  tone?: 'ink' | 'paper'
}) {
  const isInk = props.tone !== 'paper'
  return (
    <svg
      viewBox='0 0 200 200'
      className={cn('block', props.className)}
      role='img'
      aria-label='BUILIN'
      focusable='false'
    >
      <rect
        width='200'
        height='200'
        rx='44'
        fill={isInk ? 'currentColor' : 'none'}
      />
      <g fill={isInk ? 'var(--color-background-primary, #fff)' : 'currentColor'}>
        <path d='M56 40h18v120H56z' />
        <path d='M74 40h36v18H74zM110 40h18v58h-18zM74 90h36v18H74zM110 90h18v70h-18zM74 142h36v18H74z' />
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
      aria-label='BUILIN module'
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
