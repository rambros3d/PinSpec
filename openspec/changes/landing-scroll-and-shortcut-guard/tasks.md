# Tasks

## 1. Landing shell scroller

- [ ] 1.1 Add a `.landing-shell` rule to `src/app.css` with `height: 100dvh`, `overflow-y: auto`, `overscroll-behavior: contain`, and `scroll-padding-top: 3.5rem`; verify the `html`, `body`, `#app`, and `.workspace-root` lock blocks are unchanged and contain their existing `height`, `overflow`, and `overscroll-behavior` declarations.
- [ ] 1.2 Replace `min-h-screen` with `landing-shell` on the root element of `src/pages/LandingPage.svelte`, keeping the existing flex and theme classes; verify the sticky header and `#presets`, `#export-preview`, and `#provenance` anchors remain in the markup and scroll inside the new container on a short viewport.
- [ ] 1.3 Add a landing-shell assertion to `tests/viewport-layout.test.ts` that checks the four `.landing-shell` declarations and the landing root class, while leaving the global document lock test intact; verify with `npx vitest run tests/viewport-layout.test.ts` and confirm the dialog structure tests still pass.

## 2. Native dialog shortcut guard

- [ ] 2.1 In `src/pages/WorkspacePage.svelte`, return early from `onKeyDown` when `document.querySelector('dialog[open]')` is non-null, before `preventDefault()` and before the Ctrl+F, Ctrl+K, Ctrl+Z, and Ctrl+Y branches; verify the existing handler source-contract test still passes and that no Escape branch was added to this handler.
- [ ] 2.2 In `src/components/workspace/PackageCanvas.svelte`, apply the same open-dialog guard at the start of `onKey` before the remap-cancel and `0` fit-view branches; verify with a source check that the guard precedes both branches and that the shortcut works with no dialog open.
- [ ] 2.3 Add source-contract assertions in `tests/viewport-layout.test.ts` for guard placement in both handlers; verify with `npx vitest run tests/viewport-layout.test.ts tests/compatible-mcu-finder.test.ts` that the dialog structure and finder wiring tests remain green.

## 3. Full verification

- [ ] 3.1 Run `npm test` and verify all unit tests pass with no failures, including the viewport layout, dialog structure, and compatible MCU finder suites.
- [ ] 3.2 Run `npm run check` and verify strict TypeScript checking reports no errors.
- [ ] 3.3 Run `BASE_PATH="/pincraft/" npm run build` and verify the production subpath build succeeds with no warnings and no root-absolute asset paths introduced.

## Workflow follow-up

- Archive the change after verification with `openspec archive landing-scroll-and-shortcut-guard -y`.
- Confirm the delta spec synced into `openspec/specs/viewport-locked-workspace/` and include the archived files in the implementation commit.
