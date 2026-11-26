import { describe, expect, it } from 'vitest';
import { zoomAtPoint } from '../src/core/canvas-view';
import {
  MAX_PLACEMENT_ZOOM,
  MIN_PLACEMENT_ZOOM,
  PLACEMENT_ZOOM_EPSILON,
  RING_CLEARANCE_FACTOR,
  placementRingRadii,
  placementZoomLimit,
} from '../src/core/placement-rings';

describe('pure placement ring geometry', () => {
  it('keeps ten percent clearance between the body and the high ring', () => {
    expect(RING_CLEARANCE_FACTOR).toBe(1.1);
    const radii = placementRingRadii(100, 300);
    expect(radii.high).toBeCloseTo(110, 9);
    expect(radii.high).toBeGreaterThan(100);
  });

  it('clamps the outer ring to the furniture-safe radius and orders the rings', () => {
    const radii = placementRingRadii(100, 300);
    expect(radii.low).toBe(300);
    expect(radii.medium).toBeGreaterThan(radii.high);
    expect(radii.medium).toBeLessThan(radii.low);

    const largeBody = placementRingRadii(200, 220);
    expect(largeBody.low).toBe(220);
    expect(largeBody.high).toBeCloseTo(220, 9);
    expect(largeBody.medium).toBe(220);
  });

  it('uses finite fallbacks for degenerate measurements', () => {
    const fallback = placementRingRadii(Number.NaN, 0);
    expect(fallback.high).toBe(0);
    expect(fallback.low).toBe(40);
    expect(fallback.medium).toBe(20);
    expect(placementRingRadii(-5, Number.NaN).high).toBe(0);
  });

  it('derives the zoom limit from the body diagonal at zoom one', () => {
    const limit = placementZoomLimit(100, 220);
    expect(limit).toBeCloseTo(2, 12);
    expect(placementZoomLimit(50, 220)).toBeCloseTo(4, 12);
    expect(placementZoomLimit(100, 110)).toBeCloseTo(1, 12);
  });

  it('clamps extreme zoom limits to the canvas zoom range', () => {
    expect(placementZoomLimit(0, 300)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(Number.NaN, 300)).toBe(MAX_PLACEMENT_ZOOM);
    expect(placementZoomLimit(1000, 110)).toBe(MIN_PLACEMENT_ZOOM);
    expect(placementZoomLimit(1, 100)).toBe(MAX_PLACEMENT_ZOOM);
  });

  it('zooms out around the body centre using the shared canvas helper', () => {
    const centreX = 400;
    const centreY = 300;
    const view = { zoom: 3, panX: 100, panY: 50 };
    const limit = placementZoomLimit(100, 220);
    const next = zoomAtPoint(view, limit / view.zoom, centreX, centreY);
    expect(next.zoom).toBe(2);
    expect((centreX - view.panX) / view.zoom).toBeCloseTo((centreX - next.panX) / next.zoom, 9);
    expect((centreY - view.panY) / view.zoom).toBeCloseTo((centreY - next.panY) / next.zoom, 9);
  });

  it('uses an epsilon guard so a fitted view does not zoom again', () => {
    const limit = placementZoomLimit(100, 220);
    expect(limit + PLACEMENT_ZOOM_EPSILON).toBeGreaterThan(limit);
    expect(limit).not.toBeGreaterThan(limit + PLACEMENT_ZOOM_EPSILON);
  });
});
