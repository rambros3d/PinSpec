/**
 * Pure helpers for the optional, shareable workspace project name.
 *
 * The word list is UI vocabulary, not MCU data. Generated names are independent
 * of chip metadata so no MCU fact is read here. No host-level random source is
 * used: the caller injects the RNG so generation is deterministic under test.
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
 * Compose `word-word` from the curated vocabulary. The chip argument is kept
 * for call-site stability but is deliberately not read: saved names are reused
 * unchanged by the workspace store, so generation never renames an existing
 * session or consults a part table.
 */
export function generateProjectName(
  _chip: Pick<ChipData, 'family' | 'id'>,
  rng: () => number,
): string {
  return normalizeProjectName(`${pickWord(rng)}-${pickWord(rng)}`) ?? PROJECT_NAME_WORDS[0];
}
