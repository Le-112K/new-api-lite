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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'
import { pricingQueryOptions } from '@/features/pricing/queries'
import type { PricingModel } from '@/features/pricing/types'

import { SectionHeading, SectionShell } from '../section-shell'

/** How many models the homepage shows before deferring to the full catalog. */
const SHOWCASE_LIMIT = 8

/** Endpoint slugs the backend can return, mapped to what a buyer recognises. */
const ENDPOINT_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  'jina-rerank': 'Rerank',
  'image-generation': 'Image',
  embeddings: 'Embed',
  embedding: 'Embed',
  rerank: 'Rerank',
}

/**
 * The catalog block.
 *
 * Two constraints shaped it. First, the live catalog is small and will change
 * without a deploy, so the grid is `auto-fill` over a hairline mesh: four models
 * fill one tidy row, forty wrap into more rows, and neither state needs a
 * redesign or a hardcoded column count. Second, the tile shows what a buyer
 * actually compares — the model id, who serves it, and which protocol it speaks
 * — not marketing copy.
 *
 * Prices are deliberately absent here: every ratio in the live catalog is still
 * the historical placeholder (37.5, ≈$75/1M), so printing currency would publish
 * a wrong number. The full pricing page owns that surface until repricing lands.
 */
export function ModelCatalog() {
  const { t } = useTranslation()
  const { data, isPending } = useQuery(pricingQueryOptions())

  const models = data?.data ?? []
  if (!isPending && models.length === 0) return null

  const shown = models.slice(0, SHOWCASE_LIMIT)
  const remaining = models.length - shown.length

  return (
    <SectionShell id='models'>
      <SectionHeading
        label={t('Models')}
        title={t('Every model you have switched on, in one catalog')}
        lede={t(
          'The list is read from the live catalog, so a model you enable or retire in the console shows up here without touching the site.'
        )}
        action={
          <Link
            to='/pricing'
            className='group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-foreground'
          >
            {t('All models and prices')}
            <ArrowRight
              className='size-3.5 transition-transform group-hover:translate-x-0.5'
              aria-hidden
            />
          </Link>
        }
      />

      {isPending ? (
        <div className='overflow-hidden rounded-xl border border-border'>
          <div className='grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='bg-background p-5'>
                <div className='h-3.5 w-2/3 animate-pulse rounded bg-secondary' />
                <div className='mt-2.5 h-2.5 w-1/3 animate-pulse rounded bg-secondary' />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className='overflow-hidden rounded-xl border border-border'>
          <div className='grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4'>
            {shown.map((model) => (
              <ModelTile key={model.model_name} model={model} />
            ))}
          </div>
        </div>
      )}

      {remaining > 0 ? (
        <p className='mt-4 text-[13px] text-muted-foreground'>
          {t('And {{count}} more in the catalog.', { count: remaining })}
        </p>
      ) : null}
    </SectionShell>
  )
}

function ModelTile(props: { model: PricingModel }) {
  const iconKey = props.model.icon || props.model.vendor_icon
  const icon = iconKey ? getLobeIcon(iconKey, 18) : null
  /* Vendor names are not always populated in the catalog; joining the parts and
     dropping empties keeps a stray "—" out of the tile. */
  const endpoints = (props.model.supported_endpoint_types ?? [])
    .slice(0, 2)
    .map((type) => ENDPOINT_LABELS[type] ?? type)

  return (
    /* Fixed height with the metadata pinned to the bottom: with a four-model
       catalog the row is the whole section, and tiles that hug their content
       read as a thin strip instead of a grid. */
    <div className='flex min-h-[96px] flex-col justify-between gap-4 bg-background p-5 transition-colors hover:bg-secondary/40'>
      <div className='flex items-center gap-2'>
        {icon ? (
          <span className='flex size-[18px] shrink-0 items-center justify-center'>
            {icon}
          </span>
        ) : null}
        <span className='truncate font-mono text-[12.5px] font-medium text-foreground'>
          {props.model.model_name}
        </span>
      </div>
      <div className='flex flex-wrap items-center gap-1.5'>
        {props.model.vendor_name ? (
          <span className='text-[11.5px] text-muted-foreground'>
            {props.model.vendor_name}
          </span>
        ) : null}
        {endpoints.map((endpoint) => (
          <span
            key={endpoint}
            className='rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground'
          >
            {endpoint}
          </span>
        ))}
      </div>
    </div>
  )
}
