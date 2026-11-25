/** Test-only chip shim built on the production `loadChip()` API. */
import { vi } from 'vitest';
import type { ChipData } from '../../src/core/types';

interface ChipLoader {
  loadChip: (mcuId: string) => Promise<ChipData>;
}

const stubs = new WeakMap<object, Map<string, ChipData>>();

/**
 * Register chip shards for a catalog store instance. The first call installs a
 * spy on `loadChip()`; later calls add more chips to the same stub map.
 */
export function stubCatalogChips(store: ChipLoader, ...chips: ChipData[]): void {
  let byId = stubs.get(store);
  if (!byId) {
    byId = new Map<string, ChipData>();
    stubs.set(store, byId);
    vi.spyOn(store, 'loadChip').mockImplementation(async (mcuId: string) => {
      const chip = byId?.get(mcuId.trim().toUpperCase());
      if (!chip) throw new Error(`No stubbed chip for ${mcuId}`);
      return chip;
    });
  }
  for (const chip of chips) byId.set(chip.id.toUpperCase(), chip);
}
