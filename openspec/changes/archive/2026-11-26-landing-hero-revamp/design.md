# Design: Landing Hero Revamp

1. **Hero first.** `LandingPage.svelte` renders one full-width band inside
   `max-w-7xl`. It contains the generated status line, an `h1` reading `Plan a
   pinout`, one factual sentence, a primary `New pinout` button that opens the
   catalog, and `QuickSearchBar` with its vendor/family/package filters. The
   band uses a bordered `bg-dot-grid` surface and generous vertical padding;
   typography and spacing, not imagery, create the visual weight.

2. **No preview surfaces.** The hero does not render a chip diagram, package
   outline, sample assignment, or export preview. This preserves the existing
   start-screen contract while giving the page a real hero.

3. **Two-column body.** Below the hero, a `lg:grid-cols-2` body places
   "Other ways to start" (board preset, `.ioc` import, version-2 JSON import,
   Compare) on the left and "Recent sessions" on the right. Both columns stack
   into one reading order below `lg`. The catalog rail is removed.

4. **Recent sessions component.** `PresetGrid.svelte` is replaced by a focused
   `RecentSessions.svelte` taking `recentSessions`, `onOpenMcu`, and
   `onDeleteRecent`. Each row shows part, package, assigned/pins, relative time,
   Reopen, and Delete. No starter-chip data, notes, badges, or `#presets`
   anchor remain.

5. **Facts and copy.** Generated catalog facts — indexed part count, vendor
   count, sync date, and retry on failure — appear only in the hero. Claim
   badges are removed. All copy describes what the action does. Monospace is
   limited to part numbers, package names, counts, dates, and shortcut keys.

6. **Behavior preserved.** `topBarUI.diffOpen`, the board selector, the
   ambiguous `.ioc` dialog, native file inputs, `QuickSearchBar` filters and
   `Ctrl+K`, and the `.landing-shell` scroll container keep their behavior. No
   new localStorage key or share/project field is introduced.

7. **Verification.** Static tests assert the hero tokens, two-column body,
   compact recent rows, removed starter chips/rail/badges, and unchanged import
   paths. Full unit, type-check, and subpath build checks must pass before the
   change is archived.

## Risks / Trade-offs

- Removing starter chips removes direct entry to representative parts; global
  search and the catalog remain the canonical discovery paths.
- Moving catalog facts into the hero means they are visible once at the top
  rather than in a persistent rail; the values are still generated and
  retryable.
