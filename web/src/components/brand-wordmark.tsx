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
import { BRAND_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Text-only brand wordmark. The product carries no logo image anywhere, so the
 * wordmark is the whole identity: mixed-case "AperTurez", tight tracking, one
 * solid ink colour. It inherits `currentColor` through `text-foreground`, which
 * keeps it legible in both themes without a second asset.
 *
 * Sizes are contextual — pass `text-[…]` to override; `cn` merges so the last
 * size wins. Scale (light/dark identical):
 *   header 19 · footer 17 · sidebar 16 · auth 24 · setup 32
 * The header value sits one clear step above the 14px nav links (1.36×), which
 * is what makes the name read as the primary mark without competing with the
 * page title.
 */
export function BrandWordmark(props: { className?: string }) {
  return (
    <span
      className={cn(
        'text-foreground block select-none text-[19px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap',
        props.className
      )}
    >
      {BRAND_NAME}
    </span>
  )
}
