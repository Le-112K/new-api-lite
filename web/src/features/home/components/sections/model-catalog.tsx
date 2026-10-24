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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'

import { SectionHeading, SectionShell } from '../section-shell'

type VendorGroup = {
  id: number
  name: string
  icon?: string
  count: number
}

/** Reference marks are 28×28 with a 14px gap to the text. */
const ICON_SIZE = 28

/**
 * The catalog block.
 *
 * It groups by vendor instead of listing SKUs. Two reasons: the console is the
 * source of truth for what is on sale, and a raw model id (`deepseek-v4-flash-
 * ga-260731`) means nothing to a buyer — "DeepSeek · 3 models" does. The grid is
 * therefore derived, never hardcoded: enable a vendor in the console and it
 * appears, retire one and the tile disappears with it.
 *
 * Grouping happens on `vendor_id`, joined against `data.vendors` by
 * `usePricingData`. Reading the raw query here would leave `vendor_name` empty
 * (the API ships only `vendor_id` on each model), which is how the old tiles
 * ended up labelling DeepSeek models as "OpenAI" — that tag was the protocol,
 * not the vendor.
 *
 * Layout is `flex-wrap` + `min-w` rather than a fixed column count: two vendors
 * fill the row edge to edge, twelve wrap into even rows of five, and the hairline
 * mesh stays closed in both cases. Prices stay off this surface until the
 * placeholder ratios are repriced.
 */
export function ModelCatalog() {
  const { t } = useTranslation()
  const { models, isLoading } = usePricingData()

  const vendors = useMemo(() => {
    const grouped = new Map<number, VendorGroup>()
    for (const model of models) {
      if (model.vendor_id == null) continue
      const known = grouped.get(model.vendor_id)
      if (known) {
        known.count += 1
        continue
      }
      grouped.set(model.vendor_id, {
        id: model.vendor_id,
        /* Fall back to the icon key (`DeepSeek.Color`) minus its variant so a
           vendor without a translated name still gets a readable label. */
        name: model.vendor_name || model.vendor_icon?.split('.')[0] || '—',
        icon: model.vendor_icon,
        count: 1,
      })
    }
    return [...grouped.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    )
  }, [models])

  if (!isLoading && vendors.length === 0) return null

  return (
    <SectionShell id='models' tight divided>
      <SectionHeading
        compact
        label={t('Models')}
        title={t('{{vendors}} vendors, {{models}} models, all on one API key.', {
          vendors: vendors.length,
          models: models.length,
        })}
        lede={t(
          'Read from the live catalog — enable or retire a model in the console and this list follows.'
        )}
        action={
          <Link
            to='/pricing'
            className='group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-foreground'
          >
            {t('All models')}
            <ArrowRight
              className='size-3.5 transition-transform group-hover:translate-x-0.5'
              aria-hidden
            />
          </Link>
        }
      />

      {isLoading ? (
        <div className='overflow-hidden rounded-xl border border-border'>
          <div className='flex flex-wrap'>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className='-mt-px -ml-px flex min-w-[240px] flex-1 items-center gap-3.5 border-t border-l border-border bg-background px-5 py-4'
              >
                <div className='size-7 animate-pulse rounded-full bg-secondary' />
                <div className='min-w-0 flex-1'>
                  <div className='h-3.5 w-20 animate-pulse rounded bg-secondary' />
                  <div className='mt-2 h-2.5 w-12 animate-pulse rounded bg-secondary' />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className='overflow-hidden rounded-xl border border-border'>
          {/* Hairline mesh: every tile keeps its own top/left border and pulls
              itself 1px up-left, so the seams collapse into single lines and the
              first row/column sit exactly on the container border. */}
          <div className='flex flex-wrap'>
            {vendors.map((vendor) => (
              <Link
                key={vendor.id}
                to='/pricing'
                search={{ vendor: vendor.name }}
                className='group -mt-px -ml-px flex min-w-[240px] flex-1 items-center gap-3.5 border-t border-l border-border bg-background px-5 py-4 transition-colors hover:bg-secondary/40'
              >
                {/* Two stacked marks, cross-faded on hover: the mono one is
                    black at rest, the `*.Color` one takes over on hover. The
                    reference ships both as `absolute` children of a size-7 box
                    and flips their opacity, which is why no filter is involved
                    (a grayscale filter would wash the brand colours out). */}
                <span
                  className='relative block size-7 shrink-0'
                  aria-hidden
                >
                  <span className='absolute inset-0 opacity-100 transition-opacity duration-150 group-hover:opacity-0 motion-reduce:transition-none'>
                    {getLobeIcon(
                      vendor.icon?.split('.')[0] ?? undefined,
                      ICON_SIZE
                    )}
                  </span>
                  <span className='absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'>
                    {getLobeIcon(vendor.icon, ICON_SIZE)}
                  </span>
                </span>
                <span className='min-w-0'>
                  <span className='block truncate text-[17px] leading-[21px] font-semibold text-foreground'>
                    {vendor.name}
                  </span>
                  <span className='mt-0.5 block text-[13px] leading-[16px] text-muted-foreground'>
                    {t('{{count}} models', { count: vendor.count })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </SectionShell>
  )
}
