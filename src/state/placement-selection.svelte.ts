/**
 * Transient selection of the placement bubble whose pins are highlighted.
 * This is presentation state only: it is neither persisted nor serialized into
 * share URLs or project files. Both the canvas overlay and the sidebar Place
 * section read the same instance so selection stays in sync across layouts.
 */
export class PlacementSelectionStore {
  selected = $state<string | null>(null);

  select(name: string | null): void {
    this.selected = name;
  }
}

/** Single shared instance used by the canvas overlay and the sidebar Place section. */
export const placementSelection = new PlacementSelectionStore();
