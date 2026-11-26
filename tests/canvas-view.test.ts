import { describe, expect, it } from 'vitest';
import {
  fitViewTransform,
  pinchTransform,
  pointerMetrics,
  wheelZoomFactor,
  zoomAtPoint,
} from '../src/core/canvas-view';

describe('pure canvas view math', () => {
  it('fits a package and centers it in the stage', () => {
    const result = fitViewTransform({
      declaredWidth: 700,
      declaredHeight: 500,
      viewBox: [0, 0, 700, 500],
      stageWidth: 900,
      stageHeight: 700,
      rotation: 0,
    });
    expect(result.zoom).toBeCloseTo(1.217, 3);
    expect(result.panX).toBeCloseTo((900 - 700 * result.zoom) / 2, 6);
    expect(result.panY).toBeCloseTo((700 - 500 * result.zoom) / 2, 6);
  });

  it('uses viewBox extents for quarter turns and clamps very small stages', () => {
    const quarter = fitViewTransform({
      declaredWidth: 500,
      declaredHeight: 700,
      viewBox: [0, 0, 700, 500],
      stageWidth: 900,
      stageHeight: 700,
      rotation: 90,
    });
    expect(quarter.zoom).toBeCloseTo(1.217, 3);
    const clamped = fitViewTransform({
      declaredWidth: 700,
      declaredHeight: 500,
      viewBox: [0, 0, 700, 500],
      stageWidth: 100,
      stageHeight: 100,
      rotation: 0,
    });
    expect(clamped.zoom).toBe(0.4);
  });

  it('keeps the zoom anchor fixed and clamps the zoom range', () => {
    const at = zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 2, 100, 80);
    expect(at.zoom).toBe(2);
    expect(at.panX).toBe(-100);
    expect(at.panY).toBe(-80);

    const upper = zoomAtPoint({ zoom: 4, panX: 10, panY: 20 }, 4, 100, 100);
    expect(upper.zoom).toBe(4.5);
    const lower = zoomAtPoint({ zoom: 0.5, panX: 10, panY: 20 }, 0.01, 100, 100);
    expect(lower.zoom).toBe(0.4);
  });

  it('maps wheel and trackpad input to the expected factors', () => {
    expect(wheelZoomFactor(-120, false)).toBe(1.12);
    expect(wheelZoomFactor(120, false)).toBeCloseTo(1 / 1.12, 12);
    expect(wheelZoomFactor(-120, true)).toBeCloseTo(Math.exp(60 * 0.004), 12);
    expect(wheelZoomFactor(-1000, true)).toBeCloseTo(Math.exp(60 * 0.004), 12);
  });

  it('derives pinch metrics and applies a ratio around the midpoint', () => {
    expect(pointerMetrics([{ x: 0, y: 0 }])).toEqual({ distance: 0, midX: 0, midY: 0 });
    expect(pointerMetrics([{ x: 0, y: 0 }, { x: 100, y: 100 }])).toEqual({
      distance: Math.hypot(100, 100),
      midX: 50,
      midY: 50,
    });
    const transform = { zoom: 1, panX: 0, panY: 0 };
    expect(pinchTransform(transform, 200, 100, 50, 50)?.zoom).toBe(2);
    expect(pinchTransform(transform, 200, 0, 50, 50)).toBeNull();
  });
});
