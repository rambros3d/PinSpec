# Proposal

## Why

Users migrating pinouts from STM32CubeMX or STM32CubeIDE have `.ioc` project files that describe their part, package, and pin assignments; PinCraft currently has no way to bring that configuration into a workspace. Official ST board configurations let a user start from a known-good hardware setup instead of assigning dozens of pins by hand.

## What Changes

- Add a pure `src/core/importers/ioc.ts` parser for the flat `key=value` `.ioc` format used by the 281 official ST board files already present in `.cache/STM32_open_pin_data/boards/` (Nucleo, Discovery, Eval). Read `Mcu.Name`, `Mcu.Package`, `Mcu.PinsNb`, `Mcu.IPn`, `<pin>.Signal`, `<pin>.Mode`, `<pin>.GPIO_Label`, `<pin>.Locked`, `SH.GPXTI<line>.0`, and `board`.
- Add an ST signal-vocabulary mapper that converts ST names (`GPIO_EXTI13`, `SYS_JTMS-SWDIO`, `GPIO_Output`) to the normalized peripheral/signal pairs used by the core schema.
- Handle `.ioc` format quirks: escaped spaces in pin names (`PH0\ -\ OSC_IN`), suffixed pin names (`PC14-OSC32_IN`), wildcard part IDs (`STM32F411R(C-E)Tx`) expanded and canonicalized to a concrete MCU ID, virtual pins (`VP_SYS_VS_Systick`) ignored, and signal-to-physical-position joins performed by pin name because `.ioc` files carry no package coordinates.
- Add a small static board preset catalog keyed by MCU ID, seeded from the official ST board files. Presets are checked-in hand-curated data, not generated shards.
- Emit a version-2 `WorkspaceState` from both the file importer and the board presets so no changes to the URL/JSON codec are required.
- Wire drag-and-drop `.ioc` import into `src/pages/WorkspacePage.svelte` through the existing `src/state/workspace.svelte.ts` handoff path (`setPendingHandoff` / `openMcu`), and add a board selector modal plus a manual MCU confirmation step when the part ID is ambiguous.
- Add unit tests using synthetic `.ioc` fixtures. No new npm dependency.
- Explicitly out of scope: RP board presets (RP board headers are GPIO-indexed and not cached) and CH32 board presets (no pin-level board maps available).

## Capabilities

### New Capabilities
- `ioc-project-import`: Import of STM32CubeIDE `.ioc` project files and application of official ST board presets to seed a version-2 workspace, including ST signal-name mapping and part-ID resolution.

### Modified Capabilities
(None. All capabilities in this proposal are new; no existing spec requirements change.)

## Impact

- Pure core (TypeScript, no DOM/Svelte imports): new `src/core/importers/ioc.ts` parser and signal mapper, plus a checked-in static board preset data module.
- State: `src/state/workspace.svelte.ts` exposes an import handoff path and MCU confirmation for ambiguous parts.
- UI: `src/pages/WorkspacePage.svelte` gains a drop zone; a new board selector modal component is added.
- Data: static board preset file checked in; generated shards, `public/data/`, and `.cache/` are untouched.
- Tests: new importer test file with synthetic `.ioc` fixtures covering escaped spaces, suffixes, wildcards, virtual pins, and signal mapping.
- Licensing: ST board `.ioc` files are BSD-3-Clause and already credited through the existing STM32 open pin data source; no new upstream source is introduced.
- Verification: `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` must pass with no STM32 regressions.
