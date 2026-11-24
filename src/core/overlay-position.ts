/**
 * Pure coordinate clamping for floating workspace overlays.
 *
 * Callers measure the overlay and viewport in the DOM, then feed plain numbers
 * into this module. Keeping the arithmetic here makes edge behavior testable on
 * the host without importing Svelte or any browser API.
 */

export interface OverlayPosition {
  left: number;
  top: number;
}

/**
 * Clamp an overlay's top-left corner so its bounds stay inside the viewport.
 * When an overlay is larger than the available space, its top-left corner is
 * pinned to the margin; callers constrain the overlay's size in CSS.
 */
export function clampOverlayPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 12,
): OverlayPosition {
  const safeX = Number.isFinite(x) ? x : margin;
  const safeY = Number.isFinite(y) ? y : margin;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const maxLeft = Math.max(margin, viewportWidth - safeWidth - margin);
  const maxTop = Math.max(margin, viewportHeight - safeHeight - margin);
  return {
    left: Math.min(Math.max(safeX, margin), maxLeft),
    top: Math.min(Math.max(safeY, margin), maxTop),
  };
}
