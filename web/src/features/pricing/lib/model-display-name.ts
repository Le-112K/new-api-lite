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
/**
 * Brand casing for the tokens an API model id is built from. Naive
 * title-casing turns `deepseek` into `Deepseek` and `gpt` into `Gpt`, so the
 * vendors whose styling differs from a plain capitalisation are enumerated here
 * (keys are the lower-cased tokens exactly as they appear in an identifier).
 */
const MODEL_TOKEN_CASE: Readonly<Record<string, string>> = {
  deepseek: 'DeepSeek',
  gpt: 'GPT',
  glm: 'GLM',
  qwen: 'Qwen',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  llama: 'Llama',
  mistral: 'Mistral',
  moonshot: 'Moonshot',
  kimi: 'Kimi',
  gemma: 'Gemma',
  phi: 'Phi',
  yi: 'Yi',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  opus: 'Opus',
  turbo: 'Turbo',
  mini: 'Mini',
  max: 'Max',
  pro: 'Pro',
  flash: 'Flash',
  nano: 'Nano',
  lite: 'Lite',
  vl: 'VL',
  vision: 'Vision',
  instruct: 'Instruct',
  chat: 'Chat',
  reasoner: 'Reasoner',
  coder: 'Coder',
  math: 'Math',
  r1: 'R1',
  azure: 'Azure',
  ollama: 'Ollama',
  local: 'Local',
}

/**
 * OpenAI styles its reasoning models in lower case (`o3-mini`, never `O3
 * Mini`), so a leading o-series token is left alone.
 */
const OPENAI_O_SERIES = new Set(['o1', 'o3', 'o4'])

const TOKEN_SEPARATOR = /[-_/]+/
const STARTS_WITH_DIGIT = /^\d/

/**
 * Derive an elegant, brand-cased display name from a raw API model identifier,
 * so a card reads "DeepSeek Reasoner" rather than "deepseek-reasoner".
 *
 * Tokens are split on `-`, `_` and `/`; `.` is deliberately kept because it is
 * part of version numbers such as `2.5`. `gpt` compounds keep OpenAI's hyphen
 * (`gpt-4o` -> "GPT-4o"), and an identifier that opens with an o-series token
 * keeps its whole lower-case, hyphen-glued form (`o3-mini` -> "o3-mini").
 *
 * Defensive by contract: empty or whitespace-only input is returned unchanged,
 * a non-empty input never yields an empty string, and the function never
 * throws.
 */
export function formatModelDisplayName(modelName: string): string {
  if (!modelName || modelName.trim().length === 0) {
    return modelName
  }

  const tokens = modelName
    .split(TOKEN_SEPARATOR)
    .filter((token) => token.length > 0)
  if (tokens.length === 0) {
    return modelName
  }

  if (OPENAI_O_SERIES.has(tokens[0].toLowerCase())) {
    return tokens.map((token) => token.toLowerCase()).join('-')
  }

  let display = ''
  for (let index = 0; index < tokens.length; index += 1) {
    const rendered = renderToken(tokens[index])
    if (index === 0) {
      display = rendered
      continue
    }
    const gluedToGpt = tokens[index - 1].toLowerCase() === 'gpt'
    display += gluedToGpt ? `-${rendered}` : ` ${rendered}`
  }
  return display
}

function renderToken(token: string): string {
  const mapped = MODEL_TOKEN_CASE[token.toLowerCase()]
  if (mapped) return mapped
  // Version / size tokens keep their original casing (4, 3.5, 2.5, 131k, 7b).
  if (STARTS_WITH_DIGIT.test(token)) return token
  return token.charAt(0).toUpperCase() + token.slice(1)
}
