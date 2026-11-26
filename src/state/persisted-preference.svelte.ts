/**
 * Shared localStorage plumbing for UI-only preferences.
 *
 * Presentation state restored from a namespaced record is read once, normalized
 * into a runes-backed value, and written through on every effective change.
 * Storage failures never interrupt the UI: the in-memory value remains usable.
 * None of this state is shareable; it never enters share URLs, version-2
 * project files, recent sessions, or undo history.
 */

/** Normalize an untrusted stored or incoming value into the preference domain. */
export type PreferenceNormalizer<T> = (value: unknown) => T;

/** A runes-backed preference with a normalized getter and a write-through setter. */
export interface PersistedPreference<T> {
  readonly value: T;
  set(next: T): void;
}

/** Read a raw value under a namespaced key; missing or blocked storage yields `undefined`. */
export function readPersistedValue(key: string): unknown {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Read a namespaced JSON record; malformed or blocked storage yields an empty record. */
export function readPersistedRecord(key: string): Record<string, unknown> {
  const raw = readPersistedValue(key);
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Write a raw value under a namespaced key; storage failures are ignored. */
export function writePersistedValue(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Storage may be disabled or full; the in-memory preference still applies.
  }
}

/** Write a whole namespaced JSON record; storage failures are ignored. */
export function writePersistedRecord(key: string, record: Record<string, unknown>): void {
  writePersistedValue(key, JSON.stringify(record));
}

/**
 * Create one runes-backed preference. With a `field`, the helper patches that
 * member of the namespaced JSON record on write; without one, it writes the raw
 * value under the key (the theme mode string).
 */
export function createPersistedPreference<T>(
  key: string,
  defaultValue: T,
  normalize: PreferenceNormalizer<T>,
  field?: string,
): PersistedPreference<T> {
  const initial =
    field === undefined ? readPersistedValue(key) : readPersistedRecord(key)[field];
  let current = $state(normalize(initial === undefined ? defaultValue : initial));

  return {
    get value(): T {
      return current;
    },
    set(next: T): void {
      const normalized = normalize(next);
      if (current === normalized) return;
      current = normalized;
      if (field === undefined) {
        writePersistedValue(key, normalized);
        return;
      }
      const record = readPersistedRecord(key);
      record[field] = normalized;
      writePersistedRecord(key, record);
    },
  };
}
