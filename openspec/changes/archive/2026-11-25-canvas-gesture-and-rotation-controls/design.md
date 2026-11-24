# Design

## Context

See `proposal.md` for motivation. The canvas stage currently uses a Svelte `onwheel` attribute whose handler calls `preventDefault` and applies a fixed 1.12 step through a cursor-centred zoom operation. Touch and Safari gesture events have no handler, and there is no `touch-action` rule, so browsers zoom or pan the page. Rotation is a UI-only `$state<0 | 90 | 180 | 270>` in the workspace store, reset to 0 when an MCU opens and cycled by a clockwise toggle. `PackageCanvas.svelte` applies it as a CSS rotation to a wrapper around the whole SVG, so text rotates with the body; fit view swaps effective width and height for the 90 and 270 cases.

Workspace state is version 2 and already persists additive optional fields through four paths: history clone and equality helpers, recent-session `localStorage` (which stores a cloned state), a compressed share payload with compact keys, and a deterministic version-2 project file. The two SVG renderers own their own geometry and text; the canvas passes props and receives pin-click, context-menu, and hover callbacks. Static Vitest tests assert literal strings in these source files, including document overflow and height rules, the highlight-set expression, theme utilities, and mux-label helpers.

## Goals / Non-Goals

**Goals:**

- Route wheel, ctrl/meta wheel, two-pointer pinch, and Safari gesture input through the one cursor-centred zoom operation, with page zoom and page pan suppressed over the stage.
- Reduce rotation to two states, 0 and -90 degrees counter-clockwise, with all text and tags upright in both states.
- Persist rotation through history, `localStorage`, share links, and version-2 project files, with absent values normalizing to 0 and unchanged serialization.
- Preserve pointer pan, popover and tooltip clamping, fit view, pin focus, vendor rendering, theme tokens, and STM32 behavior.

**Non-Goals:**

- No free-angle rotation and no 90, 180, or 270 degree states.
- No changes to catalog data, generated shards, CSV/Rust/C exporters, or npm dependencies.
- No rewrite of pointer pan, remap mode, or overlay clamping.
- No session-only rotation value or second source of truth for workspace state.

## Decisions

1. **Native non-passive listeners and a scoped `touch-action: none` rule.** Register `wheel` on the stage element with `addEventListener(..., { passive: false })` during mount and remove it on cleanup; register `gesturestart` and `gesturechange` the same way and prevent their default action. Add one CSS rule scoped to the canvas stage class. Plain wheel keeps the fixed step; ctrl/meta wheel uses a small exponential factor of `deltaY` so trackpad pinch is smooth.
   - Alternative: keep the Svelte `onwheel` attribute and rely on `preventDefault`. Rejected because it does not cover passive touch defaults or Safari gesture events.
   - Alternative: `touch-action: manipulation`. Rejected because browser pinch zoom still fires.

2. **Pinch reuses the existing cursor-centred zoom operation.** Track active touch pointers by pointer id. When a second pointer arrives, cancel any single-pointer pan and record the pointer distance and midpoint. On each move, compute the distance ratio from the previous sample and apply it to the same zoom operation used by the wheel handler, passing the pinch midpoint as the cursor point. Re-baseline after every move and whenever the pointer count changes. Safari gesture scale uses the same ratio path. Clamping stays in the existing zoom operation.
   - Alternative: apply an independent CSS scale for pinch. Rejected because it would fork zoom and pan math and break fit view, the zoom HUD, and focus centring.

3. **Rotation becomes persisted version-2 state.** Add a `PackageRotation = 0 | -90` type and a normalizer that accepts only -90 and maps every other value to 0. Add optional `packageRotation` to `WorkspaceState`. The store exposes the effective rotation from state and toggles by cloning state, setting the field to -90 or removing it, and committing one history entry. Opening an MCU no longer resets a session-only rotation.
   - Alternative: keep a separate view flag and mirror it into storage on change. Rejected because it creates two sources of truth and can diverge on undo, share, and import.

4. **Rotate geometry in SVG and counter-rotate text at its own anchor.** Remove the CSS rotation wrapper. Pass `rotation` to both renderers. Each renderer wraps its geometry in an SVG group rotated around the viewBox centre when the value is -90. Every text and signal-tag group gets a wrapper rotated by the opposite angle around that element's own anchor; where text already carries `rotate(-90)`, add the counter-rotation angle at the same anchor. This covers centre markings, exposed-pad text, pad names, position numbers, tag groups, grid headers, ball labels, and the footer. Lock glyphs and chamfer markers rotate with the pad because they mark geometry, not text. Fit view keeps its effective-dimension swap using the -90 check.
   - Alternative: keep the CSS wrapper and counter-rotate text inside it. Rejected because nested CSS and SVG transforms compose unpredictably and make hit targets and tooltips harder to keep aligned.

5. **Additive persistence with byte-identical absence.** History clone copies `packageRotation` only when it is -90; equality compares normalized values so absent and explicit 0 are the same visible state. The compact URL payload gains key `z` set to -90 only when rotated; decoding accepts only -90. The project file gains the same optional field, emitted only when -90 and parsed through the normalizer. Recent sessions need no new storage key because they store the cloned state. Toolbar and HUD labels read the same effective value.
   - Alternative: reuse an existing compact key or add a boolean flag. Rejected because existing keys have defined meanings and a direct value is clearer for debugging links.

6. **Tests are contract-preserving.** Extend the static tests with new assertions for non-passive listener registration, the scoped touch rule, the SVG rotation transform, the counter-rotation wrappers, and the two-state union, while leaving the existing document overflow and height strings, `set.add(pos)`, theme utilities, bonded-pin and exposed-pad checks, and mux-label assertions intact. Add pure unit tests for the normalizer, history clone and equality, URL round trips, project-file round trips, and byte-identical absence.

## Risks / Trade-offs

- [Gesture and pointer events can both fire for one touch action] -> Suppress single-pointer pan while a pinch or Safari gesture is active, re-baseline on count changes, and clear gesture state on gesture end and pointer cancel.
- [Rotated non-square geometry can extend beyond the original viewBox] -> Keep SVG overflow visible and use swapped effective dimensions in fit view; verify SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 at both zoom limits and in both themes.
- [Top and bottom tags already carry a -90 rotation] -> Combine that angle with the counter-rotation around the same anchor rather than nesting a second transform; keep the existing suppression of dense tags below the zoom threshold.
- [Older share links and project files have no rotation field] -> Normalize to 0, omit the field on serialization, and do not change the schema version.
- [Static tests pin literal source strings] -> Preserve every existing asserted string and add new assertions separately rather than rewriting those blocks.
- [`touch-action: none` disables browser touch panning on the stage] -> Retain pointer-event panning for a single touch on the background; only two-pointer input is pinch zoom.

## Migration Plan

The field is additive and needs no data migration. Existing links and project files load at rotation 0 and serialize without the new field. Rollback consists of reverting the touched source and test files; no generated data or stored external artifacts are changed. After implementation, run the unit tests, strict type check, and subpath production build, then archive this change in OpenSpec as required by the repository contract.
