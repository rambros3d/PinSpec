# Tasks

## 1. Pure parser and signal mapping

- [x] 1.1 Create a pure `.ioc` key-value parser module under `src/core/importers/` that reads `Mcu.Name`, `Mcu.Package`, `Mcu.PinsNb`, `Mcu.IPn`, `board`, `<pin>.Signal`, `<pin>.Mode`, `<pin>.GPIO_Label`, `<pin>.Locked`, and `SH.GPXTI` entries; verify a unit test parses a synthetic fixture into the expected raw record and ignores blank lines and comments.
- [x] 1.2 Implement an ST signal and mode mapping table to normalized peripheral/signal pairs, including `GPIO_EXTI<n>`, `SYS_JTMS-SWDIO`, and `GPIO_Output`; verify unit tests assert each mapping and that unmapped entries are reported as warnings rather than dropped.

## 2. Part resolution and pin-name join

- [x] 2.1 Implement part-ID variant expansion and temperature-wildcard canonicalization against the catalog index; verify tests assert `STM32F411R(C-E)Tx` resolves to a concrete catalog MCU ID and that an ambiguous ID yields multiple candidates.
- [x] 2.2 Implement pin-name normalization for escaped spaces and suffixes and join signals to physical positions by pin name; verify tests cover `PH0\ -\ OSC_IN`, `PC14-OSC32_IN`, and the ignoring of `VP_SYS_VS_Systick`.
- [x] 2.3 Assemble a version-2 `WorkspaceState` from the parsed record; verify a test shows the state round-trips through `src/core/url-state.ts` and the JSON exporter, and that a malformed file reports an error without changing the current workspace.

## 3. Board presets

- [x] 3.1 Add a checked-in static board preset catalog keyed by MCU ID, seeded from official ST board `.ioc` files with source attribution in a comment; verify a test loads every preset, resolves its MCU against the index, and produces a valid version-2 state.
- [x] 3.2 Add preset selection that opens a workspace with the chosen MCU and assignments; verify a test asserts assignments are applied and that a preset whose MCU is unavailable shows a clear message without creating a broken workspace.

## 4. Workspace UI handoff

- [x] 4.1 Wire drag-and-drop `.ioc` import through `setPendingHandoff` / `openMcu` in `src/state/workspace.svelte.ts` and add a board selector modal plus an ambiguous-part confirmation step in `src/pages/WorkspacePage.svelte`; verify the import, preset selection, and confirmation flows open a workspace with the expected assignments.
- [x] 4.2 Add UI copy and tooltips for the new controls using professional wording and no emojis; verify a repository grep finds no emoji characters and no root-absolute data or asset paths.

## 5. Integration verification

- [x] 5.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify zero warnings, no Svelte or DOM imports under `src/core/`, and no STM32 regressions.
