# Design: Shared UI abstractions

## Context

See `proposal.md` for motivation. PinCraft is a static Svelte 5 application.
`src/core/` is pure TypeScript with no DOM or Svelte imports; runes live in
`src/state/*.svelte.ts` and components. Four stores persist UI-only preferences
under separate namespaced keys, the two SVG package renderers and two sidebar
components map solver status to colors/labels, and seven components open native
modal dialogs. A large static Vitest suite asserts exact source tokens and
persisted JSON shapes, so refactors must preserve those contracts where they
describe behavior rather than implementation duplication.

## Goals / Non-Goals

- Goals: remove duplicated persistence, status-view, and dialog plumbing; keep
  one definition of each concern; preserve every public store API, stored JSON
  shape, class token, SVG attribute, dialog behavior, and one-mount contract.
- Non-goals: no new dependency, no state-schema change, no new pin data, no
  change to solver results, exporters, routing, theme tokens, generated shards,
  or CI. No rewrite of the static test suite beyond contracts the refactor
  intentionally relocates.

## Decisions

1. **Preference helper owns read/normalize/write, stores own snapshots.** The
   helper exposes safe `readPersistedValue`/`readPersistedRecord` and
   `writePersistedValue`/`writePersistedRecord` primitives plus
   `createPersistedPreference(key, defaultValue, normalize, field?)`. It creates
   one `$state` value, normalizes on construction and on set, ignores no-op
   sets, and writes through. A `field` patches one member of a namespaced JSON
   record; no `field` writes a raw value (the theme string). Each store keeps its
   class, constructor-visible state, getters/setters, keys, and exact stored JSON
   shape, so components and existing tests need no changes. `reset()` and
   multi-field stores call the preference setter, which preserves atomicity of
   the snapshot they write.
2. **Pure pin-view helpers return tokens, not markup.** `isPowerPin(pin)` is the
   single definition of power/reset/boot. `basePinStatus(chip, assignments)`
   replaces the diff modal's loop and matches the solver's initial status
   mapping. `pinStatusTokens(status, flags)` returns the exact
   `{ fill, stroke, text, tagBg }` CSS-variable strings previously returned by
   the perimeter renderer, with remap source then highlighted taking precedence
   over status; the grid renderer reads `fill` and `stroke` from the same result.
   `PERIPHERAL_STATUS_VIEW` is a keyed record of color/border/badge/label tokens
   used by the tree and detail panel. No hex or `rgb()` literal, emoji, DOM, or
   Svelte import is introduced.
3. **Dialog wrapper owns native mechanics.** `Dialog.svelte` renders
   `<dialog class="modal">` with `modal-box` and a direct `modal-backdrop` form,
   captures the opener, calls `openDialogWithFocus()`, handles `onclose`,
   `oncancel`, backdrop clicks, and exports `close()` for callers that must
   close before acting. Callers pass `ariaLabel`, `boxClass` (the existing sizing
   string), `onClose`, optional `bind:focusTarget`, and a children snippet.
   Behavior and markup classes remain identical.
4. **One typed dialog owner for multi-owner dialogs.** `topBarUI.activeDialog`
   is a `$state<DialogKind | null>`; existing boolean flags become accessors over
   it, so all current call sites keep working and only one dialog is active.
   `PinoutDiffModal` and `ShortcutHelpDialog` mount once in `AppShell`;
   workspace-only and landing-only dialogs stay where they are because their
   props come from route-local state. No dialog state enters localStorage,
   share URLs, or project files.
5. **Tests follow the new seams.** Static assertions that named duplicated
   markup now assert the wrapper or helper contract and each caller's use of
   it. Behavioral persistence tests remain and gain a dedicated helper test.
   Pure pin-view tests assert exact tokens and base status mapping. Dialog
   tests assert each dialog still passes its aria label, sizing, focus target,
   and close contract.

## Risks / Trade-offs

- Moving `showModal()` into one component invalidates static tests that searched
  each dialog for native markup → update those tests to the wrapper contract
  and keep assertable caller tokens (aria labels, `92dvh`, focus bindings).
- Boolean flags becoming accessors means setting one dialog closes another →
  matches the single-dialog UX and preserves every existing call site.
- Per-field read-modify-write of a namespaced record could drop unwritten
  fields → each setter writes through immediately, and existing reload tests
  verify all keys and normalized values.
- `bind:this` on the wrapper for `close()` must be typed structurally → callers
  hold `{ close: () => void } | null` and the wrapper exports `close()`.

## Migration Plan

No shipped-state migration. Existing localStorage values keep their keys,
shapes, and normalization. Share links and project files are unchanged.
All refactors land in one change and are verified with the full test suite.

## Open Questions

None.
