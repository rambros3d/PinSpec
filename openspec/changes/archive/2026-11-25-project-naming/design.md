# Design

## Context

`WorkspaceState` is the single shareable state object. `cloneWorkspaceState` and
`statesEqual` in `src/core/history.ts` define history semantics; `encodeWorkspaceState`
and `decodeWorkspaceState` in `src/core/url-state.ts` define the compact version-2
share payload; `exportPinoutJson` and `parsePinoutJson` in
`src/core/exporters/json.ts` define the version-2 project file. The workspace
store's `openMcu()` chooses between an override state, a pending handoff, a saved
recent session, and a fresh `createEmptyWorkspace(chip.id)`. `RecentSession`
stores the whole state under `pinspec:recent_sessions_v1`, so a field on
`WorkspaceState` reaches recent sessions without a second record shape. See
`proposal.md` for motivation and `specs/` for the behavior contract.

Constraints already in force: `src/core/` is pure TypeScript with no Svelte or
DOM imports; UI preferences stay in localStorage and out of share/project files;
no emoji, no raw color literals, no new dependency, no handwritten MCU data, and
STM32 share and project output must stay stable.

## Goals / Non-Goals

**Goals:**

- Give each newly created workspace session a short, deterministic, testable
  name that derives from UI vocabulary and generated chip identifiers only.
- Carry the name through every shareable surface without a schema version bump.
- Provide one inline edit interaction in both the global top bar and the
  Projects cards, backed by a single store action and the existing history.

**Non-Goals:**

- No globally unique registry, server lookup, or collision-free guarantee. The
  MCU identifier remains the identity key; the name is a label.
- No new route, dialog, modal, or always-visible text input.
- No change to MCU catalog generation, board presets, `.ioc` import, or any pin
  solver rule.
- No auto-generation for older share links, project files, or recent sessions
  that lack a name.

## Decisions

### Decision 1: Pure name core with an injected RNG

`src/core/project-name.ts` owns a small curated word array and two pure helpers:

- `generateProjectName(chip, rng)` returns `word-word-family`, where `chip`
  supplies `family` or `id`, and `rng: () => number` selects the two entries.
- `normalizeProjectName(raw)` trims, lowercases, replaces disallowed runs with
  `-`, collapses repeats, trims leading/trailing `-`, caps length at 48, and
  returns `undefined` for an empty result.

The RNG is a required argument. There is no default random source inside core,
so tests inject a fixed sequence. The state layer passes a thin `Math.random`
wrapper at the single new-session call site. Rejected alternative: generating
inside `createEmptyWorkspace()`; that helper has no chip family and is also used
for arbitrary empty states, so it would generate names in places that are not
new MCU sessions.

The word list is UI vocabulary, not MCU data. Family and suffix values come only
from generated `ChipData.family` or `ChipData.id`.

### Decision 2: One optional field, omitted when absent

`WorkspaceState.projectName?: string` is declared as shareable pin-planning
metadata in the same doc comment style used by `placement` and
`packageRotation`. It is cloned and compared by the history helpers so a rename
is undoable. Both codecs use a new optional key emitted only for a normalized
non-empty name: `n` in the compact URL payload and `projectName` in the project
file. Decoders accept a string, normalize it, ignore malformed or empty values,
and never throw. Because the field is optional, `PINSPEC_STATE_VERSION` stays 2
and there is no v1 compatibility path.

### Decision 3: Generate only on the fresh-session branch

`openMcu()` keeps its existing precedence: override state, pending handoff,
recent session, fresh empty workspace. Only the fresh branch attaches a name,
using the loaded chip for the suffix. Override states from share links and
project files, pending handoffs, and recent sessions keep whatever name they
carry, including none. This makes reuse a property of state hydration rather
than of a separate lookup.

`persistCurrentSession()` already clones the full state, so the name reaches
localStorage recent sessions and the Projects cards without a new top-level
field. Card rendering reads `session.state.projectName`.

### Decision 4: One rename action for both edit surfaces

The workspace store exposes `renameProject(name: string, mcuId?: string)`. It
normalizes the value with `normalizeProjectName`, then:

- when the target is the active chip, clones the current state, sets or deletes
  `projectName`, and sends it through the existing `commit()` so history, the
  current state, and the recent session are updated together;
- when the target is not active (a Projects card for a saved session), updates
  that session's stored state and re-persists the recent list; if that MCU is
  later opened, hydration restores the stored name.

Both the top-bar pill and the card input call this action, so sanitization and
commit semantics are shared. The inline inputs use component-local transient
state only; nothing about the editing mode is persisted.

### Decision 5: Compact inline editing in existing surfaces

`GlobalTopBar.svelte` adds a button beside the MCU pill showing the name or a
neutral placeholder. Click swaps the button for a small input. Enter and blur
commit; Escape restores the previous value and returns to the button. The bar
keeps its h-12 height and horizontal overflow behavior. `ProjectsPage.svelte`
uses the same input pattern on each card. Styling uses existing daisyUI tokens
and monochrome icons, with no raw color literal and no emoji. The new input is
included in the text-field guard that prevents `?`, Ctrl+K, and Ctrl+F from
firing while typing; Escape cancels the edit before any popover or dialog
closes.

### Decision 6: Deliberate static-test updates

The repository's shell and QOL tests assert markup strings. They are updated
intentionally in the same change rather than left to fail:
`tests/global-app-shell.test.ts`, `tests/start-screen.test.ts`,
`tests/package-rotation.test.ts`, `tests/core-io.test.ts`,
`tests/workspace-qol.test.ts`, `tests/view-preferences.test.ts`, plus a new
`tests/project-naming.test.ts` for pure generation, sanitization, codec
round-trips, history undo, store creation and reuse, and both edit surfaces.

### Risks / Trade-offs

- [Small word list can produce duplicate labels] -> Names are labels, not keys;
  MCU identifier stays authoritative and recent sessions remain keyed by MCU.
- [Curated words can read badly in combination] -> Keep the list short and
  neutral, and keep the family suffix mandatory so the label stays descriptive.
- [Long or odd family identifiers produce clipped suffixes] -> Sanitization and
  the 48-character cap are deterministic and covered by unit tests.
- [Escape has several owners in the workspace] -> The inline input checks
  focus first and cancels its own edit before global remap, popover, or help
  handling runs.
- [Old share links and project files have no name] -> Optional field and
  no auto-generation on decode keep them readable and byte-stable apart from
  the new field.
- [Two rename surfaces edit the same session] -> Both call the same store
  action; the last commit wins and history remains consistent.

## Migration Plan

No schema or data migration is required. Version-2 payloads without the field
decode as before. Older recent sessions show no name until renamed or until a
fresh session for that MCU is created. Rollback is a code revert; no generated
data or persisted key needs removal, and a leftover name field is ignored by
older builds.

## Open Questions

- The exact neutral placeholder copy and icon for an unnamed pill are UI copy
  details that can be chosen during implementation without changing behavior.
