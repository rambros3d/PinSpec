# Design

## Context

See `proposal.md` for motivation. Current code facts that shape the approach:

- `GlobalTopBar.svelte` renders `routeTitle` as a left-edge span. For workspace
  and shared routes it resolves to `workspaceStore.chip?.id`, duplicating the
  chip-id switcher button rendered further right.
- The editable project-name pill and its `editingName`, `nameDraft`, and
  `nameInputRef` state are component-local. Commits call
  `workspaceStore.renameProject()`; Enter and blur commit, Escape cancels with
  `e.stopPropagation()`.
- The pin/signal find input is a bar control bound to
  `workspaceStore.globalSearch`, and `topBarUI.focusSearch` is registered in the
  bar's `onMount`. `WorkspacePage.svelte` calls that callback on Ctrl+F.
- `ThemePicker` renders in a separate trailing `ml-auto` group together with the
  Hotkeys control on non-workspace routes.
- `PackageCanvas.svelte` owns the canvas HUD cards and their
  `data-placement-furniture` markers, which feed placement safe-radius
  measurement.
- Static tests assert the current control order, so the placement change needs
  deliberate test updates rather than incidental edits.

Constraints: one global h-12 bar, hash routing, `import.meta.env.BASE_URL`
fetches, localStorage-only UI preferences, version-2 shareable pin configuration
and project name, unchanged native dialog focus contracts, strict TypeScript,
pure `src/core/`, daisyUI tokens with no raw color literals, and no new
dependency.

## Goals / Non-Goals

**Goals:**

- Give the workspace and shared left edge a project-name title that owns editing
  inline, with transient edit state.
- Keep MCU switching available through the existing chip-id pill.
- Move find into the canvas HUD while preserving Ctrl+F and search highlights.
- Right-align the workspace action cluster through Theme.
- Leave non-workspace routes visually and behaviorally unchanged.
- Update the six static test files to cover the new layout and retain the
  persistence, keyboard, and dialog contracts.

**Non-Goals:**

- No new route, store field, schema version, exporter, solver, or generated-data
  change.
- No change to undo/redo behavior beyond the existing rename action.
- No new Rotate button in the bar and no movement of the canvas HUD Rotate
  control.
- No movement of Theme or Hotkeys on non-workspace routes.

## Decisions

- **D1 Title source and fallback.** The title control reads
  `workspaceStore.state.projectName` and uses `Unnamed project` as the primary
  fallback, matching the current pill. A chip id is only a secondary fallback
  inside the same title control when no project name exists; it is never
  rendered by the separate `routeTitle` span. Alternative: keep the chip id and
  append the project name. Rejected because that preserves the duplication the
  change removes.
- **D2 Inline edit moves with the title.** Reuse `beginNameEdit()`,
  `commitName()`, `cancelNameEdit()`, `renameProject()`, Enter/blur commit,
  Escape cancel, and `e.stopPropagation()` in the title slot. All edit state
  stays component-local `$state`. Alternative: a rename dialog. Rejected because
  it would add a new focus contract without changing persisted data.
- **D3 Chip pill stays in the action cluster.** Keep the `title="Switch MCU"`
  button after the workspace divider and before Undo. Alternative: fold the chip
  id into the left-edge title. Rejected because the vendor-filtered switcher
  must remain an explicit action, as required by `multi-vendor-workspace`.
- **D4 Find ownership moves to the canvas.** Remove the input from the bar and
  render it in the `PackageCanvas` HUD using daisyUI `input input-xs` classes,
  the existing `Search` and `X` icons, `workspaceStore.globalSearch`, and a
  `data-placement-furniture` marker. Register `topBarUI.focusSearch` in the
  canvas `onMount` and null it on cleanup; leave the `WorkspacePage` Ctrl+F
  handler untouched. Alternative: keep registration in the bar with a cross-
  component element reference. Rejected because the canvas owns the input DOM.
- **D5 Right alignment uses an auto margin on the workspace action group.**
  Add `ml-auto` to the group that starts at Undo and move `ThemePicker` into it
  for workspace and shared routes; keep the existing trailing group with
  `ml-auto` for non-workspace Theme and Hotkeys. Alternative: `justify-end` on
  the whole row. Rejected because it would also move the left-edge title and
  chip pill.
- **D6 Rotate remains on the canvas.** The current bar has no Rotate control;
  the viewport contract asserts Rotate is canvas-only. The right-aligned cluster
  therefore contains Undo, Redo, Clear, Alternatives, Compare, Share, Export,
  and Theme. The spec states this explicitly so the user's action list is
  honored without reintroducing a duplicate control.
- **D7 Persistence and dialogs are unchanged.** `projectName` stays in workspace
  state, history, recent sessions, version-2 share links, and project files; no
  editing flag is persisted. The `aria-label="Project name"` and
  `aria-label="Rename project"` hooks and Escape propagation guard remain so the
  workspace QOL dialog and keyboard contracts keep passing.
- **D8 Styling stays inside the existing token system.** Use daisyUI component
  and utility classes with theme tokens only, add no dependency, and leave
  `src/core/` untouched.

## Risks / Trade-offs

- [Escape from the title input could open shortcut help] Keep `stopPropagation()`
  on Escape and the existing `inInput` guard in the workspace key handler.
- [Stale `focusSearch` callback after route change] Register in `PackageCanvas`
  `onMount` and clear on cleanup; `topBarUI.reset()` already clears dialog flags.
- [Long project names could crowd the bar] Truncate the title and keep
  `overflow-x-auto`, `min-w-0`, and the existing scroll affordance.
- [HUD find could distort placement safe-radius measurement] Mark the find
  container with `data-placement-furniture` like the other HUD controls and run
  the placement and viewport tests.
- [Static tests encode the old order] Update the six named test files with
  position assertions and keep all persistence and dialog assertions intact.

## Migration Plan

No data migration is needed. Implementation order: bar title, chip pill, and
action alignment; then HUD find input and focus callback; then static test
updates; then full verification and archive. Rollback is a revert of the two
components and the test edits, with no persisted state to restore.

## Test mapping

| Behavior | Spec source | Test file |
|---|---|---|
| Left-edge title replaces `routeTitle` | workspace-topbar-refinement, global-top-bar | `tests/global-app-shell.test.ts`, `tests/viewport-layout.test.ts` |
| Chip pill retained in action cluster | workspace-topbar-refinement, multi-vendor-workspace | `tests/ui-multi-vendor.test.ts`, `tests/global-app-shell.test.ts` |
| Inline edit and transient state | workspace-topbar-refinement, workspace-qol | `tests/global-app-shell.test.ts`, `tests/workspace-qol.test.ts`, `tests/project-naming.test.ts` |
| HUD find and Ctrl+F | workspace-topbar-refinement, workspace-qol, global-top-bar | `tests/workspace-qol.test.ts`, `tests/global-app-shell.test.ts`, `tests/viewport-layout.test.ts` |
| Right alignment and non-workspace non-regression | workspace-topbar-refinement, global-top-bar | `tests/viewport-layout.test.ts`, `tests/global-app-shell.test.ts`, `tests/theme-tokens.test.ts` |
| Pin configuration and project-name persistence | global-top-bar, workspace-qol | `tests/project-naming.test.ts`, `tests/workspace-qol.test.ts` |
