# PinCraft — Static STM32 Pinout Configurator

PinCraft is a fast, zero-backend, CubeMX-style STM32 pinout planning application built with Svelte 5 (Runes), TypeScript, Vite, and Tailwind CSS v4, designed for instant GitHub Pages deployment. It pairs an automated build-time data pipeline merging official ST physical package geometry with Embassy peripheral/AF/DMA metadata alongside an interactive three-pane pinout workspace and live engineering landing page.

## User Review & Critical Decisions

> [!IMPORTANT]
> All three architectural questions from Phase 1 are locked in below. Review the workspace migration and upstream sync details before proceeding to implementation.

- **Confirmed Decision 1 — Frontend Framework**: Migrate the existing React template workspace to **Svelte 5 (Runes)** with `@sveltejs/vite-plugin-svelte` v7 (Vite 8 compatible), TypeScript (`strict: true`), and Tailwind CSS v4 (`@tailwindcss/vite`). All reactive state will use native Svelte 5 runes (`$state`, `$derived`, `$effect`), with custom lightweight Svelte 5 runes primitives for popovers, context menus, modals, and resizable split panes to avoid third-party peer-dependency friction.
- **Confirmed Decision 2 — Catalog Data Strategy**: **Strict full upstream sync**. At build time, the data pipeline shallow-clones `STMicroelectronics/STM32_open_pin_data` and `embassy-rs/stm32-data-generated` into a gitignored local cache, inspects exact upstream XML/JSON schemas, and emits lazy-loaded static JSON files across the full 1,000+ STM32 catalog (targeting at least 95% chip match rate and keeping uncompressed production output under 150 MB). Any unmatched edge-case XML variants are recorded in a build warnings report rather than blocking catalog generation.
- **Confirmed Decision 3 — Product Identity**: Branded as **PinCraft** across the navigation header, page metadata, exported firmware/CAD headers, and documentation, with strictly zero emojis anywhere in the UI, code, logs, or docs.

> [!NOTE]
> **Environment & Dependency Constraint**: The workspace currently runs Vite 8 and npm/tsx. During execution, we will install `svelte`, `@sveltejs/vite-plugin-svelte`, `svelte-check`, `lucide-svelte`, `fflate`, `vitest`, and `fast-xml-parser` (or equivalent zero-bloat XML parser), replace the React Vite plugin with the Svelte plugin while keeping port 3000 and the AI Studio build contract intact, and retain `BASE_PATH`-aware asset resolution for GitHub Pages subpath hosting.

---

## 1. Overview & Core Concept

- **What It Does**: PinCraft lets embedded hardware and firmware engineers search across the entire STM32 portfolio, visually allocate peripherals onto accurate perimeter (LQFP, QFN, UFQFPN, TSSOP, SO, DIP) and grid (UFBGA, TFBGA, WLCSP) IC packages, resolve pin and DMA conflicts with scarcity-aware auto-allocation and `Ctrl+Click` alternate-pin remapping, share complete pinouts via compressed URL hashes, and export ready-to-use Embassy Rust bindings, C header macros, KiCad/EasyEDA CSV tables, and diffable JSON project files.
- **Target Audience / Persona**: Embedded firmware engineers, PCB layout designers, and robotics/motor-control developers who want STM32CubeMX pin-planning ergonomics in a sub-second browser tab without installing multi-gigabyte desktop tooling.
- **Key Value**: Eliminates desktop tool startup latency and proprietary lock-in by joining open ST physical pinout geometry with Embassy's normalized AF and DMA tables into a static, URL-shareable, deterministic browser IDE.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Instant Exploration & Search (Landing Page `#/`)**:
   - Opens immediately onto a split engineering hero backed by a faint SVG dot-grid.
   - Left column presents the headline *"Fast STM32 pinout planning, directly in your browser."*, a concise engineering summary, a prominent fuzzy MCU search bar (`Ctrl+K`) with interactive segmented family/package filters (`F1`, `F4`, `G4`, `H7`, `U5`, `C0`, `LQFP`, `QFN`, `BGA`) and full keyboard navigation, plus an `Import pinout.json` file trigger.
   - Right column renders a live, interactive `STM32G431CBU6` (`UFQFPN48`) package pre-populated with `SWD`, `SPI1`, `USART2`, and `TIM1` 3-phase complementary PWM. Hovering any pin reveals its alternate function table; clicking a pin toggles or assigns signals live; clicking `"Open in Full Workspace"` hands off the live state directly into `#/mcu/STM32G431CBU6`.
   - Below the fold: conditional Recent Local Sessions (with reopen/delete), 6 Popular Starter Chips spanning major families and both perimeter/BGA renderers (`STM32F411CEU6`, `STM32G431CBU6`, `STM32F103C8T6`, `STM32H743VIT6`, `STM32U575RIT6`, plus one verified `UFBGA`/`TFBGA` part from the generated catalog), a 4-card Core Capabilities strip, an Interactive Export Preview Strip (`Embassy Rust` | `C Header` | `CSV`) live-synced to the hero chip, and a technical footer displaying real sync timestamp, upstream short commit SHAs, total MCUs indexed, and BSD-3-Clause / Embassy attribution.

2. **Peripheral Planning & Conflict Resolution (Workspace `#/mcu/<PART_NUMBER>`)**:
   - Three-pane IDE layout sized for desktop engineering screens (1440px baseline) with collapsible, drag-resizable side drawers.
   - **Left Pane (Peripheral Tree, ~280px)**: Filterable grouped accordion (`System Core`, `Analog`, `Timers`, `Connectivity`, `Other`). Selecting a peripheral mode runs the scarcity-aware auto-allocator; individual signals can be toggled or inspected with assigned pin/AF readouts and conflict tooltips.
   - **Center Pane (Interactive Package Canvas, flex-1)**: Smooth pointer-drag panning and cursor-centered wheel zoom (`0.4x` to `4.5x`), 90-degree step rotation (`0 / 90 / 180 / 270 deg`), fit-to-view (`0`), and global signal/pin search (`Ctrl+F`) pulsing matching pads in cyan.
     - *Hover*: Floating AF table tooltip (`AF0`–`AF15`), pin type, active assignment, and custom net label.
     - *Left-Click*: Searchable pin assignment popover listing GPIO modes (`Input`, `Output`, `Analog`, `EXTI`) and grouped alternate functions with AF indices and inline conflict indicators.
     - *Right-Click*: Context menu with `Set / Edit Label`, `Lock / Unlock Pin`, `Highlight Alternate Pins`, and `Clear Assignment`.
     - *`Ctrl+Click` / `Cmd+Click` on Assigned Pin*: Enters Remap Mode, pulsing every alternate pin supporting that exact `(peripheral, signal)` in cyan (annotated as free, occupied, or locked). Clicking a target moves the assignment while preserving custom net labels; `Escape` cancels.
   - **Right Pane (Summary & Diagnostics Drawer, ~320px)**: Three tabs — **Pin Table** (sortable/filterable assigned pins with inline net-label editing and click-to-center), **Diagnostics** (live errors, SWD/HSE/incomplete-mode warnings, and one-click 1-hop remap fixes), and **DMA** (available DMA streams/channels/DMAMUX mappings for active peripherals with shared-channel contention detection).

3. **Sharing & Firmware/PCB Export (`#/s/<COMPRESSED_PAYLOAD>` & Export Modal)**:
   - Clicking `Share Link` serializes and deflates the active workspace state into a URL-safe Base64 hash (`#/s/...`), copies it to clipboard with a confirmation toast, and restores the exact chip, assignments, labels, locks, and modes when opened—showing a non-crashing recovery banner if a link is malformed.
   - Opening the **Export Modal** provides tabbed monospace previews with Copy and Download actions for `Embassy Rust`, `C Header`, `CSV`, `JSON` (export plus drag-and-drop / file-picker import), and `Share URL`.

### Visual Identity & Theme

- **Aesthetic Direction**: Calibrated hardware engineering instrument—high information density, flat single-elevation panels separated by 1px hairline borders, disciplined whitespace, and crisp vector geometry with zero decorative fluff or emojis.
- **Color Palette & Dual-Theme Architecture** (60-30-10 discipline, dark mode default with high-contrast light mode persisted in `localStorage` and wired via Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));`):
  - *Dark Theme (Default)*: Canvas `#0b0e14`, Structural Surface `#121722`, Elevated Control `#171d2b`, Hairline Border `#1f2937`, Primary Text `#e5e7eb`, Muted Text `#94a3b8`.
  - *Light Theme*: Canvas `#f8fafc`, Structural Surface `#ffffff`, Elevated Control `#f1f5f9`, Hairline Border `#e2e8f0`, Primary Text `#0f172a`, Muted Text `#475569`.
  - *Semantic Pin & Diagnostic Tokens* (always paired with explicit text labels or crisp monochrome glyphs, never color-only):
    - Unused Pin: Slate `#475569`
    - Power / Reset / Boot: Amber `#eab308`
    - Assigned (Valid): Emerald `#10b981`
    - Partial Peripheral Mode / Warning: Orange `#f97316`
    - Conflict / Error: Red `#ef4444`
    - Remap / Search Highlight & Primary Interactive Accent: Cyan `#38bdf8`
- **Typography & Hierarchy** (2+1 font discipline):
  - *UI & Headings*: `Plus Jakarta Sans` (Regular 400, SemiBold 600, Bold 700), `text-wrap: balance` on display headlines, optical tracking adjustments on dark surfaces.
  - *Engineering Data, Pin Coordinates, AF Indices & Code*: `JetBrains Mono` with strict `font-variant-numeric: tabular-nums` across tables, package labels, flash/RAM specs, and code exports.
- **Component Styling & Layout Rules**:
  - Clean unboxed metadata using subtle typographic separators (`·`, `/`) for MCU specs, sync timestamps, and pin counts rather than cluttered static pill badges.
  - Interactive filter controls (`F1`, `G4`, `LQFP`, `BGA`, export tabs, drawer tabs) styled as clean segmented `<button>` groups with single-line labels (`whitespace-nowrap shrink-0`).
  - Top Landing Bar adheres to a clean single-row three-zone structure (geometric IC mark + `PinCraft` wordmark, concise navigation links, primary action + theme toggle); Workspace Top Bar stays locked at `48px` height with single-line controls and zero wrapping.
- **Interactive Feedback & Motion**:
  - Fast, crisp transitions (`<= 150ms` cubic-bezier settling) strictly on compositor properties (`transform`, `opacity`), respecting `prefers-reduced-motion`.
  - Dedicated skeleton loading states during chip JSON fetch, clear empty states in the Pin Table and Diagnostics tabs, and non-blocking toast notifications for clipboard copies, imports, and remap actions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Build-Time Static JSON Sharding vs. Runtime Bundling**
  - *Chosen Approach*: Emit a compact catalog index (under ~300 KB gzipped) plus one lazy-fetched JSON file per MCU, stripping unused register and memory-map blocks from upstream Embassy data.
  - *Why*: Enables instant landing-page paint and sub-100ms workspace transitions across 1,000+ MCUs while keeping total static assets well below 150 MB uncompressed for GitHub Pages.
  - *Alternatives Considered*: Shipping a monolithic JSON bundle (multi-megabyte cold start) or requiring a backend API (violates zero-backend GitHub Pages requirement).

- **Decision 2 — Pure TypeScript Core Engine Decoupled from Svelte**
  - *Chosen Approach*: Keep the constraint solver, scarcity-aware backtracking allocator, 1-hop remap finder, undo/redo command stack, `fflate` URL codec, and all 4 exporters 100% pure TypeScript with zero Svelte or DOM imports.
  - *Why*: Guarantees deterministic unit testing under Vitest, clean separation between domain invariants and reactive UI state, and zero coupling between visual rendering and hardware allocation rules.
  - *Alternatives Considered*: Embedding solver logic directly inside Svelte runes stores (harder to test exhaustively and prone to subtle reactive loops).

- **Decision 3 — Custom Svelte 5 Runes UI Primitives vs. Heavy Component Suites**
  - *Chosen Approach*: Build focused, accessible Svelte 5 runes primitives for split-pane resizing, floating pin popovers, right-click context menus, and modals alongside `lucide-svelte` monochrome icons.
  - *Why*: Eliminates Vite 8 / Svelte 5 / Tailwind v4 peer-dependency conflicts, keeps bundle size minimal, and gives exact control over canvas-anchored popovers and keyboard shortcuts (`Ctrl+K`, `Ctrl+F`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Click`, `Escape`, `0`).
  - *Alternatives Considered*: Pulling in `bits-ui` and `paneforge` unconditionally (risk of version lock-in or breaking transforms with Vite 8).

- **Decision 4 — Dual SVG Renderers with Zoom-Adaptive Density**
  - *Chosen Approach*: Dedicated `PerimeterPackage` renderer (counter-clockwise pin numbering from Pin 1 chamfer/dot, edge-aligned non-overlapping signal + net-label tags for 2-sided DIP/SO/TSSOP and 4-sided LQFP/QFN/UFQFPN) and `GridPackage` renderer (JEDEC row/col matrix omitting `I, O, Q, S, X, Z`, A1 chamfer, progressive zoom detail revealing port names and signals inside BGA/WLCSP balls).
  - *Why*: Perimeter packages from 20 to 144 pins and BGA grids up to 240+ balls have fundamentally different spatial math and readability thresholds at `0.5x` vs `2.5x` zoom.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Component Hierarchy

```text
+------------------------------------------------------------------------------+
|                        BUILD-TIME DATA PIPELINE (CLI)                        |
|  STM32_open_pin_data (XML)   +   embassy-rs/stm32-data-generated (JSON)      |
|  [Multi-part expansion, F1 AFIO, dual-bonded pins, SMPS variants, BGA grids] |
+--------------------------------------+---------------------------------------+
                                       | emits static shards (gitignored)
                                       v
+------------------------------------------------------------------------------+
|                    STATIC CATALOG ARTIFACTS (BASE_PATH-safe)                 |
|    catalog meta  |  compact search index  |  per-MCU normalized chip JSON    |
+--------------------------------------+---------------------------------------+
                                       | lazy fetch + in-memory cache
                                       v
+------------------------------------------------------------------------------+
|                        SVELTE 5 RUNES STATE LAYER                            |
|  Hash Router (#/ | #/mcu/:id | #/s/:hash)  |  Catalog Store  |  Theme Store  |
|  Workspace Store (assignments, labels, locks, modes, history, localStorage)  |
+-------------------+--------------------------------------+-------------------+
                    | calls pure domain functions          | drives reactive UI
                    v                                      v
+--------------------------------------+   +-----------------------------------+
|      PURE TYPESCRIPT CORE ENGINE     |   |          UI VIEW LAYER            |
|  - Normalized Types & Mode Templates |   |                                   |
|  - Constraint Solver & Diagnostics   |   |  Landing View (#/)                |
|  - Scarcity-Aware Auto-Allocator     |   |   ├─ Top Nav & Theme Toggle       |
|  - 1-Hop Remap & Alternate Finder    |   |   ├─ Fuzzy QuickSearch + Filters  |
|  - DMA Contention Analyzer           |   |   ├─ Live HeroChipPreview (G431)  |
|  - Undo/Redo Command History         |   |   ├─ Recent Sessions & Presets    |
|  - fflate + Base64URL State Codec    |   |   ├─ Capabilities & Export Strip  |
|  - Exporters (Rust, C, CSV, JSON)    |   |   └─ Attribution Footer           |
+--------------------------------------+   |                                   |
                                           |  Workspace View (#/mcu/:id)       |
                                           |   ├─ 48px Top Toolbar + Switcher  |
                                           |   ├─ Left: Peripheral Tree        |
                                           |   ├─ Center: Pan/Zoom Stage       |
                                           |   │   ├─ PerimeterPackage SVG     |
                                           |   │   ├─ GridPackage SVG          |
                                           |   │   └─ Hover Tooltip / Popover  |
                                           |   │      + Context Menu           |
                                           |   ├─ Right: Summary Drawer        |
                                           |   │   (Pin Table / Diag / DMA)    |
                                           |   └─ Export & Import Modal        |
                                           +-----------------------------------+
```

### Data Model & State

- **Normalized Chip Schema**: Stores `id`, `family`, `core`, `flashKb`, `ramKb`, `package` (`name`, `kind: "perimeter" | "grid"`, `pinCount`, optional `sides: [left, bottom, right, top]`, optional JEDEC `rows` & `cols`), `pins` (`pos`, `name` preserving dual-bonded labels like `PA11 [PA9]`, `type`, deduplicated `signals` with `peripheral`, `signal`, and `af: number | null` where `null` covers STM32F1 AFIO), and `peripherals` (`kind`, `signals`, optional `dma` channel/stream/DMAMUX tables).
- **Workspace State**: Tracks `mcuId`, `assignments` (keyed by physical pin `pos`), `labels` (custom user net names), `locked` (pin lock flags exempt from auto-allocation), and `peripheralModes` (active declarative mode per peripheral).
- **Persistence & Sharing**: Active sessions auto-save to `localStorage` keyed by MCU for the Recent Sessions shelf; Share Links compress a compact versioned payload (`{ v: 1, m, a, l, k, p }`) using `fflate.deflateSync` + URL-safe Base64 into `#/s/<payload>`.

### Interactive Component & State Mapping

- **Catalog Search & MCU Switcher**: Typing queries runs fast normalized fuzzy/token matching against the cached catalog index, combined with family (`F1`–`C0`) and package (`LQFP`, `QFN`, `BGA`) toggle filters; arrow keys move selection and `Enter` navigates to `#/mcu/<PART_NUMBER>`.
- **Peripheral Mode Allocation**: Changing a peripheral's mode dropdown invokes the pure scarcity-aware backtracking allocator—scoring candidate free unlocked pins by how few competing unallocated peripheral signals they host (preserving scarce USB/I2C/SWD pins). If blocked by an unlocked pin, the solver computes a 1-hop remap move and surfaces a one-click fix action inside Diagnostics.
- **Direct Pin Editing & Remapping**:
  - Left-clicking a pin opens the searchable `PinPopover` anchored near the pin; choosing a signal commits an undoable command (`history.push`) and re-evaluates all solver invariants in linear time.
  - Right-clicking opens the context menu to edit net labels inline, toggle pin lock, highlight alternate pins, or clear the assignment.
  - `Ctrl+Click` / `Cmd+Click` on an assigned pin enters Remap Mode, querying alternate-pin discovery to highlight every valid candidate pad in cyan; clicking a highlighted pad moves the assignment (preserving its custom net label) in a single atomic undo step.
- **Hero-to-Workspace Handoff**: Interacting with the pre-cached `STM32G431CBU6` chip on the landing page mutates a live hero workspace instance that updates the Export Preview Strip in real time; clicking `"Open in Full Workspace"` transfers that exact state into the full Workspace store and navigates to `#/mcu/STM32G431CBU6`.
- **Diagnostics, DMA & Error Recovery**: Every state mutation recomputes duplicate-signal errors, SWD (`PA13`/`PA14`) repurposing warnings, HSE (`OSC_IN`/`OSC_OUT`) overlap warnings, incomplete peripheral mode warnings, and DMA fixed-channel contention alerts. Invalid `#/s/...` links, malformed JSON imports, or missing chip IDs render a clear dismissible recovery banner with a one-click return to the catalog.

### Phased Execution & Verification Gates

1. **Phase 1 — Svelte 5 Migration & Upstream Data Pipeline**: Migrate Vite/TypeScript config to Svelte 5 + Tailwind v4, shallow-clone both upstream repos into `.cache/`, inspect actual XML/JSON structures, implement the join/normalization generator, and verify >= 95% match rate across 1,000+ MCUs plus automated assertions on 5 reference chips (`STM32F411CEU6`, `STM32G431CBU6`, `STM32F103C8T6`, `STM32H743VIT6`, and a verified `UFBGA`/`TFBGA` chip).
2. **Phase 2 — Pure Core Engine & Unit Tests**: Implement types, solver, mode templates, scarcity allocator, 1-hop remap solver, DMA analyzer, undo/redo history, `fflate` URL codec, and all 4 exporters; verify 100% Vitest pass and zero `svelte-check` / `tsc` errors.
3. **Phase 3 — SVG Package Renderers & Interactive Canvas**: Build pan/zoom/rotate stage, `PerimeterPackage`, `GridPackage`, hover AF tooltip, `PinPopover`, context menu, and `Ctrl+Click` remap mode; verify clean non-overlapping geometry from 32-pin QFN through 176+ ball BGA in dark and light themes.
4. **Phase 4 — Complete Three-Pane Pinout Workspace IDE**: Wire `TopToolbar`, `PeripheralTree`, `SummaryDrawer` (Pin Table, Diagnostics, DMA), `ExportModal`, `localStorage` persistence, and `#/s/...` URL hydration; verify end-to-end G431 workflow and share-link reload parity.
5. **Phase 5 — Landing Page & Seamless Navigation**: Build `LandingPage`, live `HeroChipPreview`, `QuickSearchBar`, `PresetGrid`, capability cards, live Export Preview Strip, and metadata footer; verify instant load, hero-to-workspace handoff, zero console errors, and zero emojis repo-wide.
6. **Phase 6 — GitHub Actions CI/CD, Subpath Build & Documentation**: Author the automated weekly-sync GitHub Pages workflow and concise technical `README.md`, and verify a `BASE_PATH="/stm32-pinout/"` production build resolves all routes and static JSON assets cleanly.
