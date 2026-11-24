# Design

## Context

See proposal.md for motivation. `src/app.css` locks `html`, `body`, and `#app` with `height: 100%`, `overflow: hidden`, and `overscroll-behavior: none`. `.workspace-root` adds a `100dvh` grid for the workspace only. `LandingPage.svelte` currently uses `min-h-screen` and has no scroll container, so the global lock hides its lower sections on short viewports. `WorkspacePage.svelte` and `PackageCanvas.svelte` each register a `window` keydown handler; both act without checking whether a native dialog is open. Existing source-contract tests in `tests/viewport-layout.test.ts` assert the global lock strings, the dialog markup, and the exact shape of the shared shortcut handler, so those contracts must remain valid.

## Goals / Non-Goals

**Goals:**

- Give the landing page a bounded scroll container that absorbs vertical scrolling without changing the document lock.
- Keep the sticky landing header and in-page anchors aligned with that container.
- Suppress the shared workspace shortcuts and the canvas fit-view shortcut while a native dialog is open.
- Preserve all existing dialog markup, shortcut behavior with no dialog open, and source-contract assertions.

**Non-Goals:**

- No change to workspace layout, orientation rules, dock tabs, or persistence schemas.
- No change to data generation, exporters, routing, or generated artifacts.
- No new dependency, new component, or new persisted setting. The dialog guard is a transient DOM condition, not user configuration.
- No change to native dialog Escape or cancel handling, and no new Escape branch in the WorkspacePage handler.

## Decisions

### Landing scroll is scoped to one CSS class

Add `.landing-shell` in `src/app.css` with `height: 100dvh`, `overflow-y: auto`, `overscroll-behavior: contain`, and `scroll-padding-top: 3.5rem`. Apply it to the `LandingPage.svelte` root in place of `min-h-screen`, keeping the existing flex column and theme classes. The global `html`, `body`, `#app`, and `.workspace-root` rules stay untouched.

Rationale: the workspace needs the document locked, while the landing page needs an internal scroller. Scoping the change to a landing-only class avoids route-coupled DOM writes to `document.body.style.overflow`, which would require imperative route lifecycle code and shift scroll position on navigation. Alternative considered: remove the global lock and lock only the workspace. Rejected because existing tests and workspace behavior depend on the global lock, and it would expose the document to overscroll from other surfaces.

### Anchor offset uses scroll padding on the container

Reserve the 3.5rem sticky header height with `scroll-padding-top` on `.landing-shell` rather than adding per-anchor margins.

Rationale: the landing page has several in-page anchors, and container-level padding applies to all of them without editing each target. Alternative considered: `scroll-margin-top` on each anchor. Rejected because it duplicates the header height in multiple places and can drift if the header height changes.

### Dialog guard is a single DOM predicate at both shortcut entry points

In `WorkspacePage.svelte`'s `onKeyDown`, return early when `document.querySelector('dialog[open]')` is non-null, before `preventDefault()` and before any shortcut branch. Apply the same predicate at the start of `PackageCanvas.svelte`'s `onKey`, before the remap-cancel and fit-view branches. Keep the existing shortcut set, modifier checks, and `inInput` checks unchanged. Do not add an Escape branch to the WorkspacePage handler.

Rationale: all workspace dialogs are native `<dialog>` elements opened with `showModal()`, which the existing tests assert. A DOM predicate covers every current and future dialog surface without threading local `show*` flags from six components into two handlers. It is evaluated only during a shortcut event, so it needs no store, no persistence, and no cleanup. Alternative considered: call `stopPropagation()` from each dialog. Rejected because it requires editing every dialog and can interfere with native Escape and cancel behavior. Alternative considered: local show flags. Rejected because they duplicate dialog state and can fall out of sync with the actual open dialog.

### Verification stays source-contract based

Extend `tests/viewport-layout.test.ts` with assertions for the new landing-shell declarations and the placement of the dialog guard in both handlers. Leave the global lock assertions, dialog structure assertions, and `tests/compatible-mcu-finder.test.ts` assertions unchanged. Run the full unit suite, strict type check, and production subpath build.

Rationale: the repository verifies layout and wiring through source-contract tests rather than a browser harness. Keeping assertions on declaration strings and guard placement makes the regression visible without adding tooling.

## Risks / Trade-offs

- Risk: a non-modal or nested `<dialog>` open at the same time could suppress shortcuts unexpectedly. Mitigation: workspace dialogs use `showModal()` and the existing source-contract test asserts that contract; the predicate matches only open dialogs.
- Risk: the landing scroller creates a nested scroll region that can trap wheel events. Mitigation: `overscroll-behavior: contain` keeps scrolling inside the landing shell and leaves the document lock intact.
- Risk: fit view via `0` is unavailable while a dialog is open. Mitigation: this is the intended guard behavior; the canvas fit-view control and the shortcut remain available after the dialog closes.
- Risk: source-contract assertions are text based and can be satisfied by a misplaced declaration. Mitigation: assert the full `.landing-shell` block and the guard position relative to shortcut branches, then run the full suite and build.

## Migration Plan

No data migration is required; no persisted schema, share-link schema, or project JSON format changes. Deploy as a static build and roll back by reverting the four source or test files named in proposal.md. No cache clearing or data regeneration is needed.
