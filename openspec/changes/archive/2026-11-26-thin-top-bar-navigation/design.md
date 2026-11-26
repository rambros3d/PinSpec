# Design: Thin Top Bar Navigation

1. **Two bars with distinct jobs.** `GlobalNavBar.svelte` replaces
   `GlobalSidebar.svelte` and is mounted once on every route at `h-9` (36 px).
   `WorkspaceTopBar.svelte` is extracted from `GlobalTopBar.svelte` and mounted
   once by `AppShell` only when the route is `workspace` or `shared`, at the
   existing `h-12` (48 px). Total workspace chrome becomes 84 px; other routes
   gain 12 px and the full content width.

2. **Navigation order and accessibility.** The thin bar left group is Home,
   Projects, Catalog. The right group is Workspace, About (info icon), GitHub,
   keyboard shortcuts, theme. Each icon-only control has `title` and
   `aria-label`; section links keep `aria-current`. Below the `sm` breakpoint,
   text labels are hidden and every target remains icon-operable. Workspace is
   derived from the loaded chip or most recent session and is disabled when
   neither exists, with a tooltip explaining why.

3. **GitHub link.** Solar bold-duotone has no GitHub glyph. The thin bar uses a
   small inline SVG mark inside an anchor to
   `https://github.com/rambros3d/PinSpec`, with `target="_blank"` and
   `rel="noopener noreferrer"`. The anchor carries the accessible name, so the
   SVG stays `aria-hidden`. No dependency is added.

4. **Workspace bar contents and overlays.** The second bar contains the inline
   project-name editor, MCU switcher, undo/redo, Clear All, Compatible MCUs,
   Compare, Share, and Export, plus the existing horizontal scroll affordance.
   The Clear All confirmation moves from `top-12` to `top-[5.25rem]` so it sits
   below both bars. `topBarUI`, dialog mounts, and `ThemePicker` stay owned by
   the shell; only their host components move.

5. **Layout and preference cleanup.** Remove `.shell-panel`, `.shell-rail`,
   `.shell-backdrop`, `--shell-panel-z`, `--shell-backdrop-z`, and the
   `padding-left: 3rem` reservation on `.app-shell-content`. Change
   `scroll-padding-top` from `3.5rem` to `2.25rem`. Delete the sidebar store and
   its storage key rather than leaving a dead preference.

6. **Spec and test migration.** Remove the sidebar requirements from
   `global-app-shell`, remove the single-bar/rail requirements from
   `global-top-bar`, and add the two-bar contract under the new capability.
   The About-tab portion of the shell-preferences requirement is rewritten to
   cover only discovery filters. Static tests are redirected to the new
   components rather than weakened.

## Risks / Trade-offs

- Eight controls on a phone-width bar are dense. Icon-only collapse below
  640 px keeps all targets visible without a scroll gesture.
- The canvas loses 36 px of vertical space but gains 3 rem of width;
  `ResizeObserver` and fit-view already respond to the new bounds.
- Removing recent sessions from the shell makes the Projects route the only
  list surface, but it already provides search, rename, export, and delete.
