# Design

## Context

See `proposal.md` for motivation. The UI is custom Svelte 5 runes components with no UI-primitive dependency. `PerimeterPackage.svelte` already supports `[left, bottom, right, top]` side counts but omits `SOP` from two-sided detection and ignores `hasExposedPad`/`bondedNames`; `PeripheralTree.svelte` has no `pwm`/`pio` categories; `SummaryDrawer.svelte` has fixed Pins/Diagnostics/DMA tabs; `ExportModal.svelte` has fixed export tabs; quick search and the MCU switcher hardcode STM32 family lists; presets and the hero are STM32-only.

## Goals / Non-Goals

**Goals:**
- One mux-label presentation rule across canvas, popover, context menu, table, and tooltips.
- Render CH32 bonded/remap and RP FUNCSEL/PIO packages without changing STM32 layouts.
- Make discovery, presets, hero, exports, and provenance vendor-neutral.

**Non-Goals:**
- No new solver rules, exporters, or state serialization (owned by earlier changes).
- No new third-party UI library; no backend or runtime data fetch outside generated JSON.
- No committed generated data; hero chips are fetched from `data/chips/`.

## Decisions

- **Shared label helper**: pass `getChipMuxModel(chip)` into `formatMuxLabel()` at each render site and delete the nine hardcoded `AF<n>`/`AFIO` expressions. Alternative: store a preformatted string on each pin; rejected because it duplicates derived state.
- **Extend existing SVG components**: add `SOP` to the two-sided package recognition, an exposed-pad body element gated on `package.hasExposedPad`, and a bonded-name annotation from `pin.bondedNames`. Keep four-sided/grid paths untouched to protect STM32 diagrams.
- **Peripheral tree**: include `pwm` and `pio` in its category kinds; render a remap `<select>` per peripheral when `PeripheralInfo.remaps` exists, showing option names and `registerNote`, committing through the workspace store so undo works.
- **PIO panel**: a small dedicated panel component shown for RP chips, sourced from `ChipData.pio.instances`, `stateMachinesPerInstance`, and `state.pioAssignments`; display `gpioBaseOptions` as explicit windows and reuse solver diagnostics for out-of-window flags rather than duplicating validation.
- **Discovery**: add vendor tabs as local state in search and MCU switcher, pass an optional vendor/family/package filter to the existing catalog query, and read filter values from the generated index instead of hardcoded arrays.
- **Presets and hero**: define presets across all three vendors; the hero switches vendors by loading a generated chip via the catalog store and derives demo assignments from peripherals actually present on that chip (e.g. SWD/SPI/UART/PWM where available) rather than fixed STM32 names.
- **Exports and provenance**: keep the five export tabs but label them vendor-neutrally; render `meta.json.sources` for per-vendor counts, revisions, and license credits.
- **Theme safety**: use existing CSS theme variables and monochrome icons only; verify both themes at zoom bounds 0.4x-4.5x.

## Risks / Trade-offs

- [Dense pin labels overlap on QFN-56/80] -> Zoom-adaptive label suppression and tooltips; visual check at both zoom extremes.
- [Optional chip fields absent on generated parts] -> Default to STM32-style rendering and hide vendor-specific panels rather than failing to render.
- [Catalog filtering cost grows with three vendors] -> Filtering stays over the already-loaded compact index, not per-chip JSON.
- [STM32 visual regressions] -> Leave four-sided/grid render paths unchanged and include STM32 packages in the visual checklist.

## Migration Plan

No state or data migration; all chip data is generated in CI. Verify with `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`, and a manual render checklist for SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 at both zoom bounds in light and dark themes.
