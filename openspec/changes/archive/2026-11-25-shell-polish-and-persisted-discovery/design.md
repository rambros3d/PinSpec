# Design

## Context

See `proposal.md` for motivation. The application is a static Svelte 5 / Vite
build with hash routing, a single global shell, and two existing localStorage
stores: `shell-preferences.svelte.ts` for sidebar expansion and the About tab,
and `workspace-preferences.svelte.ts` for workspace view state. Discovery
filters in `CatalogPage.svelte` and `QuickSearchBar.svelte` are currently
component-local `$state` and reset on reload. UI tests are source-string tests
under `tests/` plus Vitest unit tests of pure state helpers; there is no browser
test harness. `src/core/` remains pure TypeScript with no DOM or Svelte import,
and generated catalog data is read-only at runtime.

## Goals / Non-Goals

**Goals:**

- Keep discovery filters across reloads and route changes in localStorage only.
- Give the sidebar a direct route to the current project that degrades clearly
  when no target exists.
- Adopt daisyUI 5 component classes for audited status, pending, tab, DMA, and
  dialog surfaces without changing visible strings or behavior.
- Keep the verification suite green with deliberate test updates.

**Non-Goals:**

- No share URL or version-2 project JSON schema change.
- No change to pin configuration persistence, solver behavior, exporters, or
  generated catalog data.
- No new npm dependency, backend surface, raw color literal, or emoji.
- No change to the reserved 3rem rail, 18rem expanded overlay, one shell mount,
  or one sidebar mount.

## Decisions

### 1. A dedicated localStorage-only discovery preference store

Add `src/state/discovery-preferences.svelte.ts` with key
`pincraft:discovery_preferences_v1`. It holds two independent groups, `catalog`
and `quickSearch`, each with `query`, `vendor`, `family`, and `package`. Defaults
are an empty string for text fields and `all` for vendor. Reads and writes are
guarded by `typeof window` and `try/catch`, matching the existing stores. The
store is runes-backed and exposes normalized getters and setters so malformed
values cannot reach a search call.

Alternative considered: extending `shell-preferences.svelte.ts`. Rejected
because that store owns shell chrome, while discovery filters are separate view
state used by two route surfaces; mixing them would blur the boundary that the
existing stores establish. A single shared filter set was also considered and
rejected because it would change today's independent behavior between quick
search and the catalog route.

`CatalogPage.svelte` binds its four filter values to the `catalog` group and
calls its reset action on the same group. `QuickSearchBar.svelte` binds its four
values to the `quickSearch` group. Neither surface writes to workspace state,
share codecs, or the project exporter.

### 2. Workspace entry resolves a target at render time

Define the entry in `GlobalSidebar.svelte` as a computed value placed in the top
navigation group immediately after Home. Target resolution order is
`workspaceStore.chip?.id`, then `workspaceStore.recentSessions[0]?.mcuId`, then
no target. Activation calls the existing `router.navigateMcu(id)` path; when a
chip is already loaded it also uses the established open path so the handoff
does not change. With no target the entry renders as a native disabled control
with a muted theme-token style, no navigation handler, and a visible label, so
it stays discoverable in the rail and expanded panel. The existing `Section`
iteration, recent-session list, separator, and bottom group are untouched.

Alternative considered: adding a `#/workspace` route that resolves a target on
navigation. Rejected because it adds a route and a new mount path for behavior
that already has a hash target, and it would complicate deep links under the
GitHub Pages subpath.

### 3. daisyUI 5 class corrections stay local to the audited surfaces

Apply the audit corrections as class and markup changes only:

- `AboutPage.svelte`: replace `tabs-boxed` with `tabs-box`.
- `ShortcutHelpDialog.svelte`: move `<form method="dialog" class="modal-backdrop">`
  after the closing `</div>` of `.modal-box` so it is a direct child of
  `<dialog class="modal">`. Keep `onclick` target check, `openDialogWithFocus`,
  and `onclose` / `oncancel` handlers unchanged.
- `WorkspacePage.svelte`: replace the hand-rolled border spinner with
  `<span class="loading loading-spinner loading-lg text-info"></span>`.
- Error surfaces in `LandingPage.svelte`, `ProvenancePanel.svelte`,
  `QuickSearchBar.svelte`, and `CatalogPage.svelte` become
  `role="alert" class="alert alert-soft alert-error ..."` with the same message
  text and retry control.
- `SummaryDrawer.svelte`: render contention rows as `alert alert-warning` only
  and other rows as `card card-border ... bg-base-200` only.
- Add a `loading loading-spinner loading-xs` span to the six pending messages
  listed in `proposal.md`.

No new CSS utility or dependency is required. All appearance comes from daisyUI
classes and existing theme tokens, so both vendored themes remain readable.

### 4. Verification is source-level plus focused runtime units

Because UI behavior is exercised through source-string tests, update those
tests deliberately rather than weakening them: keep every test-locked string,
and add assertions for the new classes, the backdrop structure, and the
Workspace entry. Add `tests/discovery-preferences.test.ts` for normalization,
reload restoration, storage failure tolerance, and absence from share/project
output. `tests/shell-preferences.test.ts` and `tests/view-preferences.test.ts`
remain unchanged because their stores are not modified.

## Risks / Trade-offs

- Restored filters can open a discovery surface to an empty result list.
  Mitigation: the existing no-match message and Reset control remain available,
  and defaults are used when stored values are invalid.
- A disabled Workspace entry may be confusing when no chip and no session exist.
  Mitigation: the label stays visible and muted, and the existing recent-session
  hint explains how a session is created.
- Moving the modal backdrop can break outside-click dismissal. Mitigation: the
  dialog-level `onclick` target check and focus helper are preserved, and
  `workspace-qol.test.ts` gains a structural assertion.
- Source-string tests are sensitive to formatting. Mitigation: preserve the
  exact existing strings and use partial token assertions for new classes.
- Restored quick-search filters are independent from catalog filters.
  Mitigation: design decision 1 documents this, and both surfaces offer Reset.

## Migration Plan

No data migration is needed. A missing or malformed
`pincraft:discovery_preferences_v1` record resolves to defaults on first read
and is rewritten only when a filter changes. Share URLs, version-2 project
files, recent-session records, and undo history keep their current schemas.
Rollback is a source revert of this change plus removal of the new key.

## Test Mapping

| Spec scenario area | Test surface |
| :--- | :--- |
| Discovery filters persist and reset | `tests/discovery-preferences.test.ts`, `tests/global-app-shell.test.ts`, `tests/start-screen.test.ts`, `tests/ui-multi-vendor.test.ts` |
| Workspace entry target, disabled state, geometry | `tests/global-app-shell.test.ts`, `tests/viewport-layout.test.ts` |
| Error surfaces and pending indicators | `tests/theme-tokens.test.ts`, `tests/workspace-qol.test.ts`, `tests/start-screen.test.ts` |
| About tab style and provenance surface | `tests/theme-tokens.test.ts`, `tests/global-app-shell.test.ts` |
| Modal backdrop and dialog focus | `tests/workspace-qol.test.ts` |
| DMA row branches | `tests/workspace-qol.test.ts`, `tests/theme-tokens.test.ts` |
| Pin configuration and share schema non-regression | `tests/shell-preferences.test.ts`, `tests/view-preferences.test.ts`, `tests/core-io.test.ts`, `tests/viewport-layout.test.ts` |

Final verification for the implementation agent is `npm test`, `npm run check`,
and `BASE_PATH="/pincraft/" npm run build`, followed by the archive step listed
in `tasks.md`.
