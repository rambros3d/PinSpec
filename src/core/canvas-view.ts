/**
 * Pure arithmetic for the interactive package canvas.
 *
 * These helpers contain no DOM or Svelte API. The component reads SVG and
 * stage geometry, calls the helpers, and applies the returned transform to its
 * runes. Keeping the formulas here makes clamps, rounding, and quarter-turn
 * behavior unit-testable on the host.
 */

/** View transform applied to the package content. */
export interface CanvasTransform {
  zoom: number;
  panX: number;
  panY: number;
}

/** Geometry needed to fit a declared SVG package into the visible stage. */
export interface FitViewInput {
  declaredWidth: number;
  declaredHeight: number;
  viewBox: readonly number[];
  stageWidth: number;
  stageHeight: number;
  rotation: 0 | 90 | 180 | 270;
}

const MIN_FIT_ZOOM = 0.4;
const MAX_FIT_ZOOM = 1.6;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.5;
const FIT_PADDING = 48;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Fit a package into the stage, using viewBox extents for quarter turns. */
export function fitViewTransform(input: FitViewInput): CanvasTransform {
  const quarterTurn = input.rotation === 90 || input.rotation === 270;
  const effW = quarterTurn
    ? input.viewBox[2] || input.declaredHeight
    : input.declaredWidth;
  const effH = quarterTurn
    ? input.viewBox[3] || input.declaredWidth
    : input.declaredHeight;
  const scaleX = (input.stageWidth - FIT_PADDING) / effW;
  const scaleY = (input.stageHeight - FIT_PADDING) / effH;
  const zoom = Number(clamp(Math.min(scaleX, scaleY), MIN_FIT_ZOOM, MAX_FIT_ZOOM).toFixed(3));
  return {
    zoom,
    panX: (input.stageWidth - effW * zoom) / 2,
    panY: (input.stageHeight - effH * zoom) / 2,
  };
}

/** Scale around a client-space point so that point stays under the cursor. */
export function zoomAtPoint(
  transform: CanvasTransform,
  factor: number,
  cx: number,
  cy: number,
): CanvasTransform {
  const nextZoom = clamp(transform.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = nextZoom / transform.zoom;
  return {
    zoom: Number(nextZoom.toFixed(3)),
    panX: cx - (cx - transform.panX) * ratio,
    panY: cy - (cy - transform.panY) * ratio,
  };
}

/** Wheel input: a fixed step for a mouse, a fine exponential step for pinch. */
export function wheelZoomFactor(deltaY: number, ctrlOrMeta: boolean): number {
  if (ctrlOrMeta) return Math.exp(-clamp(deltaY, -60, 60) * 0.004);
  return deltaY < 0 ? 1.12 : 1 / 1.12;
}

/** Distance and midpoint of two pointers; zero distance when fewer than two. */
export function pointerMetrics(points: readonly { x: number; y: number }[]): {
  distance: number;
  midX: number;
  midY: number;
} {
  if (points.length < 2) return { distance: 0, midX: 0, midY: 0 };
  const [a, b] = points;
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  };
}

/** Apply a pinch ratio around its midpoint; null when no baseline exists. */
export function pinchTransform(
  transform: CanvasTransform,
  distance: number,
  previousDistance: number,
  midX: number,
  midY: number,
): CanvasTransform | null {
  if (previousDistance <= 0 || distance <= 0) return null;
  return zoomAtPoint(transform, distance / previousDistance, midX, midY);
}
