# Design: UX Completion

1. **Keyboard pin activation reuses the pointer path.** Both SVG renderers add
   `role="button"`, `tabindex="0"`, and an `aria-label` built from the existing
   pin title to each interactive I/O group. Enter or Space is converted to a
   synthetic click at the centre of the focused group's bounding box and passed
   to the existing `onPinClick` callback, so remap mode and popover placement
   behave identically for pointer and keyboard. Non-I/O pads stay non-focusable,
   and the global `:focus-visible` rule supplies the focus ring. The SVG wrapper
   keeps `role="img"`, so assistive technology sees a labelled diagram containing
   labelled pin controls.

2. **Portrait fit stays in CSS.** The existing single
   `@media (orientation: portrait)` block in `src/app.css` gains narrower
   padding for `.landing-shell > main` and `.shell-route > main`. No new media
   query, JavaScript layout detection, or document scrolling is introduced, and
   the workspace grid areas remain unchanged.

3. **Catalog additions are presentation only.** A local `sortBy` value orders a
   copy of the existing `searchCatalogEntries()` result by part, pin count,
   flash, or RAM, with stable part-id tie-breaking. Part cells become hash links
   to `#/mcu/<PART>`; the Open button stays as a redundant explicit action. The
   memory column uses one `KB` suffix in the header and `—` for absent values.
   `sortBy` is transient view state and does not enter discovery preferences,
   share URLs, or project JSON.

4. **Project actions stay local.** The projects page filters the existing
   session list by part, name, and package in memory. Delete becomes a two-step
   inline confirmation scoped to one card. Save as reuses the existing
   `exportPinoutJson()` path with a caller-supplied `projectName`, downloads a
   copy, and never calls `renameProject()` or `deleteRecentSession()`.

5. **Copy and shortcut affordances are explicit.** The compatible-MCU finder
   action, title, aria label, and dialog heading use "Compatible MCUs". The
   Clear All confirmation and toast enumerate what is reset.
   `aria-keyshortcuts` mirrors the shortcuts already implemented in the global
   bar and workspace, and the shared shortcut list gains the `?` entry.

6. **Tests assert seams, not pictures.** Static checks confirm the new tokens in
   renderers, CSS, and pages. Pure helper tests cover sort ordering and memory
   display values. Existing shell, catalog, project, and shortcut suites are
   updated deliberately where they assert old copy. No shards, generated data,
   or solver fixtures are required.

## Risks / Trade-offs

- A synthetic `MouseEvent` needs a DOM element for its coordinates; the fallback
  is the pin group's centre, so a keyboard activation still opens the popover
  even when layout measurement returns an empty rectangle.
- Catalog sorting does not persist across reloads. This keeps view state out of
  shareable and stored preference schemas; filtering remains persisted as
  before.
- Save as produces a downloaded copy rather than a second recent session,
  because recent sessions are keyed by MCU id and cannot hold duplicates.
