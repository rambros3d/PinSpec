# Tasks

## 1. Hero and landing structure

- [x] 1.1 Rewrite the `LandingPage.svelte` layout into a full-width hero band plus a two-column body inside `.landing-shell` and `max-w-7xl`; add the `Plan a pinout` headline, factual description, primary `New pinout` action, and hero search placement; verify viewport and shell suites pass
- [x] 1.2 Move generated catalog facts and retry into the hero, deleting the right catalog rail and claim badges; verify catalog load/error suites pass
- [x] 1.3 Remove starter chips, the `STARTER_CHIPS` table, `moduleIds` derivation, `#presets` anchor, and all starter-chip prose from the landing surface; verify start-screen and multi-vendor suites pass

## 2. Recent sessions and behavior

- [x] 2.1 Replace `PresetGrid.svelte` with `RecentSessions.svelte` rendering compact rows with part, package, assigned/pins, relative time, Reopen, and Delete; verify start-screen and project suites pass
- [x] 2.2 Keep board presets, `.ioc` import, version-2 JSON import, Compare, the ambiguous-import dialog, drag-drop import, `QuickSearchBar` filters and `Ctrl+K`, and the `.landing-shell` scroll container unchanged; verify behavior suites pass
- [x] 2.3 Keep copy factual, use daisyUI semantic tokens with monospace limited to identifiers and numbers, and add no emoji, raw color literal, or dependency; verify token and icon suites pass

## 3. Documentation, verification, and closeout

- [x] 3.1 Rewrite the `AGENTS.md` start-screen section and README landing description for the hero-led two-column layout; update static tests deliberately for the removed three zones, rail, chips, and badges; verify `npm test` passes
- [x] 3.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no routing, data, solver, exporter, dialog, persistence, or share-schema change
- [x] 3.3 Run `openspec validate landing-hero-revamp --strict`, archive with `openspec archive landing-hero-revamp -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push
