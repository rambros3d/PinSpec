# Tasks

## 1. Investigate and document the workspace control inventory

- [x] 1.1 Trace every workspace/shared control from handler to effect in `GlobalTopBar.svelte`, `GlobalSidebar.svelte`, `WorkspacePage.svelte`, `PackageCanvas.svelte`, `CombinedSidebar.svelte`, `PeripheralTree.svelte`, `PeripheralDetail.svelte`, `SummaryDrawer.svelte`, its tab bodies, all dialogs, `PinPopover.svelte`, `PinContextMenu.svelte`, and `PlacementOverlay.svelte`; record which controls work and which are inert
- [x] 1.2 Reproduce the inert controls against the built site in a headless browser and record the pointer retargeting and overlapping HUD evidence that identifies the two defects

## 2. Canvas pointer capture and drawer toggle

- [x] 2.1 Narrow `handlePointerDown()` in `src/components/workspace/PackageCanvas.svelte` so pan capture starts only on the stage background or the transformed SVG package surface and never on a pin or DOM overlay; verify a static regression check records the target scope and that existing pointer and placement test tokens stay green
- [x] 2.2 Verify with the built site that Zoom In/Out, Fit, Rotate, the placement toggle, the ring rotation control, the find clear control, the remap banner cancel, and the pin popover assignment button reach their effects, while background drag still pans
- [x] 2.3 Move the landscape summary drawer collapse control in `src/pages/WorkspacePage.svelte` away from the find HUD position and verify it is clickable with the HUD visible in a landscape viewport
- [x] 2.4 Move the remap banner below both canvas HUD rows and verify its Cancel control is clickable while zoom and find controls remain visible

## 3. Two-word generated project names

- [x] 3.1 Change `generateProjectName()` in `src/core/project-name.ts` to return two curated words only and stop reading chip facts; keep the injected RNG, normalization, and length bounds
- [x] 3.2 Update `tests/project-naming.test.ts` generation assertions and `README.md` so generated names are two words while saved three-part names in reuse and round-trip fixtures remain unchanged; verify the whole naming suite passes

## 4. Workspace title icon and sidebar header removal

- [x] 4.1 Render `radiokit-logo.svg` through `import.meta.env.BASE_URL` before the editable project-name control in `src/components/shell/GlobalTopBar.svelte`, leaving non-workspace routes unchanged, and add a static regression assertion
- [x] 4.2 Delete the sidebar logo and PinCraft header block from `src/components/shell/GlobalSidebar.svelte`, add a static regression assertion for its absence, and confirm navigation, recents, Hotkeys, and collapse controls remain wired

## 5. Verification and closeout

- [x] 5.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` with zero warnings and confirm no STM32, export, theme-token, or persistence regression
- [x] 5.2 Run `openspec validate workspace-button-fixes --strict`, mark every completed task above only after its verification passes, and run `openspec validate --all --strict` after archiving with no active changes remaining
