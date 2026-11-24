# Proposal

## Why

The global viewport lock in `src/app.css` keeps the workspace fixed to the visible viewport, but it also prevents the landing page from scrolling, so its lower sections are unreachable on short screens. Separately, workspace keyboard shortcuts are registered on `window` without checking for an open native dialog, so Ctrl+F, Ctrl+K, Ctrl+Z/Y, and `0` act behind dialogs while the user is interacting with them.

## What Changes

- Add a landing-only scroll container that holds the landing page content while the document and the workspace remain viewport-locked.
- Keep the sticky landing header and in-page anchors usable by reserving space for the header inside the scroll container.
- Suppress global workspace shortcuts while any native dialog is open, and restore them unchanged when the dialog closes.
- Extend the existing source-contract tests for the viewport lock and dialogs to cover both behaviors without changing the global lock assertions.
- Add no dependencies, no persisted state, no new routes, and no emojis or raw colors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `viewport-locked-workspace`: the document lock requirement gains a scoped landing-page scroll container, and a new requirement covers shortcut suppression while a native dialog is open.

## Impact

- `src/app.css`: new `.landing-shell` rule; the `html`, `body`, `#app`, and `.workspace-root` lock rules stay unchanged.
- `src/pages/LandingPage.svelte`: root element uses the new scroll container class instead of `min-h-screen`.
- `src/pages/WorkspacePage.svelte`: `onKeyDown` guard for open native dialogs before any shortcut branch.
- `src/components/workspace/PackageCanvas.svelte`: matching guard for its `onKey` handler so `0` fit view and remap Escape stay dialog-aware.
- `tests/viewport-layout.test.ts` and `tests/compatible-mcu-finder.test.ts`: added source-contract assertions; existing dialog structure and finder assertions stay intact.
- No API, data format, share-link schema, project JSON schema, or generated-data changes.
