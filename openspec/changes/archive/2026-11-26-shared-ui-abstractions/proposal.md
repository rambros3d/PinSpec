# Proposal: Shared UI abstractions

## Why

Several presentation concerns are implemented independently in multiple places.
The four localStorage-backed preference stores each repeat the same
read/normalize/write pattern; pin status colors, power-pin detection, and
peripheral status labels are duplicated across package renderers, the diff
modal, and the sidebar; and every native dialog repeats opener capture,
`showModal()`, cancel/backdrop handling, and focus restoration. Duplication
makes it possible for one surface to drift from another and inflates the
components with boilerplate that has no domain meaning.

## What Changes

- Add one shared runes-backed `createPersistedPreference` helper in
  `src/state/` with safe localStorage read/write primitives, and refactor the
  shell, workspace-view, discovery, and theme stores onto it without changing
  their public APIs, storage keys, stored JSON shapes, or normalization rules.
- Add a pure `src/core/pin-view.ts` containing `isPowerPin`, `basePinStatus`,
  `pinStatusTokens`, and `PERIPHERAL_STATUS_VIEW`, and refactor the perimeter
  and grid package renderers, the diff modal, and the peripheral tree/detail
  components onto it. Geometry, daisyUI tokens, SVG attributes, and visual
  status remain unchanged.
- Add one `Dialog.svelte` shell component that owns the native `<dialog class="modal">`,
  `modal-box`, `modal-backdrop`, opener capture, focus restore, `showModal()`/`close()`,
  cancel and backdrop closing, and sizing. Refactor the six workspace dialogs
  and the start-screen ambiguous-import dialog onto it.
- Introduce a single typed `activeDialog` owner in `src/state/top-bar-ui.svelte.ts`
  that backs the existing boolean dialog flags, and mount the two dialogs with
  more than one owner (`PinoutDiffModal` and `ShortcutHelpDialog`) once in
  `AppShell`. Workspace-only and landing-only dialogs keep their existing
  single owner and mount location.
- Update affected tests deliberately: preference tests assert the shared helper
  contract plus unchanged persistence behavior; pin-view tests assert the pure
  helpers and token parity; dialog tests assert the wrapper contract and each
  dialog's props instead of duplicated native markup.

## Capabilities

### New Capabilities

- `shared-ui-abstractions`: Preference persistence, pin/peripheral status
  presentation, and native dialog plumbing each have one shared implementation
  that all UI surfaces use, with public behavior unchanged.

### Modified Capabilities

- `global-app-shell`: Dialogs with more than one owner mount once in the shell
  through one typed transient owner; no dialog flag is persisted or shareable.

## Impact

Affected files: four preference stores and their tests, the new state helper and
core pin-view module with new tests, five package/peripheral components, seven
dialog components, `AppShell`, `LandingPage`, `WorkspacePage`,
`top-bar-ui.svelte.ts`, and the static tests covering those surfaces. No pin
configuration, share-link or project JSON schema, generated data, STM32
behavior, theme token, exporter output, or dependency manifest changes.
Verification is `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`,
and `openspec validate --all --strict` with no active changes after archive.
