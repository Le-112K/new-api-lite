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
 * size wins.
 */
export function BrandWordmark(props: { className?: string }) {
  return (
    <span
      className={cn(
        'text-foreground block select-none text-[15px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap',
        props.className
      )}
    >
      {BRAND_NAME}
    </span>
  )
}
