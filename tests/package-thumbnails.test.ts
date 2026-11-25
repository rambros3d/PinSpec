import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  thumbnailGeometryFromIndex,
  thumbnailGeometryFromSaved,
  thumbnailPadMarks,
} from '../src/core/package-thumbnail';
import type { CatalogIndexEntry, ChipData } from '../src/core/types';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readChip = (id: string): ChipData =>
  JSON.parse(read(`public/data/chips/${id}.json`)) as ChipData;
const readIndex = (): CatalogIndexEntry[] =>
  JSON.parse(read('public/data/index.json')) as CatalogIndexEntry[];

const perimeterEntry: CatalogIndexEntry = {
  id: 'STM32G431CBU6',
  vendor: 'stm32',
  family: 'STM32G4',
  core: 'Cortex-M4',
  package: 'UFQFPN48',
  pinCount: 48,
  flashKb: 128,
  ramKb: 32,
  geometry: { kind: 'perimeter', sides: [12, 12, 12, 12] },
};

describe('pure package geometry', () => {
  it('exports only the exact index geometry surface from the pure core module', () => {
    const source = read('src/core/package-thumbnail.ts');
    for (const symbol of [
      'ThumbnailGeometry',
      'thumbnailGeometryFromIndex',
      'thumbnailGeometryFromSaved',
      'thumbnailPadMarks',
    ]) {
      expect(source, symbol).toContain(symbol);
    }
    for (const stale of [
      'approximate',
      'fidelity',
      'MAX_THUMBNAIL_REFINEMENTS',
      'thumbnailGeometryFromChip',
      'ChipData',
    ]) {
      expect(source, stale).not.toContain(stale);
    }
    expect(source).not.toMatch(/from ['"]svelte|window\.|document\./);
  });

  it('renders exact perimeter geometry from index data', () => {
    const geometry = thumbnailGeometryFromIndex(perimeterEntry);
    expect(geometry.kind).toBe('perimeter');
    expect(geometry.sides).toEqual([12, 12, 12, 12]);
    expect(geometry.rows).toBe(0);
    expect(geometry.cols).toBe(0);
    expect(geometry.hasExposedPad).toBe(false);
    expect(geometry.pinCount).toBe(48);
  });

  it('renders exact grid geometry and exposed-pad state from index data', () => {
    const entry: CatalogIndexEntry = {
      ...perimeterEntry,
      id: 'STM32H743XIH6',
      package: 'TFBGA176',
      pinCount: 176,
      geometry: { kind: 'grid', rows: ['A', 'B', 'C', 'D'], cols: [1, 2, 3, 4, 5], hasExposedPad: true },
    };
    const geometry = thumbnailGeometryFromIndex(entry);
    expect(geometry.kind).toBe('grid');
    expect(geometry.rows).toBe(4);
    expect(geometry.cols).toBe(5);
    expect(geometry.hasExposedPad).toBe(true);
  });

  it('degrades malformed or absent geometry to a plain finite outline', () => {
    const bad = thumbnailGeometryFromIndex({
      ...perimeterEntry,
      geometry: undefined as unknown as CatalogIndexEntry['geometry'],
    });
    expect(bad.sides).toEqual([0, 0, 0, 0]);
    expect(JSON.stringify(bad)).not.toContain('null');
    const zero = thumbnailGeometryFromIndex({
      ...perimeterEntry,
      pinCount: Number.NaN,
      geometry: { kind: 'perimeter', sides: [-1, 2, 3, 4] },
    });
    expect(zero.pinCount).toBe(0);
    expect(zero.sides[0]).toBe(0);
  });

  it('derives saved-session outlines without fetching shards', () => {
    expect(thumbnailGeometryFromSaved('SOP8', 8).sides).toEqual([4, 0, 4, 0]);
    expect(thumbnailGeometryFromSaved('LQFP48', 48).sides).toEqual([12, 12, 12, 12]);
    const grid = thumbnailGeometryFromSaved('TFBGA144', 144);
    expect(grid.kind).toBe('grid');
    expect(grid.rows * grid.cols).toBeGreaterThanOrEqual(144);
    expect(read('src/pages/ProjectsPage.svelte')).not.toContain('loadChip(');
  });

  it('emits one static mark per declared pad or ball', () => {
    const geometry = thumbnailGeometryFromIndex(perimeterEntry);
    expect(thumbnailPadMarks(geometry)).toHaveLength(48);
    const grid = thumbnailGeometryFromIndex({
      ...perimeterEntry,
      geometry: { kind: 'grid', rows: ['A', 'B'], cols: [1, 2, 3] },
    });
    expect(thumbnailPadMarks(grid)).toHaveLength(6);
    expect(thumbnailPadMarks(thumbnailGeometryFromIndex({
      ...perimeterEntry,
      geometry: { kind: 'perimeter' },
    }))).toHaveLength(0);
  });

  it('copies exact geometry from every emitted index entry', () => {
    const chips = new Map(readIndex().map((entry) => [entry.id, readChip(entry.id)]));
    for (const entry of readIndex()) {
      const chip = chips.get(entry.id)!;
      expect(entry.vendor).toBeTruthy();
      expect(entry).not.toHaveProperty('peripherals');
      expect(entry).not.toHaveProperty('series');
      expect(entry.geometry.kind).toBe(chip.package.kind);
      expect(entry.geometry.sides ?? null).toEqual(chip.package.sides ?? null);
      expect(entry.geometry.rows ?? null).toEqual(chip.package.rows ?? null);
      expect(entry.geometry.cols ?? null).toEqual(chip.package.cols ?? null);
      expect(Boolean(entry.geometry.hasExposedPad)).toBe(chip.package.hasExposedPad === true);
    }
  });
});

describe('thumbnail surfaces', () => {
  const component = read('src/components/catalog/PackageThumbnail.svelte');
  const catalog = read('src/pages/CatalogPage.svelte');
  const projects = read('src/pages/ProjectsPage.svelte');

  it('renders a decorative themed SVG without interaction, fidelity, or texture', () => {
    for (const token of [
      'package-thumbnail',
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
      'fidelity',
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

  it('keeps the leading catalog column without any shard refinement', () => {
    expect(catalog).toContain('w-12 px-2 py-2 font-medium">Outline');
    expect(catalog).toContain('<PackageThumbnail');
    expect(catalog).toContain('geometry={thumbnailGeometryFromIndex(entry)} size={44}');
    expect(catalog).toContain('{entry.vendor}');
    for (const stale of [
      'IntersectionObserver',
      'observeRow',
      'visibleIds',
      'exactGeometry',
      'refineVisible',
      'generation',
      'MAX_THUMBNAIL_REFINEMENTS',
      'mapWithConcurrency',
      'loadChip(',
      'thumbnailGeometryFromChip',
      '?? \'stm32\'',
    ]) {
      expect(catalog, stale).not.toContain(stale);
    }
  });

  it('derives project card outlines from stored fields with no shard fetch', () => {
    expect(projects).toContain('thumbnailGeometryFromSaved(session.packageName, session.pinCount)');
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
