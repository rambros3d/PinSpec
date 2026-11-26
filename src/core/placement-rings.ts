/**
 * Pure placement-ring geometry derived from the rendered IC body and the
 * furniture-safe outer radius. The canvas measures the body rectangle in the
 * DOM and passes plain numbers to these helpers, so clearance, clamping, and
 * zoom limits stay deterministically testable without Svelte or a browser.
 */

import type { PlacementRing } from './types';

/** Clearance between the body half-diagonal and the high ring. */
export const RING_CLEARANCE_FACTOR = 1.1;

/** Zoom bounds shared with the canvas transform helpers. */
export const MIN_PLACEMENT_ZOOM = 0.4;
export const MAX_PLACEMENT_ZOOM = 4.5;

/** Slack that prevents repeated measure -> zoom -> measure adjustments. */
export const PLACEMENT_ZOOM_EPSILON = 0.01;

/** Ring radii in stage-local CSS pixels, keyed by the shared ring identifiers. */
export type PlacementRingRadii = Record<PlacementRing, number>;

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Radii for the three placement rings. The high ring is the body half-diagonal
 * plus ten percent clearance; the low ring never exceeds the furniture-safe
 * radius; the medium ring lies between the two. When the clearance radius does
 * not fit inside the safe radius, the canvas zooms out to restore the contract,
 * and the radii keep their relative order until that zoom takes effect.
 */
export function placementRingRadii(
  bodyHalfDiagonal: number,
  safeOuterRadius: number,
): PlacementRingRadii {
  const safe = positiveOr(safeOuterRadius, 40);
  const diagonal = Number.isFinite(bodyHalfDiagonal) && bodyHalfDiagonal >= 0 ? bodyHalfDiagonal : 0;
  const high = diagonal * RING_CLEARANCE_FACTOR;
  return { high, medium: (high + safe) / 2, low: safe };
}

/**
 * Largest canvas zoom for which the high ring still fits inside the safe
 * radius. The body half-diagonal is taken at zoom 1 so the measured diagonal at
 * any zoom can be compared directly; a missing or degenerate body leaves zoom
 * unconstrained. Extreme limits are clamped to the canvas zoom range, so a
 * body larger than the safe radius at minimum zoom cannot be fitted further.
 */
export function placementZoomLimit(
  bodyHalfDiagonalAtZoom1: number,
  safeOuterRadius: number,
): number {
  const safe = positiveOr(safeOuterRadius, 40);
  const diagonal = positiveOr(bodyHalfDiagonalAtZoom1, 0);
  if (diagonal <= 0) return MAX_PLACEMENT_ZOOM;
  const limit = safe / (diagonal * RING_CLEARANCE_FACTOR);
  return Math.min(MAX_PLACEMENT_ZOOM, Math.max(MIN_PLACEMENT_ZOOM, limit));
}
