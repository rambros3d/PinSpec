/**
 * Pure placement-ring geometry derived from measured pin bounds. The canvas
 * measures pad/ball rectangles in the DOM and passes plain numbers to these
 * helpers, so radius ratios and the enable-time zoom fit stay deterministically
 * testable without Svelte or a browser.
 */

import type { PlacementRing } from './types';

/** Ring radii in stage-local CSS pixels, keyed by the shared ring identifiers. */
export type PlacementRingRadii = Record<PlacementRing, number>;

/** An axis-aligned rectangle measured in stage-local CSS pixels. */
export interface PinBoundsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Fixed multiples of the measured pin reference radius. The high ring leaves
 * forty percent clearance around the outermost pad/ball extent, and the order
 * high < medium < low holds for every finite measurement. No stage or
 * furniture value participates in geometry.
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
 * Farthest distance from a centre to any corner of the measured pin bounds.
 * Each rectangle contributes its farthest corner, not its centre, so visible
 * pads and balls stay inside the high ring. Non-finite input and degenerate
 * rectangles are ignored; zero means no usable bounds were measured and the
 * caller falls back to the body half-diagonal.
 */
export function farthestPinCornerDistance(
  centerX: number,
  centerY: number,
  rects: readonly PinBoundsRect[],
): number {
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return 0;
  let farthest = 0;
  for (const rect of rects) {
    const { left, top, right, bottom } = rect;
    if (
      !Number.isFinite(left) ||
      !Number.isFinite(top) ||
      !Number.isFinite(right) ||
      !Number.isFinite(bottom)
    ) {
      continue;
    }
    const minX = Math.min(left, right);
    const maxX = Math.max(left, right);
    const minY = Math.min(top, bottom);
    const maxY = Math.max(top, bottom);
    const dx = Math.max(Math.abs(centerX - minX), Math.abs(centerX - maxX));
    const dy = Math.max(Math.abs(centerY - minY), Math.abs(centerY - maxY));
    const distance = Math.hypot(dx, dy);
    if (Number.isFinite(distance) && distance > farthest) farthest = distance;
  }
  return farthest;
}

/**
 * Radii for the three placement rings, scaled from the measured pin reference
 * radius. Rings may extend past the stage; the viewport clips them. A missing
 * or degenerate measurement yields zero radii rather than a stage-derived
 * clamp. The caller supplies the body half-diagonal when no pin bounds exist.
 */
export function placementRingRadii(pinRadius: number): PlacementRingRadii {
  const radius = Number.isFinite(pinRadius) && pinRadius >= 0 ? pinRadius : 0;
  return {
    high: radius * RING_RADIUS_FACTORS.high,
    medium: radius * RING_RADIUS_FACTORS.medium,
    low: radius * RING_RADIUS_FACTORS.low,
  };
}

/**
 * Largest canvas zoom for which the low ring still fits the stage half-extent.
 * The pin reference radius is taken at zoom 1 so the measured radius at any
 * zoom can be compared directly; it is used once when the overlay is enabled.
 * A missing or degenerate measurement leaves zoom unconstrained. Extreme
 * limits are clamped to the canvas zoom range.
 */
export function placementZoomLimit(
  pinRadiusAtZoom1: number,
  stageHalfExtent: number,
): number {
  const radius = Number.isFinite(pinRadiusAtZoom1) && pinRadiusAtZoom1 > 0
    ? pinRadiusAtZoom1
    : 0;
  const extent = Number.isFinite(stageHalfExtent) && stageHalfExtent > 0 ? stageHalfExtent : 0;
  if (radius <= 0 || extent <= 0) return MAX_PLACEMENT_ZOOM;
  const limit = extent / (radius * RING_RADIUS_FACTORS.low);
  return Math.min(MAX_PLACEMENT_ZOOM, Math.max(MIN_PLACEMENT_ZOOM, limit));
}
