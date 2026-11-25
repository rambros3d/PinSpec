import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapWithConcurrency, MAX_CONCURRENT_SHARD_LOADS } from '../src/core/compatibility';
import {
  approximateThumbnailFromIndex,
  approximateThumbnailGeometry,
  MAX_THUMBNAIL_REFINEMENTS,
  thumbnailGeometryFromChip,
  thumbnailPadMarks,
} from '../src/core/package-thumbnail';
import type { CatalogIndexEntry, ChipData } from '../src/core/types';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readChip = (id: string): ChipData =>
  JSON.parse(read(`public/data/chips/${id}.json`)) as ChipData;

const indexEntry: CatalogIndexEntry = {
  id: 'STM32G431CBU6',
  family: 'STM32G4',
  core: 'Cortex-M4',
  package: 'UFQFPN48',
  pinCount: 48,
  flashKb: 128,
  ramKb: 32,
  peripherals: { spi: 1, i2c: 1, usart: 1, can: 1, usb: 0, tim: 1, adc: 1 },
};

describe('pure package geometry', () => {
  it('exports every thumbnail contract from the pure core module', () => {
    const source = read('src/core/package-thumbnail.ts');
    for (const symbol of [
      'ThumbnailGeometry',
      'approximateThumbnailGeometry',
      'approximateThumbnailFromIndex',
      'thumbnailGeometryFromChip',
      'MAX_THUMBNAIL_REFINEMENTS',
    ]) {
      expect(source, symbol).toContain(symbol);
    }
    expect(source).not.toMatch(/from ['"]svelte|window\.|document\./);
    expect(MAX_THUMBNAIL_REFINEMENTS).toBe(40);
  });

  it('derives four-sided, two-sided, grid and unknown silhouettes from index data', () => {
    const qfp = approximateThumbnailFromIndex(indexEntry);
    expect(qfp.kind).toBe('perimeter');
    expect(qfp.sides.reduce((a, b) => a + b, 0)).toBe(48);
    expect(qfp.fidelity).toBe('approximate');

    const sop = approximateThumbnailGeometry('SOP8', 8);
    expect(sop.sides).toEqual([4, 0, 4, 0]);
    expect(approximateThumbnailGeometry('SO20', 20).sides).toEqual([10, 0, 10, 0]);

    const bga = approximateThumbnailGeometry('TFBGA144', 144);
    expect(bga.kind).toBe('grid');
    expect(bga.rows * bga.cols).toBeGreaterThanOrEqual(144);
    expect(bga.fidelity).toBe('approximate');

    const unknown = approximateThumbnailGeometry('CUSTOM', 12);
    expect(unknown.sides).toEqual([0, 0, 0, 0]);
    expect(Number.isFinite(unknown.pinCount)).toBe(true);
  });

  it('never emits NaN or undefined for malformed index values', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const geometry = approximateThumbnailGeometry('QFN', value);
      expect(geometry.sides.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(geometry.pinCount)).toBe(true);
      expect(geometry.rows).toBe(0);
      expect(geometry.hasExposedPad).toBe(false);
      expect(JSON.stringify(geometry)).not.toContain('null');
    }
  });

  it('maps generated shard geometry without hardcoding part identifiers', () => {
    const chip = readChip('CH32V003J4M6');
    const geometry = thumbnailGeometryFromChip(chip);
    expect(geometry.kind).toBe(chip.package.kind);
    expect(geometry.sides).toEqual(chip.package.sides);
    expect(geometry.pinCount).toBe(chip.package.pinCount);
    expect(geometry.fidelity).toBe('exact');

    const grid = thumbnailGeometryFromChip(readChip('STM32H743XIH6'));
    expect(grid.kind).toBe('grid');
    expect(grid.rows).toBe(readChip('STM32H743XIH6').package.rows?.length ?? 0);
    expect(grid.cols).toBe(readChip('STM32H743XIH6').package.cols?.length ?? 0);

    const exposed = thumbnailGeometryFromChip(readChip('RP2350B'));
    expect(exposed.hasExposedPad).toBe(true);
    expect(read('src/core/package-thumbnail.ts')).not.toMatch(/STM32G431|RP2350B|CH32V003/);
  });

  it('emits one static mark per declared pad or ball', () => {
    const perimeter = approximateThumbnailGeometry('LQFP48', 48);
    expect(thumbnailPadMarks(perimeter)).toHaveLength(
      perimeter.sides.reduce((a, b) => a + b, 0),
    );
    const grid = approximateThumbnailGeometry('BGA144', 144);
    expect(thumbnailPadMarks(grid)).toHaveLength(grid.rows * grid.cols);
    expect(thumbnailPadMarks(approximateThumbnailGeometry('UNKNOWN', 4))).toHaveLength(0);
  });
});

describe('bounded visible-row refinement', () => {
  it('keeps at most four shard loads in flight with concurrency helper', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `PART${i}`);
    let active = 0;
    let maxActive = 0;
    const result = await mapWithConcurrency(
      ids,
      MAX_CONCURRENT_SHARD_LOADS,
      async (id) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return id;
      },
    );
    expect(result).toEqual(ids);
    expect(maxActive).toBeLessThanOrEqual(MAX_CONCURRENT_SHARD_LOADS);
  });

  it('drops stale results after a generation change', async () => {
    const resolvers: Array<(value: number) => void> = [];
    let cancelled = false;
    const pending = mapWithConcurrency(
      [1, 2, 3, 4],
      MAX_CONCURRENT_SHARD_LOADS,
      () => new Promise<number>((resolve) => resolvers.push(resolve)),
      () => cancelled,
    );
    await Promise.resolve();
    expect(resolvers).toHaveLength(MAX_CONCURRENT_SHARD_LOADS);
    cancelled = true;
    for (const resolve of resolvers) resolve(1);
    expect(await pending).toEqual([]);
  });

  it('caps one pass and keeps approximate geometry when a shard fails', async () => {
    const visible = Array.from({ length: 60 }, (_, i) => `PART${i}`);
    const pending = visible.slice(0, MAX_THUMBNAIL_REFINEMENTS);
    expect(pending).toHaveLength(40);
    const failures = new Set(['PART2']);
    const outcomes = await mapWithConcurrency(pending, MAX_CONCURRENT_SHARD_LOADS, async (id) =>
      failures.has(id) ? null : { id, kind: 'perimeter' as const },
    );
    expect(outcomes).toHaveLength(40);
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    const exact: Record<string, string> = {};
    for (const outcome of outcomes) if (outcome) exact[outcome.id] = outcome.kind;
    expect(exact.PART2).toBeUndefined();
    expect(exact.PART0).toBe('perimeter');
  });
});

describe('thumbnail surfaces', () => {
  const component = read('src/components/catalog/PackageThumbnail.svelte');
  const catalog = read('src/pages/CatalogPage.svelte');
  const projects = read('src/pages/ProjectsPage.svelte');

  it('renders a decorative themed SVG without interaction or texture', () => {
    for (const token of [
      'package-thumbnail',
      'data-fidelity={geometry.fidelity}',
      'pointer-events-none',
      'aria-hidden="true"',
      'fill-base-100',
      'stroke-base-300',
      'fill-base-content/40',
      'thumbnailPadMarks(geometry)',
    ]) {
      expect(component, token).toContain(token);
    }
    for (const token of [
      'onclick=',
      'onpointer',
      'onkeydown=',
      'tabindex',
      '<defs>',
      'feTurbulence',
      '<filter',
    ]) {
      expect(component, token).not.toContain(token);
    }
    expect(component).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('adds a leading catalog column and refines only observed rows', () => {
    for (const token of [
      '<PackageThumbnail',
      'use:observeRow={entry.id}',
      'new IntersectionObserver',
      'generation += 1',
      'onDestroy(',
      'mapWithConcurrency(',
      'MAX_CONCURRENT_SHARD_LOADS',
      'MAX_THUMBNAIL_REFINEMENTS',
      'catalogStore.loadChip(',
      'thumbnailGeometryFromChip(',
      'approximateThumbnailFromIndex(',
    ]) {
      expect(catalog, token).toContain(token);
    }
    expect(catalog.match(/loadChip\(/g)).toHaveLength(1);
    expect(catalog).toContain('w-12 px-2 py-2 font-medium">Outline');
  });

  it('derives project card outlines from stored fields with no shard fetch', () => {
    expect(projects).toContain('approximateThumbnailGeometry(session.packageName, session.pinCount)');
    expect(projects).not.toContain('loadChip(');
    for (const token of [
      'workspaceStore.recentSessions.slice(0, 10)',
      'grid grid-cols-1',
      'formatRelativeTime(session.updatedAt)',
      'openSession(session.mcuId)',
      'exportSession(session.mcuId)',
      'deleteSession(session.mcuId)',
      'href="#/catalog"',
      'parsePinoutJson(',
      'exportPinoutJson(',
      'setPendingHandoff(parsed.state)',
    ]) {
      expect(projects, token).toContain(token);
    }
  });

  it('does not add a thumbnail field to share or project payloads', () => {
    const url = read('src/core/url-state.ts');
    const json = read('src/core/exporters/json.ts');
    for (const source of [url, json]) {
      expect(source).not.toContain('thumbnail');
      expect(source).not.toContain('geometry');
      expect(source).not.toContain('fidelity');
    }
  });
});
