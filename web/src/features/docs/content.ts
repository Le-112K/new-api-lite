/**
 * 配置文档的内容骨架。
 *
 * 结构照着 apmix.ai/zh/docs：先给两个 Base URL，再让人粘密钥、选模型，
 * 然后是各工具的接入步骤，最后是错误对照表。代码片段不写死值，统一由
 * {@link DocsContext} 拼出来——站点地址取自当前域名，密钥和模型取自页面
 * 顶部的输入框，改一处全页跟着变。
 */

export type DocsContext = {
  /** 站点根地址，如 https://example.com */
  origin: string
  /** OpenAI 兼容根，带 /v1 */
  openaiBase: string
  /** Anthropic 兼容根，不带 /v1 */
  anthropicBase: string
  key: string
  model: string
}

export type DocsSnippet = {
  /** 同一个步骤里的多个代码块用 tab 区分（终端 / PowerShell / 配置文件） */
  label: string
  build: (ctx: DocsContext) => string
}

export type DocsStep = {
  title: string
  body?: string
  snippets: DocsSnippet[]
}

export type DocsTool = {
  slug: string
  name: string
  vendor: string
  protocol: 'openai' | 'anthropic'
  /** 配置写在哪，便于用户先知道要动哪个文件 */
  configPath?: string
  officialUrl?: string
  steps: DocsStep[]
}

const quote = (value: string) => `"${value}"`

export const DOCS_TOOLS: DocsTool[] = [
  {
    slug: 'claude-code',
    name: 'Claude Code',
    vendor: 'Anthropic',
    protocol: 'anthropic',
    configPath: '~/.claude/settings.json',
    officialUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    steps: [
      {
        title: 'Install Claude Code',
        body: 'Needs Node.js 18 or newer. Skip if it is already installed.',
        snippets: [
          {
            label: 'Terminal',
            build: () => 'npm install -g @anthropic-ai/claude-code',
          },
        ],
      },
      {
        title: 'Point it at this gateway',
        body: 'Claude Code speaks the Anthropic protocol, so the Base URL carries no /v1. Set these three variables in the terminal that runs it.',
        snippets: [
          {
            label: 'macOS / Linux',
            build: (ctx) =>
              [
                `export ANTHROPIC_BASE_URL=${quote(ctx.anthropicBase)}`,
                `export ANTHROPIC_AUTH_TOKEN=${quote(ctx.key)}`,
                `export ANTHROPIC_MODEL=${quote(ctx.model)}`,
              ].join('\n'),
          },
          {
            label: 'PowerShell',
            build: (ctx) =>
              [
                `$env:ANTHROPIC_BASE_URL = ${quote(ctx.anthropicBase)}`,
                `$env:ANTHROPIC_AUTH_TOKEN = ${quote(ctx.key)}`,
                `$env:ANTHROPIC_MODEL = ${quote(ctx.model)}`,
              ].join('\n'),
          },
        ],
      },
      {
        title: 'Make it stick',
        body: 'Write the same values into the settings file so every new terminal picks them up. Back up an existing file instead of replacing it outright.',
        snippets: [
          {
            label: '~/.claude/settings.json',
            build: (ctx) =>
              JSON.stringify(
                {
                  env: {
                    ANTHROPIC_BASE_URL: ctx.anthropicBase,
                    ANTHROPIC_AUTH_TOKEN: ctx.key,
                    ANTHROPIC_MODEL: ctx.model,
                  },
                },
                null,
                2
              ),
          },
        ],
      },
      {
        title: 'Run it',
        body: 'Start Claude Code inside a project. Use /model at any time to switch to another model from the catalogue.',
        snippets: [
          {
            label: 'Terminal',
            build: () => 'cd your-project\nclaude',
          },
        ],
      },
    ],
  },
  {
    slug: 'codex-cli',
    name: 'Codex CLI',
    vendor: 'OpenAI',
    protocol: 'openai',
    configPath: '~/.codex/config.toml',
    officialUrl: 'https://github.com/openai/codex',
    steps: [
      {
        title: 'Install Codex CLI',
        body: 'Needs Node.js 18 or newer.',
        snippets: [
          {
            label: 'Terminal',
            build: () => 'npm install -g @openai/codex',
          },
        ],
      },
      {
        title: 'Point it at this gateway',
        body: 'Codex speaks the OpenAI protocol, so the Base URL ends with /v1.',
        snippets: [
          {
            label: '~/.codex/config.toml',
            build: (ctx) =>
              [
                'model = ' + quote(ctx.model),
                'model_provider = "gateway"',
                '',
                '[model_providers.gateway]',
                'name = "Gateway"',
                `base_url = ${quote(ctx.openaiBase)}`,
                `env_key = "GATEWAY_API_KEY"`,
                'wire_api = "chat"',
              ].join('\n'),
          },
          {
            label: 'macOS / Linux',
            build: (ctx) => `export GATEWAY_API_KEY=${quote(ctx.key)}`,
          },
          {
            label: 'PowerShell',
            build: (ctx) => `$env:GATEWAY_API_KEY = ${quote(ctx.key)}`,
          },
        ],
      },
      {
        title: 'Run it',
        body: 'Codex reads the config on start. Pass --model to override the model for a single session.',
        snippets: [
          { label: 'Terminal', build: () => 'cd your-project\ncodex' },
        ],
      },
    ],
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    vendor: 'Anysphere',
    protocol: 'openai',
    configPath: 'Settings → Models → OpenAI API Key',
    officialUrl: 'https://docs.cursor.com/settings/api-keys',
    steps: [
      {
        title: 'Open the model settings',
        body: 'Go to Settings → Models, expand the OpenAI section and enable the override field.',
        snippets: [],
      },
      {
        title: 'Fill in URL and key',
        body: 'Paste the Base URL with /v1 and the key. Cursor keeps them locally.',
        snippets: [
          {
            label: 'Values',
            build: (ctx) =>
              [`Base URL: ${ctx.openaiBase}`, `API Key:  ${ctx.key}`].join(
                '\n'
              ),
          },
        ],
      },
      {
        title: 'Add the model',
        body: 'Add the model ID to the custom model list, then pick it in the chat panel.',
        snippets: [{ label: 'Model ID', build: (ctx) => ctx.model }],
      },
    ],
  },
  {
    slug: 'sdk',
    name: 'Any SDK or curl',
    vendor: 'Generic',
    protocol: 'openai',
    steps: [
      {
        title: 'Call the API',
        body: 'Any OpenAI-compatible client works: point it at the Base URL and pass the key as a bearer token.',
        snippets: [
          {
            label: 'curl',
            build: (ctx) =>
              [
                `curl ${ctx.openaiBase}/chat/completions \\`,
                `  -H "Authorization: Bearer ${ctx.key}" \\`,
                '  -H "Content-Type: application/json" \\',
                `  -d '{"model":"${ctx.model}","messages":[{"role":"user","content":"hello"}]}'`,
              ].join('\n'),
          },
          {
            label: 'Python',
            build: (ctx) =>
              [
                'from openai import OpenAI',
                '',
                'client = OpenAI(',
                `    base_url="${ctx.openaiBase}",`,
                `    api_key="${ctx.key}",`,
                ')',
                '',
                'print(client.chat.completions.create(',
                `    model="${ctx.model}",`,
                '    messages=[{"role": "user", "content": "hello"}],',
                ').choices[0].message.content)',
              ].join('\n'),
          },
        ],
      },
    ],
  },
]

/** 目录里常用的几个模型，供 datalist 提示；输入框本身允许任意 ID。 */
export const DOCS_MODEL_HINTS = [
  'deepseek-flash',
  'deepseek-v4-pro',
  'deepseek-v4-flash-ga-260731',
  'glm-5-3-flash-260828',
]

export type DocsErrorRow = {
  status: string
  code: string
  meaning: string
  action: string
}

/** 常见错误对照。code 与本站返回体里的 error.code 对应。 */
export const DOCS_ERRORS: DocsErrorRow[] = [
  {
    status: '400',
    code: 'invalid_request',
    meaning:
      'The request body could not be parsed, or a parameter was rejected.',
    action: 'Check the JSON, the Content-Type header, and the parameter names.',
  },
  {
    status: '401',
    code: 'AUTH_UNAUTHORIZED',
    meaning: 'The key is missing, wrong, or deleted.',
    action: 'Copy the key again from Console → API Keys, or create a new one.',
  },
  {
    status: '403',
    code: 'FORBIDDEN',
    meaning: 'The key is valid but the account or group cannot use this model.',
    action:
      'List the models with this key, or upgrade the plan the key belongs to.',
  },
  {
    status: '404',
    code: 'model_not_found',
    meaning: 'The model ID is unknown, or the path does not exist.',
    action: 'Use an ID from the catalogue; check the Base URL suffix (/v1).',
  },
  {
    status: '429',
    code: 'rate_limit_exceeded',
    meaning: 'Too many requests for this key in a short window.',
    action: 'Wait for retry-after seconds, or spread load across several keys.',
  },
  {
    status: '429',
    code: 'quota_exhausted',
    meaning: 'The balance or the plan allowance for this account is used up.',
    action: 'Top up in Console → Wallet, or wait for the plan to renew.',
  },
  {
    status: '502',
    code: 'upstream_error',
    meaning: 'The upstream provider returned a broken or unexpected response.',
    action: 'Retry once; if it repeats, switch to another model.',
  },
  {
    status: '503',
    code: 'upstream_unavailable',
    meaning: 'The model timed out or is offline for maintenance.',
    action: 'Retry later or pick another model.',
  },
]
