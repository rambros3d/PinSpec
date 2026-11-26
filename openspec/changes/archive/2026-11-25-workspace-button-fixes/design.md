# Design

## Context

Runtime evidence was collected against the production build in headless
Chromium at a 1440x900 viewport. Clicking Zoom In produced `pointerdown` on the
button's SVG path, `pointerup` on `DIV.canvas-stage`, and `click` on the stage;
the zoom percentage stayed at 65%. The same retargeting made the placement
toggle, Fit, Rotate, the find clear control, and a popover's `GPIO_Input`
assignment button inert. The drawer collapse button's center resolved to the
canvas find input because both use `absolute top-14 right-3 z-20`.

Repository constraints that shape the change:

- `src/core/` stays pure TypeScript; only the project-name generator changes.
- Theme tokens stay in `src/themes/daisyui.css`; no raw color is added.
- Persistence split is unchanged: pin configuration, including the project
  name, remains shareable; presentation state stays in localStorage and
  transient view state.
- STM32 behavior, generated shards, exporters, and hash routing are untouched.

## Goals / Non-Goals

**Goals:**

- Every DOM control inside the canvas stage receives its own click.
- The landscape summary drawer toggle is reachable and clickable.
- Generated names are two words; existing names are never rewritten.
- The workspace title row shows the app icon followed by the editable name.
- The sidebar starts with navigation rather than a brand header.

**Non-Goals:**

- Redesigning working pan or zoom behavior, solver logic, or pin rendering.
- Moving the sidebar expand control into the top bar; the existing control and
  its static contract stay in place.
- Adding dependencies, theme tokens, persisted view fields, or a URL v1 path.

## Decisions

### Pointer capture scope

Keep `activePointers` bookkeeping for pinch gestures, but start a pan and call
`setPointerCapture()` only when the pressed target is the stage element itself
or a descendant of the transformed SVG content element and is not a pin hit
target. DOM overlays (HUD cards, find input, popover, context menu, remap
banner, placement overlay) are children of the stage but not of the SVG
content, so they never initiate canvas pan.

Rationale: this preserves left-drag panning over the package background and
middle-button drag on the SVG surface while leaving every overlay control's
click target intact. Alternative rejected: adding `stopPropagation()` to each
overlay button; that would need to be repeated for every future control and
would still leave text inputs and backdrop catchers exposed.

### Drawer toggle placement

Move the landscape drawer collapse button from `top-14 right-3` to
`bottom-3 right-3` inside `.workspace-canvas`. The bottom-left corner holds the
semantic legend and the bottom-right corner is otherwise empty in both themes.
No new z-index or overlay is introduced.

### Remap banner placement

Move the remap banner from `top-3` to `top-28` and cap its width to the stage.
At `top-3` the banner's Cancel control sits under the top-right zoom HUD at
narrow landscape canvas widths, so the pointer reaches the HUD instead of the
banner. The second HUD row ends above `top-28`, leaving the Cancel control
unobstructed.

### Two-word project names

`generateProjectName()` composes two words from `PROJECT_NAME_WORDS` using the
injected RNG and returns the normalized pair. The `ChipData` parameter is kept
for API stability but is no longer read, so no MCU fact is consulted. Existing
names continue to be read from recent sessions, share links, and project files
without regeneration.

Rationale: the vocabulary already yields distinguishable short names, and the
family suffix makes the pill longer without adding information already visible
in the MCU switcher.

### Workspace title icon

Render `<img src={`${import.meta.env.BASE_URL}radiokit-logo.svg`}>` immediately
before the inline name control inside the existing workspace branch of the
global bar. The non-workspace wordmark branch is unchanged, so the existing
"PinSpec" text assertion still holds.

### Sidebar navigation start

Delete the `flex h-12` header `<div>` and its logo and label from
`GlobalSidebar.svelte`. The section `<nav>` becomes the first child of the
aside. Collapse, recent sessions, Hotkeys, and About entries are unchanged.

## Risks / Trade-offs

- [Panning regression] -> Re-run runtime pointer checks on the SVG background
  after the change and keep the existing pointer test tokens.
- [Static contract drift] -> Update only the generation-specific project-name
  expectations; leave saved-name fixtures with their three-part values to
  prove there is no retroactive rename.
- [Small viewport] -> Verify the relocated drawer toggle at a landscape
  viewport with the find HUD present.
- [Spec sync] -> Delta specs for the four touched capabilities must match the
  archived wording so validation stays strict.

## Migration Plan

Static client change with no stored-data migration. Apply the edits, update
tests and documentation, run the full verification sequence, then archive the
change so the delta specs are synced into `openspec/specs/`. Rollback is a
normal revert of the implementation commit.
