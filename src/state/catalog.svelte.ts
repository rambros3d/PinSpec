import { dataUrl } from '../core/data-url';
import type { CatalogIndexEntry, CatalogMeta, ChipData, VendorId } from '../core/types';

export interface CatalogFilter {
  vendor?: VendorId | 'all';
  family?: string; // e.g. "G4", "CH32V003", "RP2350"
  packageKind?: string; // e.g. "LQFP", "QFN", "SOP", "BGA"
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
    if (vendorFilter && (entry.vendor ?? 'stm32') !== vendorFilter) {
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

    const haystack = `${entry.id} ${entry.family} ${entry.package} ${entry.core} ${entry.vendor ?? 'stm32'} ${entry.pinCount}PIN`.toUpperCase();
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

  private chipCache = new Map<string, ChipData>();
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

  primeChip(chip: ChipData): void {
    this.chipCache.set(chip.id.toUpperCase(), chip);
  }

  async loadChip(mcuId: string): Promise<ChipData> {
    const key = mcuId.trim().toUpperCase();
    const cached = this.chipCache.get(key);
    if (cached) return cached;

    const res = await fetch(this.dataUrl(`chips/${encodeURIComponent(key)}.json`));
    if (!res.ok) {
      throw new Error(`MCU "${key}" not found in catalog (HTTP ${res.status}).`);
    }
    const chip = (await res.json()) as ChipData;
    this.chipCache.set(key, chip);
    return chip;
  }
}

export const catalogStore = new CatalogStore();
