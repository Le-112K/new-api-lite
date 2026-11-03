import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  DOCS_ERRORS,
  DOCS_MODEL_HINTS,
  DOCS_TOOLS,
  type DocsContext,
  type DocsSnippet,
  type DocsTool,
} from './content'

/** 代码块：等宽字体 + 横向滚动 + 右上角复制。 */
function Snippet(props: { snippet: DocsSnippet; ctx: DocsContext }) {
  const { t } = useTranslation()
  const code = props.snippet.build(props.ctx)
  const isSingleLine = !code.includes('\n')

  return (
    <div className='border-border/70 bg-muted/40 overflow-hidden rounded-lg border'>
      <div className='border-border/60 text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-1.5 text-[11px] font-medium'>
        <span>{props.snippet.label}</span>
        <CopyButton
          value={code}
          tooltip={t('Copy')}
          className='text-muted-foreground hover:text-foreground size-6'
          iconClassName='size-3'
        />
      </div>
      <pre
        className={cn(
          'overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed',
          isSingleLine && 'whitespace-pre'
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

function BaseUrlCard(props: {
  label: string
  value: string
  description: string
  badge: string
}) {
  const { t } = useTranslation()

  return (
    <div className='border-border/70 bg-card flex flex-col gap-2 rounded-xl border p-4'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-sm font-semibold'>{props.label}</span>
        <span className='border-border/70 text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]'>
          {props.badge}
        </span>
      </div>
      <div className='bg-muted/60 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5'>
        <code className='truncate font-mono text-[12.5px]'>{props.value}</code>
        <CopyButton
          value={props.value}
          tooltip={t('Copy')}
          className='text-muted-foreground hover:text-foreground size-6 shrink-0'
          iconClassName='size-3'
        />
      </div>
      <p className='text-muted-foreground text-xs leading-relaxed'>
        {props.description}
      </p>
    </div>
  )
}

function ToolPanel(props: { tool: DocsTool; ctx: DocsContext }) {
  const { t } = useTranslation()
  const { tool } = props
  const stepCount = tool.steps.length

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-xs'>
        <span className='font-semibold'>{tool.name}</span>
        <span className='text-muted-foreground'>{tool.vendor}</span>
        <span className='text-muted-foreground'>
          {t('Protocol')}:{' '}
          {tool.protocol === 'anthropic'
            ? t('Anthropic compatible')
            : t('OpenAI compatible')}
        </span>
        {tool.configPath ? (
          <span className='text-muted-foreground'>
            {t('Config file')}:{' '}
            <code className='font-mono text-[11.5px]'>{tool.configPath}</code>
          </span>
        ) : null}
        <span className='text-muted-foreground'>
          {stepCount} {t('steps')}
        </span>
        {tool.officialUrl ? (
          <a
            href={tool.officialUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2'
          >
            {t('Official docs')}
            <ExternalLink className='size-3' />
          </a>
        ) : null}
      </div>

      <ol className='flex flex-col gap-7'>
        {tool.steps.map((step, index) => (
          <li key={step.title} className='flex gap-4'>
            <span className='border-border/70 text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className='flex min-w-0 flex-1 flex-col gap-3'>
              <h3 className='text-sm font-semibold'>{t(step.title)}</h3>
              {step.body ? (
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  {t(step.body)}
                </p>
              ) : null}
              {step.snippets.map((snippet) => (
                <Snippet
                  key={snippet.label}
                  snippet={snippet}
                  ctx={props.ctx}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * 站内配置文档。
 *
 * 以前「文档」是后台配一个外链，点了就离开本站；现在文档就是本站的一个页面，
 * 内容按工具组织：先给两个 Base URL，再让用户粘密钥选模型，下面的代码片段
 * 直接跟着变，最后是验证方法和错误对照。
 *
 * 密钥只存在 sessionStorage：它只用来填本页的代码片段，不该被长期留存。
 */
export function DocsContent(props: { initialTool?: string }) {
  const { t } = useTranslation()
  const [key, setKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem('docs.apiKey') ?? ''
  })
  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem('docs.model') ?? ''
  })
  const [activeTool, setActiveTool] = useState(() => {
    const slug = props.initialTool
    return DOCS_TOOLS.some((tool) => tool.slug === slug)
      ? (slug as string)
      : DOCS_TOOLS[0].slug
  })

  const origin =
    typeof window === 'undefined'
      ? ''
      : window.location.origin.replace(/\/+$/, '')

  const ctx: DocsContext = useMemo(
    () => ({
      origin,
      openaiBase: `${origin}/v1`,
      anthropicBase: origin,
      key: key.trim() || 'YOUR_API_KEY',
      model: model.trim() || DOCS_MODEL_HINTS[0],
    }),
    [origin, key, model]
  )

  const store = (name: string, value: string) => {
    if (typeof window === 'undefined') return
    if (value) window.sessionStorage.setItem(name, value)
    else window.sessionStorage.removeItem(name)
  }

  const tool =
    DOCS_TOOLS.find((item) => item.slug === activeTool) ?? DOCS_TOOLS[0]

  return (
    <div className='flex flex-col'>
      <section className='mt-9'>
        <h2 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
          {t('Base URL')}
        </h2>
        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
          <BaseUrlCard
            label={t('OpenAI compatible')}
            badge='/v1'
            value={ctx.openaiBase}
            description={t(
              'Chat Completions and Responses. For Codex, Cursor and most SDKs.'
            )}
          />
          <BaseUrlCard
            label={t('Anthropic compatible')}
            badge='messages'
            value={ctx.anthropicBase}
            description={t(
              'Messages API. For Claude Code and the Anthropic SDK.'
            )}
          />
        </div>
      </section>

      <section className='border-border/70 mt-8 rounded-xl border p-4 sm:p-5'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <h2 className='text-sm font-semibold'>{t('Your config')}</h2>
          <span className='text-muted-foreground text-[11px]'>
            {t('Kept in this tab only, used to fill the snippets below.')}
          </span>
        </div>
        <div className='mt-3 grid gap-4 sm:grid-cols-2'>
          <label className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium'>{t('API key')}</span>
            <Input
              value={key}
              onChange={(event) => {
                setKey(event.target.value)
                store('docs.apiKey', event.target.value.trim())
              }}
              placeholder='sk-...'
              autoComplete='off'
              spellCheck={false}
              className='font-mono text-[12.5px]'
            />
          </label>
          <label className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium'>{t('Model')}</span>
            <Input
              value={model}
              list='docs-model-hints'
              onChange={(event) => {
                setModel(event.target.value)
                store('docs.model', event.target.value.trim())
              }}
              placeholder={DOCS_MODEL_HINTS[0]}
              autoComplete='off'
              spellCheck={false}
              className='font-mono text-[12.5px]'
            />
            <datalist id='docs-model-hints'>
              {DOCS_MODEL_HINTS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>
        <p className='text-muted-foreground mt-2 text-[11px]'>
          {t(
            'Each tool has a sensible default; any model in the catalogue works.'
          )}
        </p>
      </section>

      <section className='mt-10'>
        <div className='border-border/70 flex flex-wrap gap-1 border-b pb-2'>
          {DOCS_TOOLS.map((item) => (
            <button
              key={item.slug}
              type='button'
              onClick={() => setActiveTool(item.slug)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                item.slug === activeTool
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className='pt-6'>
          <ToolPanel tool={tool} ctx={ctx} />
        </div>
      </section>

      <section className='border-border/70 mt-10 border-t pt-8'>
        <h2 className='text-base font-semibold'>
          {t('Check that the key works.')}
        </h2>
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {t(
            'List the models this key can reach. A JSON list means both URL and key are right; 401 means the key is wrong or expired.'
          )}
        </p>
        <div className='mt-3'>
          <Snippet
            snippet={{
              label: 'curl',
              build: (context) =>
                [
                  `curl ${context.openaiBase}/models \\`,
                  `  -H "Authorization: Bearer ${context.key}"`,
                ].join('\n'),
            }}
            ctx={ctx}
          />
        </div>
      </section>

      <section className='border-border/70 mt-10 border-t pt-8'>
        <h2 className='text-base font-semibold'>{t('No tool for you?')}</h2>
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {t(
            'Any tool that lets you set an OpenAI or Anthropic Base URL will work. Find the Base URL or custom provider field, paste the URL and key, then use a model ID from the catalogue.'
          )}
        </p>
      </section>

      <section className='border-border/70 mt-10 border-t pt-8'>
        <h2 className='text-base font-semibold'>{t('Errors')}</h2>
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {t('Every error, the status code, and what to do.')}
        </p>
        <div className='border-border/70 mt-4 overflow-hidden rounded-xl border'>
          <table className='w-full text-left text-xs'>
            <thead className='bg-muted/50 text-muted-foreground'>
              <tr>
                <th className='px-3 py-2 font-medium'>{t('Status')}</th>
                <th className='px-3 py-2 font-medium'>{t('Code')}</th>
                <th className='px-3 py-2 font-medium'>
                  {t('When it happens')}
                </th>
                <th className='px-3 py-2 font-medium'>{t('What to do')}</th>
              </tr>
            </thead>
            <tbody>
              {DOCS_ERRORS.map((row) => (
                <tr
                  key={`${row.status}-${row.code}`}
                  className='border-border/60 border-t'
                >
                  <td className='px-3 py-2 font-mono'>{row.status}</td>
                  <td className='px-3 py-2 font-mono text-[11.5px]'>
                    {row.code}
                  </td>
                  <td className='text-muted-foreground px-3 py-2'>
                    {t(row.meaning)}
                  </td>
                  <td className='text-muted-foreground px-3 py-2'>
                    {t(row.action)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/**
 * 前台独立文档页。
 *
 * 公开可读：文档讲的是怎么接进来，不需要账号；密钥在控制台创建。
 * 控制台里看的是同一份内容（{@link DocsContent}），只是套控制台外壳。
 */
export function DocsPage(props: { initialTool?: string }) {
  const { t } = useTranslation()

  return (
    <PublicLayout
      showMainContainer={false}
      headerProps={{ variant: 'landing' }}
      wrapperClassName='bg-white dark:bg-[#0a0a0a]'
    >
      <div className='mx-auto w-full max-w-5xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24'>
        <header className='max-w-2xl'>
          <h1 className='text-foreground text-[clamp(1.75rem,3vw,2.4rem)] leading-tight font-bold tracking-tight'>
            {t('Two lines of config, every tool.')}
          </h1>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
            {t(
              'Every tool below needs the same two things: the Base URL and your API key. Paste the key once and every snippet on this page fills itself in.'
            )}
          </p>
        </header>
        <DocsContent initialTool={props.initialTool} />
      </div>
    </PublicLayout>
  )
}
