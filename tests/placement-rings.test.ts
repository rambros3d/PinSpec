import { describe, expect, it } from 'vitest';
import { zoomAtPoint } from '../src/core/canvas-view';
import {
  MAX_PLACEMENT_ZOOM,
  MIN_PLACEMENT_ZOOM,
  PLACEMENT_ZOOM_EPSILON,
  RING_RADIUS_FACTORS,
  farthestPinCornerDistance,
  placementRingRadii,
  placementZoomLimit,
  type PinBoundsRect,
} from '../src/core/placement-rings';

function rect(left: number, top: number, right: number, bottom: number): PinBoundsRect {
  return { left, top, right, bottom };
}

describe('farthest pin corner helper', () => {
  it('uses the farthest corner, not the rectangle centre', () => {
    // Body centre at the origin; the pad sits to the right and above it.
    expect(farthestPinCornerDistance(0, 0, [rect(30, -20, 50, -10)])).toBeCloseTo(
      Math.hypot(50, 20),
      9,
    );
    expect(farthestPinCornerDistance(0, 0, [rect(-50, 10, -30, 20)])).toBeCloseTo(
      Math.hypot(50, 20),
      9,
    );
  });

  it('takes the maximum corner distance over every measured pin', () => {
    const bounds = [rect(20, -5, 24, 5), rect(-80, -60, -70, -50), rect(-10, 40, 10, 44)];
    expect(farthestPinCornerDistance(0, 0, bounds)).toBeCloseTo(Math.hypot(80, 60), 9);
    expect(farthestPinCornerDistance(0, 0, [rect(5, -2, 9, 2)])).toBeCloseTo(
      Math.hypot(9, 2),
      9,
    );
  });

  it('works from an arbitrary centre and tolerates reversed coordinates', () => {
    expect(farthestPinCornerDistance(400, 300, [rect(420, 280, 440, 320)])).toBeCloseTo(
      Math.hypot(40, 20),
      9,
    );
    expect(farthestPinCornerDistance(400, 300, [rect(440, 320, 420, 280)])).toBeCloseTo(
      Math.hypot(40, 20),
      9,
    );
  });

  it('yields zero when no bounds are measurable so the caller falls back', () => {
    expect(farthestPinCornerDistance(0, 0, [])).toBe(0);
    expect(
      farthestPinCornerDistance(0, 0, [rect(Number.NaN, 0, 10, 10), rect(0, 0, 0, 0)]),
    ).toBe(0);
    expect(farthestPinCornerDistance(Number.NaN, 0, [rect(0, 0, 10, 10)])).toBe(0);
    expect(placementRingRadii(0)).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

describe('pure placement ring geometry', () => {
  it('uses fixed pin-relative factors with forty percent clearance', () => {
    expect(RING_RADIUS_FACTORS).toEqual({ high: 1.4, medium: 1.55, low: 1.7 });
    const radii = placementRingRadii(100);
    expect(radii.high).toBeCloseTo(140, 9);
    expect(radii.medium).toBeCloseTo(155, 9);
    expect(radii.low).toBeCloseTo(170, 9);
    expect(radii.high / 100 - 1).toBeCloseTo(0.4, 9);
    expect(radii.high).toBeGreaterThan(100);
  });

  it('keeps the ring order stable at every pin radius without a furniture argument', () => {
    expect(placementRingRadii.length).toBe(1);
    for (const radius of [0.5, 1, 100, 200, 1000]) {
      const radii = placementRingRadii(radius);
      expect(radii.high).toBeLessThan(radii.medium);
      expect(radii.medium).toBeLessThan(radii.low);
      expect(radii.high / radius).toBeCloseTo(RING_RADIUS_FACTORS.high, 9);
      expect(radii.medium / radius).toBeCloseTo(RING_RADIUS_FACTORS.medium, 9);
      expect(radii.low / radius).toBeCloseTo(RING_RADIUS_FACTORS.low, 9);
    }
  });

  it('uses finite fallbacks for degenerate measurements', () => {
    expect(placementRingRadii(Number.NaN)).toEqual({ high: 0, medium: 0, low: 0 });
    expect(placementRingRadii(Number.POSITIVE_INFINITY)).toEqual({ high: 0, medium: 0, low: 0 });
    expect(placementRingRadii(-5)).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it('derives the enable fit from the stage half-extent and the low factor', () => {
    expect(placementZoomLimit(100, 238)).toBeCloseTo(1.4, 12);
    expect(placementZoomLimit(50, 340)).toBeCloseTo(4, 12);
    expect(placementZoomLimit(100, 170)).toBeCloseTo(1, 12);
    expect(placementZoomLimit(100, 140)).toBeCloseTo(1.4 / 1.7, 12);
  });

  it('clamps extreme zoom limits to the canvas zoom range', () => {
    expect(placementZoomLimit(0, 300)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(Number.NaN, 300)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(100, 0)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(100, Number.NaN)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(1000, 170)).toBe(MIN_PLACEMENT_ZOOM);
    expect(placementZoomLimit(1, 100)).toBe(MAX_PLACEMENT_ZOOM);
  });

  it('zooms out around the body centre using the shared canvas helper', () => {
    const centreX = 400;
    const centreY = 300;
    const view = { zoom: 3, panX: 100, panY: 50 };
    const limit = placementZoomLimit(100, 340);
    const next = zoomAtPoint(view, limit / view.zoom, centreX, centreY);
    expect(limit).toBeCloseTo(2, 12);
    expect(next.zoom).toBe(2);
    expect((centreX - view.panX) / view.zoom).toBeCloseTo((centreX - next.panX) / next.zoom, 9);
    expect((centreY - view.panY) / view.zoom).toBeCloseTo((centreY - next.panY) / next.zoom, 9);
  });

  it('uses an epsilon guard so a fitted view does not zoom again', () => {
    const limit = placementZoomLimit(100, 340);
    expect(limit + PLACEMENT_ZOOM_EPSILON).toBeGreaterThan(limit);
    expect(limit).not.toBeGreaterThan(limit + PLACEMENT_ZOOM_EPSILON);
  });
});
