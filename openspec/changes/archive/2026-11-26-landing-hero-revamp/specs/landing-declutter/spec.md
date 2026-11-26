# Spec Delta

## REMOVED Requirements

### Requirement: The start screen is a focused application surface

**Reason**: The three-zone hierarchy is replaced by a hero-led two-column layout.

**Migration**: Use the hero and body contract in `landing-hero-revamp`.

### Requirement: Landing styling uses tokens and preserves component logic

**Reason**: `PresetGrid.svelte` is replaced by a focused recent-sessions component; starter-chip logic is removed.

**Migration**: Keep token-only styling and preserve `QuickSearchBar` behavior; render recent sessions through `RecentSessions.svelte`.

### Requirement: Landing declutter preserves behavior and share boundaries

**Reason**: Starter chips and the five-entry-point layout are removed, so the old preservation list no longer describes the page.

**Migration**: Preserve import, compare, board-preset, dialog, retry, and share-boundary behavior under `landing-hero-revamp`.
