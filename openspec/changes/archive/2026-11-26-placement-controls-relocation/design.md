# Design: Placement Controls Relocation

1. **Canvas cleanup.** Delete the top-left floating card in
   `PackageCanvas.svelte` and its `Crosshair`/`Orbit` buttons, the
   `onPlacementToggle` prop if unused, and its furniture marker. Derive overlay
   visibility from `Object.values(preferences).some((p) => p?.enabled)`.

2. **Preference retire.** Remove `placementOverlayVisible` from
   `workspace-preferences.svelte.ts`, its normalizer, stored JSON shape, and
   tests. `placementOverlayRotation` stays a version-2 shareable field.

3. **Panel rotation.** Add a header row to `PlacementPanel.svelte` with a
   `Rotate placements` button calling
   `workspaceStore.setPlacementOverlayRotation(overlayRotation + 90)`. It is
   disabled when no eligible bubble is enabled. Its title and `aria-label`
   state that it moves bubbles relative to the IC, distinguishing it from the
   canvas rotate button that rotates the IC.

4. **Find bar move.** Change the find bar's canvas classes from
   `absolute top-14 right-3` to `absolute top-14 left-3`. Keep its measurement,
   `Ctrl+F` registration, clear button, and keyboard shortcut unchanged.

5. **Tests.** Static assertions for the removed card, derived visibility,
   disabled rotation control, and new find-bar position. Preserve rotation
   persistence, ring-selection, allocation, and search-focus coverage.

## Risks / Trade-offs

- With no overlay toggle, rings appear automatically when a bubble is enabled;
  that is intentional and removes a stale visibility state.
- The find bar and remap banner sit at `top-14` and `top-28` respectively, so
  they do not overlap.
