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
// One aperture blade in the 48×48 mark; repeated six times, 60° apart.
const APERTURE_BLADE_PATH =
  'M32 24 L43.32 18.82 A20 20 0 0 1 29.18 43.32 L28 30.93 Z'
const BLADE_ROTATIONS = [0, 60, 120, 180, 240, 300]

/**
 * Hero background layer — the faint hairline grid, the soft radial wash and the
 * large, slowly rotating aperture watermark that sits behind the copy. Purely
 * decorative, so the whole stack is aria-hidden and non-interactive.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 z-0'>
      {/* Hairline grid, masked so it fades out toward the edges. */}
      <div className='absolute inset-x-0 top-0 -bottom-20 bg-[linear-gradient(to_right,var(--hairline)_1px,transparent_1px),linear-gradient(to_bottom,var(--hairline)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.55] [mask-image:radial-gradient(ellipse_75%_60%_at_34%_30%,#000_8%,transparent_72%)]' />

      {/* Soft radial wash anchoring the top-left corner. */}
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_16%_4%,rgba(0,0,0,0.05),transparent_62%)] dark:bg-[radial-gradient(ellipse_55%_45%_at_16%_4%,rgba(255,255,255,0.06),transparent_62%)]' />

      {/* Aperture watermark — barely there, rotating slowly. */}
      <svg
        className='absolute top-[-240px] right-[-120px] size-[620px] text-[#1D1D1F] opacity-[0.03] dark:text-white dark:opacity-[0.05]'
        viewBox='0 0 48 48'
      >
        <defs>
          <path id='hero-ap-blade' d={APERTURE_BLADE_PATH} />
        </defs>
        <g
          className='hero-ap-spin'
          fill='currentColor'
          fillOpacity={0.5}
          stroke='currentColor'
          strokeWidth={0.6}
          strokeLinejoin='round'
        >
          {BLADE_ROTATIONS.map((angle) => (
            <use
              key={angle}
              href='#hero-ap-blade'
              transform={`rotate(${angle} 24 24)`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
