import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChipData } from '../src/core/types';
import { catalogStore, MAX_CACHED_CHIPS } from '../src/state/catalog.svelte';

function chip(id: string): ChipData {
  return {
    id,
    family: 'TEST',
    core: 'Cortex-M0+',
    flashKb: 64,
    ramKb: 16,
    package: { name: 'QFN32', kind: 'perimeter', pinCount: 32, sides: [8, 8, 8, 8] },
    pins: [],
    peripherals: {},
  };
}

interface FetchCall {
  url: string;
  signal?: AbortSignal;
}

function stubFetch(handler: (call: FetchCall) => Promise<unknown>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(input), signal: init?.signal as AbortSignal | undefined };
      calls.push(call);
      return (await handler(call)) as Response;
    },
  );
  return calls;
}

function okResponse(value: unknown): unknown {
  return { ok: true, status: 200, json: async () => value };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('catalog chip cache', () => {
  it('deduplicates concurrent requests and reuses the settled chip', async () => {
    const calls = stubFetch(async (call) => okResponse(chip(call.url.split('/').pop()!.replace('.json', ''))));
    const [a, b] = await Promise.all([
      catalogStore.loadChip('DEDUP-A'),
      catalogStore.loadChip('DEDUP-A'),
    ]);
    expect(a).toBe(b);
    expect(calls).toHaveLength(1);
    await catalogStore.loadChip('DEDUP-A');
    expect(calls).toHaveLength(1);
  });

  it('removes failed loads so a later call retries', async () => {
    let attempt = 0;
    const calls = stubFetch(async () => {
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 404 };
      return okResponse(chip('RETRY-A'));
    });
    await expect(catalogStore.loadChip('RETRY-A')).rejects.toThrow('HTTP 404');
    await expect(catalogStore.loadChip('RETRY-A')).resolves.toMatchObject({ id: 'RETRY-A' });
    expect(calls).toHaveLength(2);
  });

  it('evicts the least recently used chip at the documented cap', async () => {
    expect(MAX_CACHED_CHIPS).toBe(48);
    const calls = stubFetch(async (call) => okResponse(chip(call.url.split('/').pop()!.replace('.json', ''))));
    for (let i = 0; i < MAX_CACHED_CHIPS + 1; i++) {
      await catalogStore.loadChip(`LRU-${i}`);
    }
    expect(calls).toHaveLength(MAX_CACHED_CHIPS + 1);
    // The second-oldest entry was kept; the oldest was evicted.
    await catalogStore.loadChip('LRU-1');
    expect(calls).toHaveLength(MAX_CACHED_CHIPS + 1);
    await catalogStore.loadChip('LRU-0');
    expect(calls).toHaveLength(MAX_CACHED_CHIPS + 2);
  });

  it('rejects a pre-aborted signal without starting a fetch', async () => {
    const calls = stubFetch(async () => okResponse(chip('ABORT-EARLY')));
    const controller = new AbortController();
    controller.abort();
    await expect(catalogStore.loadChip('ABORT-EARLY', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(calls).toHaveLength(0);
  });

  it('keeps a shared load alive for a pinned caller after another aborts', async () => {
    let resolveResponse: (value: unknown) => void = () => undefined;
    const calls = stubFetch(
      () =>
        new Promise<unknown>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const controller = new AbortController();
    const aborted = catalogStore.loadChip('SHARED-ABORT', controller.signal);
    const pinned = catalogStore.loadChip('SHARED-ABORT');
    expect(calls).toHaveLength(1);
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls[0].signal?.aborted).toBe(false);
    resolveResponse(okResponse(chip('SHARED-ABORT')));
    await expect(pinned).resolves.toMatchObject({ id: 'SHARED-ABORT' });
  });

  it('aborts the shared fetch when its only caller cancels', async () => {
    let rejectResponse: (reason?: unknown) => void = () => undefined;
    let attempt = 0;
    const calls = stubFetch(async () => {
      attempt += 1;
      if (attempt > 1) return okResponse(chip('SOLO-ABORT'));
      return new Promise<unknown>((_resolve, reject) => {
        rejectResponse = reject;
      });
    });
    const controller = new AbortController();
    const pending = catalogStore.loadChip('SOLO-ABORT', controller.signal);
    expect(calls).toHaveLength(1);
    controller.abort();
    expect(calls[0].signal?.aborted).toBe(true);
    rejectResponse(new Error('fetch aborted'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(catalogStore.loadChip('SOLO-ABORT')).resolves.toMatchObject({ id: 'SOLO-ABORT' });
  });
});
