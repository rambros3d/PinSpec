/**
 * Pure helpers for the optional, shareable workspace project name.
 *
 * The word list is UI vocabulary, not MCU data. Family and MCU identifiers come
 * only from generated chip metadata supplied by the caller. No host-level
 * random source is used here: the caller injects the RNG so generation is
 * deterministic under test.
 */

import type { ChipData } from './types';

/** Fixed, neutral vocabulary for the two leading name words. */
export const PROJECT_NAME_WORDS: readonly string[] = [
  'amber',
  'quartz',
  'cedar',
  'copper',
  'indigo',
  'moss',
  'onyx',
  'river',
  'silver',
  'violet',
  'willow',
  'zinc',
];

export const MAX_PROJECT_NAME_LENGTH = 48;

/**
 * Lowercase, constrain to letters/digits/hyphens and cap the length. Empty or
 * non-string values have no normalized name.
 */
export function normalizeProjectName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH)
    .replace(/-+$/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Choose one vocabulary entry from a clamped RNG sample in [0, 1). */
function pickWord(rng: () => number): string {
  const sample = rng();
  const safe = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 1) : 0;
  const index = Math.min(Math.floor(safe * PROJECT_NAME_WORDS.length), PROJECT_NAME_WORDS.length - 1);
  return PROJECT_NAME_WORDS[index];
}

/**
 * Compose `word-word-family`. The suffix is read from the generated chip's
 * family identifier, falling back to its MCU identifier; no part table is used.
 */
export function generateProjectName(
  chip: Pick<ChipData, 'family' | 'id'>,
  rng: () => number,
): string {
  const suffix = normalizeProjectName(chip.family) ?? normalizeProjectName(chip.id) ?? 'project';
  return normalizeProjectName(`${pickWord(rng)}-${pickWord(rng)}-${suffix}`) ?? suffix;
}
