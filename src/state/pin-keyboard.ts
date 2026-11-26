/**
 * DOM-only helper shared by the SVG package renderers. Keyboard activation of
 * a pin is translated into the MouseEvent the pointer click path already
 * expects, anchored at the focused pin so the popover or remap result applies
 * to that pin.
 */
export function pinKeyboardClick(element: Element | null): MouseEvent {
  const rect = element?.getBoundingClientRect();
  const hasRect = Boolean(rect && rect.width > 0 && rect.height > 0);
  return new MouseEvent('click', {
    bubbles: true,
    clientX: hasRect ? rect!.left + rect!.width / 2 : window.innerWidth / 2,
    clientY: hasRect ? rect!.top + rect!.height / 2 : window.innerHeight / 2,
  });
}
