# Tasks

## 1. Vendor-correct mux labels in pin views

- [ ] 1.1 Replace hardcoded `AF<n>`/`AFIO` text in `PackageCanvas.svelte`, `PinPopover.svelte`, `PinContextMenu.svelte`, and `SummaryDrawer.svelte` with `formatMuxLabel()` using `getChipMuxModel(chip)`; verify CH32 shows `RM1`, RP shows `F6`/`PIO`, STM32 still shows `AF7`, and `npm run check` passes.

## 2. Package rendering variants

- [ ] 2.1 Add `SOP` to two-sided package detection, draw the exposed pad from `package.hasExposedPad`, and render `pin.bondedNames` with bonded treatment; verify SOP8, TSSOP20, and a bonded CH32 part render cleanly at both zoom bounds in both themes.

## 3. Peripheral tree and RP PIO panel

- [ ] 3.1 Add `pwm`/`pio` categories and a remap dropdown using `PeripheralInfo.remaps` with option names and `registerNote`, committing through workspace history; verify selecting a remap changes labels and undo restores it.
- [ ] 3.2 Add an RP PIO allocation panel showing instance/state-machine/role bindings and `gpioBaseOptions` windows; verify RP2350B shows both GPIO0-31 and GPIO16-47 windows and an out-of-window binding is flagged.

## 4. Catalog discovery, presets, and hero

- [ ] 4.1 Add vendor tabs and vendor-aware family/package filters to `QuickSearchBar.svelte` and `McuSwitcherModal.svelte`; verify selecting RP lists only matching RP chips and clearing the tab lists all vendors.
- [ ] 4.2 Replace STM32-only presets with cross-vendor presets; verify selecting an RP or CH32 preset loads its generated chip JSON.
- [ ] 4.3 Add a hero vendor switcher that lazy-fetches a generated chip per vendor and builds demo assignments from the chip's available peripherals; verify switching vendors updates the preview without importing a committed chip snapshot.

## 5. Export previews and provenance copy

- [ ] 5.1 Update `ExportModal.svelte` tabs/labels to invoke vendor-aware exporters with copy/download for each format; verify a CH32 preview shows `ch32_hal` and copies that content.
- [ ] 5.2 Remove STM32-only wording from `LandingPage.svelte`, `WorkspacePage.svelte`, `TopToolbar.svelte`, and the footer, and render per-vendor sources/licenses from `meta.json`; verify no STM32-only claim remains and all three upstream sources are credited.

## 6. Integration and visual verification

- [ ] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` with zero warnings, and visually verify SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 at minimum and maximum zoom in light and dark themes with no overlapping labels or console errors.
