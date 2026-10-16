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
import { describe, expect, test } from 'vitest'

import { formatModelDisplayName } from '../model-display-name'

describe('formatModelDisplayName', () => {
  describe('contract rows', () => {
    test('deepseek-reasoner reads "DeepSeek Reasoner"', () => {
      expect(formatModelDisplayName('deepseek-reasoner')).toBe(
        'DeepSeek Reasoner'
      )
    })

    test('claude-haiku-3.5 reads "Claude Haiku 3.5"', () => {
      expect(formatModelDisplayName('claude-haiku-3.5')).toBe(
        'Claude Haiku 3.5'
      )
    })

    test('gemini-2.5-flash reads "Gemini 2.5 Flash"', () => {
      expect(formatModelDisplayName('gemini-2.5-flash')).toBe(
        'Gemini 2.5 Flash'
      )
    })

    test('gpt-4o-mini reads "GPT-4o Mini"', () => {
      expect(formatModelDisplayName('gpt-4o-mini')).toBe('GPT-4o Mini')
    })

    test('qwen-vl-max reads "Qwen VL Max"', () => {
      expect(formatModelDisplayName('qwen-vl-max')).toBe('Qwen VL Max')
    })

    test('grok-3 reads "Grok 3"', () => {
      expect(formatModelDisplayName('grok-3')).toBe('Grok 3')
    })

    test('o3-mini keeps OpenAI lower-case "o3-mini"', () => {
      expect(formatModelDisplayName('o3-mini')).toBe('o3-mini')
    })

    test('claude-sonnet-4 reads "Claude Sonnet 4"', () => {
      expect(formatModelDisplayName('claude-sonnet-4')).toBe('Claude Sonnet 4')
    })
  })

  describe('brand casing table', () => {
    test.each([
      ['deepseek', 'DeepSeek'],
      ['gpt', 'GPT'],
      ['glm', 'GLM'],
      ['qwen', 'Qwen'],
      ['claude', 'Claude'],
      ['gemini', 'Gemini'],
      ['grok', 'Grok'],
      ['llama', 'Llama'],
      ['mistral', 'Mistral'],
      ['moonshot', 'Moonshot'],
      ['kimi', 'Kimi'],
      ['gemma', 'Gemma'],
      ['phi', 'Phi'],
      ['yi', 'Yi'],
      ['sonnet', 'Sonnet'],
      ['haiku', 'Haiku'],
      ['opus', 'Opus'],
      ['turbo', 'Turbo'],
      ['mini', 'Mini'],
      ['max', 'Max'],
      ['pro', 'Pro'],
      ['flash', 'Flash'],
      ['nano', 'Nano'],
      ['lite', 'Lite'],
      ['vl', 'VL'],
      ['vision', 'Vision'],
      ['instruct', 'Instruct'],
      ['chat', 'Chat'],
      ['reasoner', 'Reasoner'],
      ['coder', 'Coder'],
      ['math', 'Math'],
      ['r1', 'R1'],
      ['azure', 'Azure'],
      ['ollama', 'Ollama'],
      ['local', 'Local'],
    ])('maps the "%s" token to "%s"', (token, expected) => {
      expect(formatModelDisplayName(token)).toBe(expected)
    })
  })

  describe('version and size tokens', () => {
    test.each([['4'], ['3.5'], ['2.5'], ['131k'], ['7b'], ['128k'], ['4o']])(
      'keeps the numeric token "%s" verbatim',
      (token) => {
        expect(formatModelDisplayName(token)).toBe(token)
      }
    )
  })

  describe('OpenAI o-series', () => {
    test('a leading o-series token keeps its lower-case form', () => {
      expect(formatModelDisplayName('o1-mini')).toBe('o1-mini')
      expect(formatModelDisplayName('o3')).toBe('o3')
      expect(formatModelDisplayName('o4-mini')).toBe('o4-mini')
    })
  })

  describe('gpt compounds', () => {
    test('a version token right after "gpt" is glued with a hyphen', () => {
      expect(formatModelDisplayName('gpt-4o')).toBe('GPT-4o')
      expect(formatModelDisplayName('gpt-4-turbo')).toBe('GPT-4 Turbo')
      expect(formatModelDisplayName('gpt-4o-mini')).toBe('GPT-4o Mini')
    })
  })

  describe('separators', () => {
    test('splits on hyphens, underscores and slashes', () => {
      expect(formatModelDisplayName('deepseek_reasoner')).toBe(
        'DeepSeek Reasoner'
      )
      expect(formatModelDisplayName('deepseek/reasoner')).toBe(
        'DeepSeek Reasoner'
      )
    })

    test('leaves a dot of a version number intact', () => {
      expect(formatModelDisplayName('gemini-2.5-pro')).toBe('Gemini 2.5 Pro')
      expect(formatModelDisplayName('claude-3.5-sonnet')).toBe(
        'Claude 3.5 Sonnet'
      )
    })
  })

  describe('unknown tokens', () => {
    test('capitalises an unmapped alphabetic token', () => {
      expect(formatModelDisplayName('kimi-k2')).toBe('Kimi K2')
    })
  })

  describe('defensive behaviour', () => {
    test('returns empty input unchanged', () => {
      expect(formatModelDisplayName('')).toBe('')
    })

    test('returns whitespace-only input unchanged', () => {
      expect(formatModelDisplayName('   ')).toBe('   ')
    })

    test('never throws and never empties a non-empty input', () => {
      expect(() => formatModelDisplayName('---')).not.toThrow()
      expect(formatModelDisplayName('---')).toBe('---')
      expect(formatModelDisplayName('-')).toBe('-')
      expect(formatModelDisplayName('///')).toBe('///')
    })
  })
})
