import { dataUrl } from '../core/data-url';
import type { CatalogIndexEntry, CatalogMeta, ChipData, VendorId } from '../core/types';

/** Maximum number of chip shards retained in memory; older chips are evicted. */
export const MAX_CACHED_CHIPS = 48;

export interface CatalogFilter {
  vendor?: VendorId | 'all';
  family?: string; // e.g. "G4", "CH32V003", "RP2350"
  packageKind?: string; // e.g. "LQFP", "QFN", "SOP", "BGA"
}

/** One shared in-flight shard request and the callers still interested in it. */
interface PendingChipLoad {
  promise: Promise<ChipData>;
  controller: AbortController;
  abortableConsumers: number;
  pinnedConsumers: number;
}

/** Stable rejection for cancelled loads, recognizable by `name`. */
function abortedChipLoad(): Error {
  const error = new Error('Chip load was aborted.');
  error.name = 'AbortError';
  return error;
}

export function searchCatalogEntries(
  entries: CatalogIndexEntry[],
  query: string,
  filter?: CatalogFilter,
  limit = 60,
): CatalogIndexEntry[] {
  const q = query.trim().toUpperCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const vendorFilter = filter?.vendor && filter.vendor !== 'all' ? filter.vendor : '';
  const familyFilter = filter?.family?.toUpperCase() ?? '';
  const pkgFilter = filter?.packageKind?.toUpperCase() ?? '';

  const scored: Array<{ entry: CatalogIndexEntry; score: number }> = [];

  for (const entry of entries) {
    if (vendorFilter && entry.vendor !== vendorFilter) {
      continue;
    }
    if (
      familyFilter &&
      entry.family.toUpperCase() !== familyFilter &&
      !entry.family.toUpperCase().endsWith(familyFilter) &&
      !entry.family.toUpperCase().includes(familyFilter)
    ) {
      continue;
    }
    if (pkgFilter) {
      const p = entry.package.toUpperCase();
      if (pkgFilter === 'QFN') {
        if (!p.includes('QFN') && !p.includes('DFN')) continue;
      } else if (pkgFilter === 'BGA') {
        if (!p.includes('BGA') && !p.includes('CSP')) continue;
      } else if (!p.includes(pkgFilter)) {
        continue;
      }
    }

    if (tokens.length === 0) {
      scored.push({ entry, score: 0 });
      continue;
    }

    const haystack = `${entry.id} ${entry.family} ${entry.package} ${entry.core} ${entry.vendor} ${entry.pinCount}PIN`.toUpperCase();
    let totalScore = 0;
    let matchedAll = true;

    for (const tok of tokens) {
      if (entry.id.startsWith(tok)) {
        totalScore += 100;
      } else if (entry.id.includes(tok)) {
        totalScore += 60;
      } else if (entry.package.toUpperCase().includes(tok)) {
        totalScore += 45;
      } else if (haystack.includes(tok)) {
        totalScore += 30;
      } else {
        // Lightweight ordered subsequence fuzzy match on part ID
        let ti = 0;
        const id = entry.id;
        for (let i = 0; i < id.length && ti < tok.length; i++) {
          if (id[i] === tok[ti]) ti++;
        }
        if (ti === tok.length) {
          totalScore += 12;
        } else {
          matchedAll = false;
          break;
        }
      }
    }

    if (matchedAll) {
      scored.push({ entry, score: totalScore });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.id.localeCompare(b.entry.id);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}

class CatalogStore {
  meta = $state<CatalogMeta | null>(null);
  index = $state<CatalogIndexEntry[]>([]);
  loadingIndex = $state(false);
  indexError = $state<string | null>(null);

  /** Insertion order is least-recently-used order; hits move entries to the end. */
  private chipCache = new Map<string, ChipData>();
  private chipLoads = new Map<string, PendingChipLoad>();
  private indexPromise: Promise<void> | null = null;

  private dataUrl(relPath: string): string {
    return dataUrl(import.meta.env.BASE_URL || '/', relPath);
  }

  async ensureLoaded(): Promise<void> {
    if (this.meta && this.index.length > 0) return;
    if (this.indexPromise) return this.indexPromise;

    this.loadingIndex = true;
    this.indexError = null;

    this.indexPromise = (async () => {
      try {
        const [metaRes, idxRes] = await Promise.all([
          fetch(this.dataUrl('meta.json')),
          fetch(this.dataUrl('index.json')),
        ]);
        if (!metaRes.ok || !idxRes.ok) {
          throw new Error(
            `Failed to load catalog (${metaRes.status}/${idxRes.status}). Run "npm run gen-data" to generate static chip data.`,
          );
        }
        const [metaData, idxData] = (await Promise.all([
          metaRes.json(),
          idxRes.json(),
        ])) as [CatalogMeta, CatalogIndexEntry[]];
        this.meta = metaData;
        this.index = idxData;
      } catch (err) {
        this.indexError = err instanceof Error ? err.message : 'Unable to load MCU catalog.';
      } finally {
        this.loadingIndex = false;
      }
    })();

    return this.indexPromise;
  }

  /**
   * Retry a failed catalog load by discarding the cached promise and the
   * partial state before running the existing loader again.
   */
  retry(): Promise<void> {
    this.indexPromise = null;
    this.indexError = null;
    this.meta = null;
    this.index = [];
    return this.ensureLoaded();
  }

  /** Inserts a chip as the most recently used entry and evicts past the cap. */
  private rememberChip(key: string, chip: ChipData): void {
    this.chipCache.delete(key);
    this.chipCache.set(key, chip);
    while (this.chipCache.size > MAX_CACHED_CHIPS) {
      const oldest = this.chipCache.keys().next().value;
      if (oldest === undefined) break;
      this.chipCache.delete(oldest);
    }
  }

  /** Starts one fetch for a key and registers it before any caller can join. */
  private startChipLoad(key: string): PendingChipLoad {
    const pending: PendingChipLoad = {
      promise: Promise.resolve(chipSentinel),
      controller: new AbortController(),
      abortableConsumers: 0,
      pinnedConsumers: 0,
    };
    pending.promise = (async () => {
      try {
        const res = await fetch(this.dataUrl(`chips/${encodeURIComponent(key)}.json`), {
          signal: pending.controller.signal,
        });
        if (!res.ok) {
          throw new Error(`MCU "${key}" not found in catalog (HTTP ${res.status}).`);
        }
        const chip = (await res.json()) as ChipData;
        if (this.chipLoads.get(key) === pending) this.rememberChip(key, chip);
        return chip;
      } finally {
        if (this.chipLoads.get(key) === pending) this.chipLoads.delete(key);
      }
    })();
    this.chipLoads.set(key, pending);
    return pending;
  }

  /** Attaches one caller's signal to a shared load without cancelling other callers. */
  private joinChipLoad(key: string, pending: PendingChipLoad, signal?: AbortSignal): Promise<ChipData> {
    if (!signal) {
      pending.pinnedConsumers += 1;
      return pending.promise;
    }
    if (signal.aborted) return Promise.reject(abortedChipLoad());
    pending.abortableConsumers += 1;
    return new Promise<ChipData>((resolve, reject) => {
      const onAbort = (): void => {
        signal.removeEventListener('abort', onAbort);
        pending.abortableConsumers -= 1;
        if (pending.abortableConsumers <= 0 && pending.pinnedConsumers === 0) {
          pending.controller.abort();
        }
        reject(abortedChipLoad());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      pending.promise.then(
        (chip) => {
          signal.removeEventListener('abort', onAbort);
          resolve(chip);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  /**
   * Loads one chip shard. Repeated calls share an in-flight request and a
   * bounded LRU cache. An optional signal cancels only the calling consumer;
   * the shared request continues while another caller still needs it.
   */
  async loadChip(mcuId: string, signal?: AbortSignal): Promise<ChipData> {
    const key = mcuId.trim().toUpperCase();
    if (signal?.aborted) return Promise.reject(abortedChipLoad());
    const cached = this.chipCache.get(key);
    if (cached) {
      this.rememberChip(key, cached);
      return cached;
    }
    const pending = this.chipLoads.get(key) ?? this.startChipLoad(key);
    return this.joinChipLoad(key, pending, signal);
  }
}

/** Placeholder replaced by the real promise before any fetch starts. */
const chipSentinel: ChipData = {
  id: '',
  family: '',
  core: '',
  flashKb: null,
  ramKb: 0,
  package: { name: '', kind: 'perimeter', pinCount: 0 },
  pins: [],
  peripherals: {},
};

export const catalogStore = new CatalogStore();
