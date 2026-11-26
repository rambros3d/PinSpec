/**
 * Pure placement-ring geometry derived from the measured IC body. The canvas
 * measures the body rectangle in the DOM and passes plain numbers to these
 * helpers, so radius ratios and the enable-time zoom fit stay deterministically
 * testable without Svelte or a browser.
 */

import type { PlacementRing } from './types';

/** Ring radii in stage-local CSS pixels, keyed by the shared ring identifiers. */
export type PlacementRingRadii = Record<PlacementRing, number>;

/**
 * Fixed multiples of the body half-diagonal. The high ring leaves forty percent
 * clearance around the body, and the order high < medium < low holds for every
 * finite measurement. No stage or furniture value participates in geometry.
 */
export const RING_RADIUS_FACTORS: PlacementRingRadii = {
  high: 1.4,
  medium: 1.55,
  low: 1.7,
};

/** Zoom bounds shared with the canvas transform helpers. */
export const MIN_PLACEMENT_ZOOM = 0.4;
export const MAX_PLACEMENT_ZOOM = 4.5;

/** Slack that prevents a fitted view from fitting again on the same measurement. */
export const PLACEMENT_ZOOM_EPSILON = 0.01;

/**
 * Radii for the three placement rings, scaled only from the body half-diagonal.
 * Rings may extend past the stage; the viewport clips them. A missing or
 * degenerate measurement yields zero radii rather than a stage-derived clamp.
 */
export function placementRingRadii(bodyHalfDiagonal: number): PlacementRingRadii {
  const diagonal =
    Number.isFinite(bodyHalfDiagonal) && bodyHalfDiagonal >= 0 ? bodyHalfDiagonal : 0;
  return {
    high: diagonal * RING_RADIUS_FACTORS.high,
    medium: diagonal * RING_RADIUS_FACTORS.medium,
    low: diagonal * RING_RADIUS_FACTORS.low,
  };
}

/**
 * Largest canvas zoom for which the low ring still fits the stage half-extent.
 * The body half-diagonal is taken at zoom 1 so the measured diagonal at any
 * zoom can be compared directly; it is used once when the overlay is enabled.
 * A missing or degenerate body or stage leaves zoom unconstrained. Extreme
 * limits are clamped to the canvas zoom range.
 */
export function placementZoomLimit(
  bodyHalfDiagonalAtZoom1: number,
  stageHalfExtent: number,
): number {
  const diagonal = Number.isFinite(bodyHalfDiagonalAtZoom1) && bodyHalfDiagonalAtZoom1 > 0
    ? bodyHalfDiagonalAtZoom1
    : 0;
  const extent = Number.isFinite(stageHalfExtent) && stageHalfExtent > 0 ? stageHalfExtent : 0;
  if (diagonal <= 0 || extent <= 0) return MAX_PLACEMENT_ZOOM;
  const limit = extent / (diagonal * RING_RADIUS_FACTORS.low);
  return Math.min(MAX_PLACEMENT_ZOOM, Math.max(MIN_PLACEMENT_ZOOM, limit));
}
