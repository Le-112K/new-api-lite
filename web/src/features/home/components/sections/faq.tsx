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
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionHeading, SectionShell } from '../section-shell'

/**
 * FAQ.
 *
 * Native `<details>` instead of the accordion primitive: it is keyboard
 * accessible, works before hydration, and needs no state. The plus glyph is
 * rotated by `[&[open]]`, so the open/closed affordance is expressed in CSS
 * rather than in React.
 */
export function Faq() {
  const { t } = useTranslation()

  const items = [
    {
      q: t('Which clients work out of the box?'),
      a: t(
        'Any client that lets you set a base URL: Cherry Studio, Claude Code, Codex CLI, Cursor, OpenCode, AionUi and the official OpenAI and Anthropic SDKs. The setup guides list the exact field for each one.'
      ),
    },
    {
      q: t('What is the difference from calling each provider directly?'),
      a: t(
        'One credential, one bill and one log stream. The gateway absorbs the protocol differences between OpenAI and Anthropic, so a single client can reach models from several vendors without changing code.'
      ),
    },
    {
      q: t('Where does my data go?'),
      a: t(
        'Through your own deployment and nowhere else. The software runs on your server, keeps its database there, and does not report usage to us or to any third party.'
      ),
    },
    {
      q: t('How is usage billed?'),
      a: t(
        'Per token, at a per-model multiplier the operator sets in the console. Users can be given quotas, rate limits and separate tokens, and every charge is written to the usage log.'
      ),
    },
    {
      q: t('How do I deploy it?'),
      a: t(
        'One Docker Compose file with PostgreSQL and Redis. The installation guide covers Compose, 1Panel and BaoTa, including the environment variables that must be set before the first start.'
      ),
    },
  ]

  return (
    <SectionShell id='faq'>
      <SectionHeading
        label={t('Questions')}
        title={t('Questions')}
        lede={t('Something else? The documentation covers the rest of it.')}
      />

      <div className='border-t border-border'>
        {items.map((item) => (
          <details key={item.q} className='group border-b border-border'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[14.5px] font-medium text-foreground marker:hidden'>
              {item.q}
              <Plus
                className='size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45'
                aria-hidden
              />
            </summary>
            <p className='max-w-[52rem] pb-6 text-[13.5px] leading-[1.7] text-muted-foreground'>
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  )
}
