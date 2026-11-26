# Tasks

## 1. Pure name core and shareable state field

- [x] 1.1 Add `src/core/project-name.ts` with a small curated word list, `generateProjectName(chip, rng)` requiring an injected RNG, and `normalizeProjectName(raw)` with lowercase charset sanitization and a 48-character cap; verify deterministic generation, fallback suffix, bounded output, and empty-input cases in new `tests/project-naming.test.ts` pass with `npx vitest run tests/project-naming.test.ts`.
- [x] 1.2 Add optional `projectName?: string` to `WorkspaceState` in `src/core/types.ts` with a doc comment declaring it shareable pin configuration, not a UI preference; verify `npm run check` exits zero with no strict TypeScript error.
- [x] 1.3 Update `cloneWorkspaceState` and `statesEqual` in `src/core/history.ts` to copy and compare the optional name; verify new history tests in `tests/project-naming.test.ts` show rename is undoable and redoable with `npx vitest run tests/project-naming.test.ts`.

## 2. Version-2 share URL and project file codecs

- [x] 2.1 Add optional compact key `n` in `src/core/url-state.ts`, emit only for a normalized non-empty name, and decode string values by normalizing while ignoring malformed or empty ones; verify name round-trip, absent-name, and malformed-field cases in `tests/core-io.test.ts` pass with `npx vitest run tests/core-io.test.ts`.
- [x] 2.2 Add optional `projectName` to `PinSpecProjectFile` in `src/core/exporters/json.ts`, emit it when present, and restore it on import without changing field ordering for existing files; verify deterministic export and import round-trip cases in `tests/core-io.test.ts` pass with `npx vitest run tests/core-io.test.ts`.
- [x] 2.3 Confirm `PINSPEC_STATE_VERSION` remains 2 and no legacy import path is introduced; verify `npm test` exits zero and a scan shows no version bump or v1 compatibility branch.

## 3. Workspace store creation, reuse, and rename

- [x] 3.1 In `openMcu()` from `src/state/workspace.svelte.ts`, attach a generated name only on the fresh-session branch using the loaded chip and a `Math.random` wrapper; verify `tests/project-naming.test.ts` covers new MCU generation, recent-session reuse, pending-handoff reuse, share-link reuse, and project-file reuse with `npx vitest run tests/project-naming.test.ts`.
- [x] 3.2 Add a single `renameProject(name, mcuId?)` store action that normalizes the value, commits through existing history when the target is active, and updates and persists the saved session otherwise; verify active and inactive rename cases in `tests/project-naming.test.ts` pass with `npx vitest run tests/project-naming.test.ts`.
- [x] 3.3 Verify `persistCurrentSession()` carries the name into `pinspec:recent_sessions_v1` and that shell preferences stay free of it; verify updated `tests/view-preferences.test.ts` assertions pass with `npx vitest run tests/view-preferences.test.ts`.

## 4. Global top bar name pill and shortcut guard

- [x] 4.1 Add a compact pill next to the MCU pill in `src/components/shell/GlobalTopBar.svelte`, switch to an inline input on click, commit on Enter or blur through `renameProject`, and cancel on Escape; verify updated `tests/global-app-shell.test.ts` assertions pass with `npx vitest run tests/global-app-shell.test.ts`.
- [x] 4.2 Keep `?`, Ctrl+K, and Ctrl+F from firing while the inline input has focus and make Escape cancel the edit before other dismissals; verify updated `tests/workspace-qol.test.ts` and `tests/start-screen.test.ts` assertions pass with `npx vitest run tests/workspace-qol.test.ts tests/start-screen.test.ts`.
- [x] 4.3 Keep the h-12 bar height, horizontal overflow affordance, theme tokens, and monochrome icons unchanged with no raw color literal or emoji; verify updated `tests/package-rotation.test.ts` assertions pass with `npx vitest run tests/package-rotation.test.ts`.

## 5. Projects card name display and inline rename

- [x] 5.1 Show the stored name on each `src/pages/ProjectsPage.svelte` card and add an inline rename input using the same store action and normalization as the top bar; verify updated card assertions in `tests/global-app-shell.test.ts` pass with `npx vitest run tests/global-app-shell.test.ts`.
- [x] 5.2 Keep card thumbnails shard-free and keep open, delete, import, and export behavior unchanged; verify `tests/start-screen.test.ts` and `tests/global-app-shell.test.ts` pass with `npx vitest run tests/start-screen.test.ts tests/global-app-shell.test.ts`.
- [x] 5.3 Show the saved project name on recent-session entries in `src/components/shell/GlobalSidebar.svelte` when present; verify updated sidebar assertions in `tests/global-app-shell.test.ts` pass with `npx vitest run tests/global-app-shell.test.ts`.

## 6. Documentation and full verification

- [x] 6.1 Update `README.md` to state that the optional project name is shareable metadata in workspace state, version-2 URLs and files, and recent sessions, and that inline editing state is component-local; verify the updated text contains no emoji or marketing wording.
- [x] 6.2 Run `npm test && npm run check && BASE_PATH="/pinspec/" npm run build` after all earlier tasks pass; verify all three exit zero with no build warnings and no subpath asset error.
- [x] 6.3 Run `openspec validate project-naming --strict`; verify the command exits zero and all artifacts and delta specs are recognized.

## Workflow follow-up

- After every tracked task passes, run `openspec archive project-naming -y` as the implementation agent.
- Verify the archived result places the new capability under `openspec/specs/project-naming/` and syncs the modified blocks into `openspec/specs/multi-vendor-workspace/`, `openspec/specs/global-top-bar/`, `openspec/specs/global-app-shell/`, and `openspec/specs/workspace-qol/`.
- Include the synced specs and archived change in the implementation commit; commit and push only after archive.
- Report validation, unit test, type-check, build, and archive output as evidence.
