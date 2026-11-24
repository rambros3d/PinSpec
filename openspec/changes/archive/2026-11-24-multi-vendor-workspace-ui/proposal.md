# Proposal

## Why

The workspace and landing UI render, filter, and describe pins as if every part were an STM32 with independent AF numbers. CH32 bonded/remap packages and RP PIO/FUNCSEL packages therefore display incorrect mux labels, cannot expose their remap choices or PIO allocations, and the search, presets, hero, and documentation copy still claim STM32-only coverage. The UI needs to reflect the multi-vendor data and state that earlier phases now produce.

## What Changes

- Thread the shared mux-label helper through every pin view (package canvas, popover, context menu, pin table, hover tooltips), replacing hardcoded `AF<n>`/`AFIO` text with vendor-correct labels (`AF7`, `F6`, `RM1`, `PIO`, GPIO mode).
- Render two-sided packages including SOP8, draw exposed thermal pads when the package declares them, and show bonded pin names/labels on multi-pad physical pins.
- Add a remap-group dropdown to the peripheral tree for CH32 parts, surfacing each option's register note and reflecting the active selection.
- Add an RP PIO allocation panel showing instance/state-machine/role assignments and the valid GPIOBASE windows, with out-of-window pins flagged.
- Add vendor filter tabs plus vendor-aware family/package filters to quick search and the MCU switcher; replace the STM32-only preset list with cross-vendor presets.
- Add a hero vendor switcher that lazy-fetches a generated chip per vendor and builds vendor-appropriate demo assignments.
- Add export preview tabs that dispatch to the vendor-aware exporters, and update STM32-only copy in the landing page, toolbar, modal, and footer; add provenance/attribution for the CH32 and RP upstream sources. **BREAKING**: STM32-only presets and copy are replaced.

## Capabilities

### New Capabilities
- `multi-vendor-workspace`: Multi-vendor pinout rendering, mux labeling, remap and PIO interaction, catalog discovery, presets, hero preview, export previews, and provenance presentation in the workspace and landing UI.

### Modified Capabilities
None. The main spec inventory is empty; this capability is introduced here.

## Impact

- `src/components/workspace/PerimeterPackage.svelte`, `GridPackage.svelte`, `PackageCanvas.svelte`, `PinPopover.svelte`, `PinContextMenu.svelte`, `PeripheralTree.svelte`, `SummaryDrawer.svelte`, `ExportModal.svelte`, `McuSwitcherModal.svelte`, `TopToolbar.svelte`.
- `src/components/landing/HeroChipPreview.svelte`, `QuickSearchBar.svelte`, `PresetGrid.svelte`, `src/pages/LandingPage.svelte`, `src/pages/WorkspacePage.svelte`, `src/state/catalog.svelte.ts`, `src/data/hero-chip.json` usage.
- Depends on `multi-vendor-exporters-state` for vendor-aware export output and on `multi-vendor-core-solver` for diagnostics/remap/PIO state; requires visual verification of SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 at multiple zooms in both themes.
