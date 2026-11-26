# Spec Delta

## REMOVED Requirements

### Requirement: The landing route is a three-zone start screen

**Reason**: The three-zone dashboard is replaced by a functional hero and a two-column body.

**Migration**: Use the hero and body contract in `landing-hero-revamp`.

### Requirement: The sticky header keeps navigation and theme

**Reason**: Navigation and theme are owned by the global shell, not the landing page.

**Migration**: Keep the shared thin navigation bar; the landing page renders no header.

### Requirement: The left action column provides five entry points

**Reason**: The primary catalog action moved into the hero; other entry points form the body's action column.

**Migration**: Use the hero action and secondary actions in `landing-hero-revamp`.

### Requirement: The central discovery column keeps existing search and presets

**Reason**: Search moved into the hero and starter chips were removed.

**Migration**: Keep `QuickSearchBar` behavior in the hero; remove preset-chip rendering.

### Requirement: The right rail shows live catalog facts and shortcuts

**Reason**: Catalog facts moved into the hero and the rail is removed.

**Migration**: Render generated facts and retry in the hero only.
