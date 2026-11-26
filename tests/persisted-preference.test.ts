import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPersistedRecord, writePersistedRecord } from '../src/state/persisted-preference.svelte';

function installStorage(): Map<string, string> {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  return storage;
}

/** Svelte runes require a fresh module for each isolated store instance. */
async function freshHelper() {
  vi.resetModules();
  return import('../src/state/persisted-preference.svelte.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shared persisted preference helper', () => {
  it('normalizes stored values and writes through a namespaced record', async () => {
    const storage = installStorage();
    storage.set('pinspec:test_v1', JSON.stringify({ flag: 'yes', untouched: 'keep' }));
    const { createPersistedPreference } = await freshHelper();
    const flag = createPersistedPreference<boolean>(
      'pinspec:test_v1',
      false,
      (value) => value === true,
      'flag',
    );
    expect(flag.value).toBe(false);

    flag.set(true);
    expect(flag.value).toBe(true);
    expect(JSON.parse(storage.get('pinspec:test_v1') ?? '{}')).toEqual({
      flag: true,
      untouched: 'keep',
    });
  });

  it('uses the documented default when no value exists and skips no-op writes', async () => {
    const storage = installStorage();
    const writes: string[] = [];
    const original = window.localStorage.setItem;
    window.localStorage.setItem = (key: string, value: string) => {
      writes.push(value);
      original(key, value);
    };
    const { createPersistedPreference } = await freshHelper();
    const mode = createPersistedPreference<string>(
      'pinspec:mode_v1',
      'system',
      (value) => (value === 'light' || value === 'dark' ? value : 'system'),
    );
    expect(mode.value).toBe('system');
    mode.set('system');
    expect(writes).toEqual([]);
    mode.set('dark');
    expect(writes).toEqual(['dark']);
    expect(storage.get('pinspec:mode_v1')).toBe('dark');
  });

  it('restores a persisted value after a simulated reload', async () => {
    const storage = installStorage();
    const first = await freshHelper();
    const preference = first.createPersistedPreference<string>(
      'pinspec:query_v1',
      '',
      (value) => (typeof value === 'string' ? value : ''),
      'query',
    );
    preference.set('STM32G431');
    expect(JSON.parse(storage.get('pinspec:query_v1') ?? '{}')).toEqual({ query: 'STM32G431' });

    const second = await freshHelper();
    const reloaded = second.createPersistedPreference<string>(
      'pinspec:query_v1',
      '',
      (value) => (typeof value === 'string' ? value : ''),
      'query',
    );
    expect(reloaded.value).toBe('STM32G431');
  });

  it('keeps values in memory when storage is unavailable or malformed', async () => {
    const storage = installStorage();
    storage.set('pinspec:broken_v1', 'not json');
    const { createPersistedPreference } = await freshHelper();
    const preference = createPersistedPreference<number>(
      'pinspec:broken_v1',
      0,
      (value) => (typeof value === 'number' ? value : 0),
      'count',
    );
    expect(preference.value).toBe(0);
    expect(() => preference.set(3)).not.toThrow();
    expect(preference.value).toBe(3);
    expect(JSON.parse(storage.get('pinspec:broken_v1') ?? '{}')).toEqual({ count: 3 });

    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage disabled');
      },
    });
    const offline = createPersistedPreference<boolean>(
      'pinspec:offline_v1',
      false,
      (value) => value === true,
      'enabled',
    );
    expect(offline.value).toBe(false);
    expect(() => offline.set(true)).not.toThrow();
    expect(offline.value).toBe(true);
  });

  it('exposes record read and write primitives that tolerate blocked storage', async () => {
    installStorage();
    const { readPersistedRecord, writePersistedRecord: write } = await freshHelper();
    expect(readPersistedRecord('missing')).toEqual({});
    write('pinspec:record_v1', { a: 1 });
    expect(readPersistedRecord('pinspec:record_v1')).toEqual({ a: 1 });

    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage disabled');
      },
    });
    expect(readPersistedRecord('pinspec:record_v1')).toEqual({});
    expect(() => write('pinspec:record_v1', { a: 2 })).not.toThrow();
    expect(() => writePersistedRecord('pinspec:record_v1', { a: 3 })).not.toThrow();
  });
});
