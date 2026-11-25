/**
 * Pure package-outline geometry for lightweight catalog and session thumbnails.
 *
 * Approximate geometry uses only existing index fields (package string, pin
 * count, vendor and module marker). Exact geometry comes from an already
 * generated per-chip shard. No Svelte or DOM API is used here, and no hardware
 * fact is invented: approximate ball grids are explicitly marked as such.
 */

import type { CatalogIndexEntry, ChipData } from './types';

/** Fixed cap on shard refinements started by one catalog visibility pass. */
export const MAX_THUMBNAIL_REFINEMENTS = 40;

export type ThumbnailFidelity = 'approximate' | 'exact';

export interface ThumbnailGeometry {
  kind: 'perimeter' | 'grid';
  /** [left, bottom, right, top] pad counts; zeros mean a plain body outline. */
  sides: [number, number, number, number];
  /** Ball row count for grid packages, zero for perimeter packages. */
  rows: number;
  /** Ball column count for grid packages, zero for perimeter packages. */
  cols: number;
  hasExposedPad: boolean;
  pinCount: number;
  fidelity: ThumbnailFidelity;
}

export interface ThumbnailMark {
  x: number;
  y: number;
  kind: 'pad' | 'ball';
}

export interface ThumbnailOptions {
  vendor?: string;
  module?: boolean;
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function distributeSides(pinCount: number): [number, number, number, number] {
  const total = finiteCount(pinCount);
  if (total === 0) return [0, 0, 0, 0];
  const base = Math.floor(total / 4);
  const remainder = total % 4;
  return [
    base + (remainder > 0 ? 1 : 0),
    base + (remainder > 1 ? 1 : 0),
    base + (remainder > 2 ? 1 : 0),
    base,
  ];
}

function twoSided(pinCount: number): [number, number, number, number] {
  const half = Math.ceil(finiteCount(pinCount) / 2);
  return [half, 0, half, 0];
}

function squareGrid(pinCount: number): { rows: number; cols: number } {
  const total = finiteCount(pinCount);
  if (total === 0) return { rows: 0, cols: 0 };
  const cols = Math.ceil(Math.sqrt(total));
  return { rows: Math.ceil(total / cols), cols };
}

/**
 * Derive a coarse silhouette from a package string and pin count. Vendor and
 * module markers are accepted for index parity but never used to invent pads
 * or exposed thermal geometry.
 */
export function approximateThumbnailGeometry(
  packageName: string,
  pinCount: number,
  _options: ThumbnailOptions = {},
): ThumbnailGeometry {
  const name = (packageName ?? '').toUpperCase();
  const count = finiteCount(pinCount);

  if (/BGA|WLCSP|CSP/.test(name)) {
    return {
      kind: 'grid',
      sides: [0, 0, 0, 0],
      ...squareGrid(count),
      hasExposedPad: false,
      pinCount: count,
      fidelity: 'approximate',
    };
  }
  if (/SOP|SOIC|SSOP|TSSOP|DIP|\bSO\d/.test(name)) {
    return {
      kind: 'perimeter',
      sides: twoSided(count),
      rows: 0,
      cols: 0,
      hasExposedPad: false,
      pinCount: count,
      fidelity: 'approximate',
    };
  }
  if (/QFP|QFN|DFN|LCC|LQFP|TQFP/.test(name)) {
    return {
      kind: 'perimeter',
      sides: distributeSides(count),
      rows: 0,
      cols: 0,
      hasExposedPad: false,
      pinCount: count,
      fidelity: 'approximate',
    };
  }
  return {
    kind: 'perimeter',
    sides: [0, 0, 0, 0],
    rows: 0,
    cols: 0,
    hasExposedPad: false,
    pinCount: count,
    fidelity: 'approximate',
  };
}

/** Thin wrapper for an existing compact catalog index entry. */
export function approximateThumbnailFromIndex(entry: CatalogIndexEntry): ThumbnailGeometry {
  return approximateThumbnailGeometry(entry.package, entry.pinCount, {
    vendor: entry.vendor,
    module: entry.module,
  });
}

/** Map generated shard geometry into the thumbnail view model. */
export function thumbnailGeometryFromChip(chip: ChipData): ThumbnailGeometry {
  const pkg = chip.package;
  const pinCount = finiteCount(pkg.pinCount);
  if (pkg.kind === 'grid') {
    const rows = pkg.rows?.length ?? 0;
    const cols = pkg.cols?.length ?? 0;
    return {
      kind: 'grid',
      sides: [0, 0, 0, 0],
      rows,
      cols,
      hasExposedPad: pkg.hasExposedPad === true,
      pinCount,
      fidelity: 'exact',
    };
  }
  return {
    kind: 'perimeter',
    sides: pkg.sides ?? distributeSides(pinCount),
    rows: 0,
    cols: 0,
    hasExposedPad: pkg.hasExposedPad === true,
    pinCount,
    fidelity: 'exact',
  };
}

/** Static pad/ball positions for a thumbnail; one mark per declared pad. */
export function thumbnailPadMarks(geometry: ThumbnailGeometry): ThumbnailMark[] {
  const marks: ThumbnailMark[] = [];
  if (geometry.kind === 'grid') {
    const rows = finiteCount(geometry.rows);
    const cols = finiteCount(geometry.cols);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        marks.push({
          x: 26 + (48 * col) / Math.max(1, cols - 1),
          y: 26 + (48 * row) / Math.max(1, rows - 1),
          kind: 'ball',
        });
      }
    }
    return marks;
  }
  const bounds = [22, 78] as const;
  const edges: Array<{ count: number; position: (t: number) => [number, number] }> = [
    { count: geometry.sides[0], position: (t) => [18, bounds[0] + (56 * t) / Math.max(1, geometry.sides[0] - 1)] },
    { count: geometry.sides[1], position: (t) => [bounds[0] + (56 * t) / Math.max(1, geometry.sides[1] - 1), 82] },
    { count: geometry.sides[2], position: (t) => [82, bounds[0] + (56 * t) / Math.max(1, geometry.sides[2] - 1)] },
    { count: geometry.sides[3], position: (t) => [bounds[0] + (56 * t) / Math.max(1, geometry.sides[3] - 1), 18] },
  ];
  for (const edge of edges) {
    for (let index = 0; index < edge.count; index++) {
      const [x, y] = edge.position(edge.count === 1 ? 0.5 : index);
      marks.push({ x, y, kind: 'pad' });
    }
  }
  return marks;
}
