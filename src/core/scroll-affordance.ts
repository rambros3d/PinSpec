/**
 * Pure scroll-state check for a horizontally scrollable control row. The
 * affordance is shown only while content remains to the right of the viewport.
 */
export function shouldShowScrollAffordance(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): boolean {
  if (![scrollLeft, clientWidth, scrollWidth].every(Number.isFinite)) return false;
  if (clientWidth <= 0 || scrollWidth <= clientWidth) return false;
  return scrollLeft < scrollWidth - clientWidth - 1;
}
