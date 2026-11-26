import { describe, expect, it } from 'vitest';
import { sortCatalogEntries, type CatalogSortField } from '../src/core/catalog-sort';
import type { CatalogIndexEntry } from '../src/core/types';

function entry(id: string, pinCount: number, flashKb: number | null, ramKb: number): CatalogIndexEntry {
  return {
    id,
    vendor: 'stm32',
    family: 'STM32G4',
    core: 'Cortex-M4',
    package: 'LQFP48',
    pinCount,
    flashKb,
    ramKb,
    geometry: { kind: 'perimeter', sides: [12, 12, 12, 12], rows: [], cols: [], hasExposedPad: false },
  };
}

const ENTRIES = [
  entry('STM32G431CBU6', 48, 128, 32),
  entry('STM32G474RET6', 64, 512, 128),
  entry('STM32G030F6P6', 20, null, 8),
  entry('STM32G431CBU7', 48, 128, 32),
];

function ids(field: CatalogSortField): string[] {
  return sortCatalogEntries(ENTRIES, field).map((item) => item.id);
}

describe('catalog result sorting', () => {
  it('orders by part number with numeric tie-breaking', () => {
    expect(ids('part')).toEqual([
      'STM32G030F6P6',
      'STM32G431CBU6',
      'STM32G431CBU7',
      'STM32G474RET6',
    ]);
  });

  it('orders by pin count with stable part order for ties', () => {
    expect(ids('pins')).toEqual([
      'STM32G030F6P6',
      'STM32G431CBU6',
      'STM32G431CBU7',
      'STM32G474RET6',
    ]);
  });

  it('orders by flash with absent values last', () => {
    expect(ids('flash')).toEqual([
      'STM32G431CBU6',
      'STM32G431CBU7',
      'STM32G474RET6',
      'STM32G030F6P6',
    ]);
  });

  it('orders by RAM with stable part order for ties', () => {
    expect(ids('ram')).toEqual([
      'STM32G030F6P6',
      'STM32G431CBU6',
      'STM32G431CBU7',
      'STM32G474RET6',
    ]);
  });

  it('does not mutate the input index slice', () => {
    const before = ENTRIES.map((item) => item.id);
    sortCatalogEntries(ENTRIES, 'flash');
    expect(ENTRIES.map((item) => item.id)).toEqual(before);
  });
});
