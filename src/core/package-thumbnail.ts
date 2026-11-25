/**
 * Pure package-outline geometry for catalog and session thumbnails.
 *
 * Catalog rows use the exact geometry generated into each index entry. Session
 * cards have only a saved package name and pin count, so they use a small
 * deterministic fallback. No chip shard is fetched and no hardware fact is
 * invented. No Svelte or DOM API is used here.
 */

import type { CatalogIndexEntry } from './types';

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
}

export interface ThumbnailMark {
  x: number;
  y: number;
  kind: 'pad' | 'ball';
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

/**
 * Exact thumbnail geometry from one generated index entry. Absent or malformed
 * fields degrade to a plain outline; no package string is parsed here.
 */
export function thumbnailGeometryFromIndex(entry: CatalogIndexEntry): ThumbnailGeometry {
  const geometry = entry.geometry;
  const pinCount = finiteCount(entry.pinCount);
  if (!geometry || (geometry.kind !== 'perimeter' && geometry.kind !== 'grid')) {
    return {
      kind: 'perimeter',
      sides: [0, 0, 0, 0],
      rows: 0,
      cols: 0,
      hasExposedPad: false,
      pinCount,
    };
  }
  if (geometry.kind === 'grid') {
    return {
      kind: 'grid',
      sides: [0, 0, 0, 0],
      rows: Array.isArray(geometry.rows) ? geometry.rows.length : 0,
      cols: Array.isArray(geometry.cols) ? geometry.cols.length : 0,
      hasExposedPad: geometry.hasExposedPad === true,
      pinCount,
    };
  }
  const sides = geometry.sides;
  return {
    kind: 'perimeter',
    sides:
      Array.isArray(sides) && sides.length === 4
        ? [
            finiteCount(sides[0]),
            finiteCount(sides[1]),
            finiteCount(sides[2]),
            finiteCount(sides[3]),
          ]
        : [0, 0, 0, 0],
    rows: 0,
    cols: 0,
    hasExposedPad: geometry.hasExposedPad === true,
    pinCount,
  };
}

/**
 * Fallback geometry for recent-session cards, which store only the package
 * name and pin count. No generated shard is fetched for these thumbnails.
 */
export function thumbnailGeometryFromSaved(packageName: string, pinCount: number): ThumbnailGeometry {
  const name = (packageName ?? '').toUpperCase();
  const count = finiteCount(pinCount);
  if (/BGA|WLCSP|CSP/.test(name)) {
    const cols = Math.ceil(Math.sqrt(Math.max(1, count)));
    return {
      kind: 'grid',
      sides: [0, 0, 0, 0],
      rows: Math.ceil(count / cols),
      cols,
      hasExposedPad: false,
      pinCount: count,
    };
  }
  if (/SOP|SOIC|SSOP|TSSOP|DIP|\bSO\d/.test(name)) {
    const half = Math.ceil(count / 2);
    return {
      kind: 'perimeter',
      sides: [half, 0, half, 0],
      rows: 0,
      cols: 0,
      hasExposedPad: false,
      pinCount: count,
    };
  }
  return {
    kind: 'perimeter',
    sides: distributeSides(count),
    rows: 0,
    cols: 0,
    hasExposedPad: false,
    pinCount: count,
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
