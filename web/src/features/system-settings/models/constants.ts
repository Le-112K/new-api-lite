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
// Labels reuse the existing sentence-case i18n keys defined for form fields
// (e.g. `Model ratio`, `Audio completion ratio`). Do NOT switch to Title Case
// here without updating the i18n catalog; otherwise we end up with two keys per
// ratio type that only differ in capitalization.
export const RATIO_TYPE_OPTIONS = [
  { label: 'Model ratio', value: 'model_ratio' },
  { label: 'Completion ratio', value: 'completion_ratio' },
  { label: 'Cache ratio', value: 'cache_ratio' },
  { label: 'Create cache ratio', value: 'create_cache_ratio' },
  { label: 'Image ratio', value: 'image_ratio' },
  { label: 'Audio ratio', value: 'audio_ratio' },
  { label: 'Audio completion ratio', value: 'audio_completion_ratio' },
  { label: 'Fixed price', value: 'model_price' },
] as const

// Single source of truth: `features/channels/constants` owns the channel status
// enum, its labels and its badge variants. This file used to keep its own copy,
// which drifted — status 2 was `danger` here and `neutral` on the channels page,
// so the same channel showed two different colours on two screens.
//
// The re-exported map also carries the `0: Unknown` entry that the local copy
// lacked. Consumers here index it defensively and fall back on a falsy config,
// so status 0 still renders the same neutral "Unknown" badge as before — the
// fallback branch simply stops being reached.
export { CHANNEL_STATUS_CONFIG } from '@/features/channels/constants'
