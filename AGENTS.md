# AGENTS.md

## Project: PinCraft (STM32 Pinout Configurator)

PinCraft is a fast, static, CubeMX-style pinout planning web application. It is a
browser-native alternative to STM32CubeMX: no backend, no install, no cloud
service. It combines an engineering-grade landing page, a three-pane pinout
workspace, and an automated build-time catalog generator.

- Repository: https://github.com/rambros3d/pincraft (public)
- Production site: https://rambros3d.github.io/pincraft/
- Source of truth for behavior: this file and `README.md`
- Upstream data is **read-only reference**; never edit files inside `.cache/`

### Current implementation status

The STM32 pipeline, core engine, renderers, workspace, landing page, exporters,
and GitHub Pages deployment are implemented and passing CI. The multi-vendor
types (`VendorId`, `MuxModel`, `PinTag`, `remaps`, `pio`, `resourceId`) are
**declared but not yet emitted or consumed**. Treat the multi-vendor section of
this document as a roadmap, not as shipped behavior. Any change to those fields
must preserve STM32 behavior exactly.

---

## Agent operating contract

Agents have full architectural and implementation authority to execute work in
this repository end-to-end without pausing for confirmation, subject to the
guardrails below.

### Inspect before coding

1. Read this file and `README.md` before any implementation task.
2. Inspect the real upstream data before touching the data generator. Both
   upstream repositories are shallow-cloned into the gitignored `.cache/`
   directory by `npm run gen-data`. Verify actual XML tag names, attribute
   casing, and JSON field names in:
   - `.cache/STM32_open_pin_data/mcu/*.xml`
   - `.cache/stm32-data-generated/data/chips/*.json`
   Never implement normalization from memory.
3. Inspect existing types and stores before creating new ones:
   - `src/core/types.ts`
   - `src/core/solver.ts`
   - `src/state/*.svelte.ts`
   Adapt names and conventions from the plan to the existing code rather than
   duplicating modules.
4. Preserve backward compatibility: existing `#/mcu/<PART>` deep links,
   `#/s/<PAYLOAD>` share links, `localStorage` sessions, and `version: 1`
   `pinout.json` files must keep loading identically.

### Autonomous blocker resolution

- If a third-party UI primitive (`bits-ui`, `paneforge`, `@tanstack/svelte-table`,
  etc.) conflicts with Svelte 5 or Tailwind CSS v4 peer dependencies, replace it
  immediately with a small custom Svelte 5 runes component. Do not stall on
  dependency resolution.
- If a subset of upstream MCU XML files fails schema matching (dual-die, SiP,
  undocumented SMPS variants), record each case in `public/data/build-warnings.json`,
  log the match ratio, and continue. Do not fail the whole catalog for a small
  subset of parts.
- If a dependency conflict blocks `npm ci`, resolve it in the lockfile and
  `.npmrc` rather than editing application code. The current `.npmrc` sets
  `legacy-peer-deps=true` because `svelte-check@4` peer range excludes the
  TypeScript 7 toolchain.
- Keep generated output well within the GitHub Pages 1 GB limit. Target under
  150 MB uncompressed across all per-chip JSON shards by omitting unused
  register and memory-map fields.

### Hard engineering constraints

- **Zero emojis.** Do not use emojis anywhere: UI copy, tooltips, buttons,
  logs, code comments, commit messages, or documentation. Use monochrome vector
  icons (`lucide-svelte` or inline SVG) instead.
- **Strict layer separation.** `src/core/` is 100% pure TypeScript with zero
  Svelte or DOM imports. The solver, history stack, URL codec, and exporters
  must remain deterministically unit-testable with Vitest on the host. Svelte
  reactivity lives only in `src/state/*.svelte.ts` and components.
- **No committed generated data.** `.cache/`, `public/data/`, `dist/`, and
  `node_modules/` are gitignored. Generate catalog data with `npm run gen-data`
  locally and automatically in GitHub Actions.
- **No backend.** The app is static. Do not introduce Express servers, API
  routes, server-side Gemini/GenAI calls, or secret-based runtime services.
- **Self-verification.** Run type checks, unit tests, and a production build
  after every phase. Fix warnings and regressions before advancing to the next
  phase.
- **No `std`-style assumptions in core.** The core engine is pure functions and
  plain data only.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Vite + Svelte 5 (runes) + TypeScript `strict: true` |
| Package manager | npm (`package-lock.json` is canonical; CI uses `npm ci`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| UI primitives | Small custom Svelte 5 runes components; `lucide-svelte` icons |
| Search & compression | Token-ranking fuzzy search + `fflate` deflate/Base64URL |
| Testing | Vitest (unit), `tsc --noEmit`, Vite production build |
| Data pipeline | TypeScript CLI via `tsx` |
| Hosting | GitHub Pages via `.github/workflows/deploy.yml` |

### Routing (GitHub Pages safe)

Hash routing only, so deep links never trigger Pages 404s under a subpath:

- `#/` - Landing page
- `#/mcu/<PART_NUMBER>` - Workspace, lazy-fetches `data/chips/<PART_NUMBER>.json`
- `#/s/<COMPRESSED_PAYLOAD>` - Shared pinout; decompresses state, loads chip,
  hydrates workspace

`vite.config.ts` sets `base: process.env.BASE_PATH ?? '/'`. All runtime data
fetches resolve relative to `import.meta.env.BASE_URL`, e.g.
`${import.meta.env.BASE_URL}data/index.json`. The current production subpath is
`/pincraft/`.

### Repository layout

```
PinCraft/
+-- tools/data-gen/            # STM32_open_pin_data + stm32-data-generated joiner
|   +-- index.ts               # CLI entry point, emitters, Gate 1 assertions
|   +-- helpers.ts             # Pure normalization helpers
+-- src/
|   +-- main.ts
|   +-- App.svelte             # Hash router shell (Landing <-> Workspace)
|   +-- app.css                # Tailwind v4 theme variables, light/dark
|   +-- core/                  # Pure TypeScript, zero DOM/Svelte imports
|   |   +-- types.ts
|   |   +-- solver.ts
|   |   +-- history.ts
|   |   +-- url-state.ts
|   |   +-- exporters/{embassy-rust,c-header,csv,json}.ts
|   +-- state/                 # Svelte 5 runes stores
|   |   +-- router.svelte.ts
|   |   +-- catalog.svelte.ts
|   |   +-- workspace.svelte.ts
|   |   +-- theme.svelte.ts
|   +-- pages/{LandingPage,WorkspacePage}.svelte
|   +-- components/landing/{HeroChipPreview,PresetGrid,QuickSearchBar}.svelte
|   +-- components/workspace/{TopToolbar,PeripheralTree,PackageCanvas,
|   |   PerimeterPackage,GridPackage,PinPopover,PinContextMenu,
|   |   SummaryDrawer,McuSwitcherModal,ExportModal}.svelte
|   +-- data/hero-chip.json    # Checked-in STM32G431CBU6 snapshot
+-- tests/                     # Vitest: solver, core I/O, data-gen helpers
+-- .github/workflows/deploy.yml
+-- vite.config.ts
+-- package.json
+-- README.md
```

---

## Upstream data pipeline (`tools/data-gen/`)

### Sources

| Source | License | Consumed fields |
|---|---|---|
| `STMicroelectronics/STM32_open_pin_data` | BSD-3-Clause | `mcu/*.xml` - package, physical position, pin name/type, Flash/RAM, `SYS`/`DEBUG`/`RCC` signals |
| `embassy-rs/stm32-data-generated` | MIT / Apache-2.0 | `data/chips/*.json` - normalized peripherals, AF indices, DMA/DMAMUX, cores, memory |

`npm run gen-data` shallow-clones both into `.cache/`. The generator records
short SHAs in `meta.json`, and the landing footer displays them. The cache
check is existence-only: it does not refresh an existing clone. When upstream
data must be updated, delete the relevant `.cache/` directory first, then
re-run generation.

### Join and normalization rules

- Expand parenthesized ST part variants (`STM32G431C(6-8-B)Ux` -> three IDs).
- Canonicalize trailing temperature wildcard `x` to grade `6`
  (`STM32G431CBUx` -> `STM32G431CBU6`).
- Match Embassy chips by exact package name, then 11-character stem
  (`STM32G431CB`), then fallback tuple
  `family|line|package|pin_count|smps`. Skip Cortex-A `STM32MP*` parts.
- `STM32F1`: use AFIO, force all `af` values to `null`; preserve every signal.
- Dual-bonded pins (`PA11 [PA9]`): retain the full display label and merge
  signals from both GPIO names without duplicates.
- SMPS variants: keep `-P` / SMPS packages distinct so power pins do not
  misalign.
- BGA/WLCSP: parse alphanumeric positions (`A1`..`AA12`), respect JEDEC
  omitted letters, emit ordered `rows` and `cols`.
- Perimeter sides: `[left, bottom, right, top]`. Four equal sides for
  LQFP/QFN/UFQFPN; two sides `[N/2, 0, N/2, 0]` for TSSOP/SO/DIP/SSOP;
  rectangular fallback otherwise.
- Only `SYS`/`DEBUG` and `RCC` XML signals are admitted; all other XML signal
  names and `@_IOModes` are ignored. Embassy is authoritative for AF numbers.
- Memory: use only `memory[0]`; skip `CCMRAM_ICODE` when `CCMRAM_DCODE` exists.
  Embassy values win over XML.

### Emitted artifacts

- `public/data/meta.json` - generated timestamp, both upstream SHAs, chip
  count, match rate, families.
- `public/data/index.json` - compact search index: `id`, `family`, `core`,
  `package`, `pinCount`, `flashKb`, `ramKb`, peripheral counts.
- `public/data/chips/<MCU>.json` - full `ChipData` for one part.
- `public/data/build-warnings.json` - unmatched/parse-failure records.
- `src/data/hero-chip.json` - checked-in `STM32G431CBU6` snapshot; its absence
  aborts generation.

### Gate 1 (build-blocking)

`npm run gen-data` must:

- Emit at least 1000 MCUs.
- Achieve at least 95% Embassy match rate.
- Keep total generated JSON under 150 MB.
- Pass reference assertions on `STM32F411CEU6`, `STM32G431CBU6`,
  `STM32F103C8T6` (AFIO), `STM32H743VIT6`, `STM32U575RIT6` (DMA), and
  `STM32H743XIH6` (TFBGA grid), verifying package name, pin count, power pins,
  key AF mappings, SYS signals, and DMA entries.

---

## Core engine (`src/core/`)

### Workspace state model

```ts
interface PinAssignment {
  peripheral: string; // "SPI1" or "GPIO"
  signal: string;     // "SCK" or "Output" | "Input" | "Analog" | "EXTI"
  af: number | null;
}

interface WorkspaceState {
  mcuId: string;
  assignments: Record<string, PinAssignment>; // keyed by physical position
  labels: Record<string, string>;
  locked: Record<string, boolean>;
  peripheralModes: Record<string, string>;
}
```

### Solver invariants

Evaluated live in linear time over pin count:

1. At most one active assignment per physical pin.
2. At most one physical pin per `(peripheral, signal)` pair; duplicates are
   errors.
3. Locked pins cannot be reassigned or cleared by auto-allocation.

Non-blocking warnings:

- Repurposing SWDIO/SWCLK disables SWD debugging.
- Assigning OSC_IN/OSC_OUT while HSE is enabled overlaps the clock.
- Incomplete peripheral mode lists missing required signals.
- Fixed-channel DMA contention when two enabled peripherals share a channel
  with no free alternative.

### Declarative mode templates

- `spi`: `full_duplex` (SCK, MISO, MOSI, optional NSS), `half_duplex`,
  `rx_only`.
- `i2c`: `SCL`, `SDA`, optional `SMBA`.
- `usart`/`uart`/`lpuart`: `async`, `async_hw_flow`, `sync`, `half_duplex`.
- `can`/`fdcan`: `RX`, `TX`.
- `usb`/`otg`: `device_fs` (DM, DP, optional VBUS/ID/SOF).
- `tim`: `pwm_1ch`..`pwm_4ch`, `pwm_3phase_comp`, `encoder`.
- `adc`/`dac`: individual channel toggles.
- `sys`: `swd`, `jtag`.
- `pwm`/`pio`: neutral channel-based placeholders for upcoming vendors;
  templates must remain exhaustive for `PeripheralKind`.

### Allocation and remap

- Scarcity-aware backtracking auto-allocator: rank candidate pins by how few
  other unallocated signals they host, preserving USB/SWD/HSE scarce pins.
- If a required signal is blocked by an unlocked assignment, compute a 1-hop
  remap suggestion and surface it as a one-click fix in Diagnostics.
- Alternate-pin discovery returns every pin supporting a given
  `(peripheral, signal)`, tagged free/occupied/locked.
- `Ctrl+Click` on an assigned pin enters remap mode; clicking a highlighted
  alternate moves the assignment while preserving the custom label.

### URL state and exporters

- `url-state.ts`: serialize `{ v: 1, m, a, l, k, p }`, deflate with `fflate`,
  Base64URL encode into `#/s/<payload>`. Malformed or outdated links must show
  a dismissible banner, never crash.
- `embassy-rust.ts`: `BoardPins` struct plus `from_peripherals()`, labels
  sanitized to snake_case.
- `c-header.ts`: include guard and `<NAME>_GPIO_PORT/_PIN/_AF` macros.
- `csv.ts`: `Position,Pin,Type,Peripheral,Signal,AF,Label,Locked`.
- `json.ts`: versioned, deterministically key-sorted project file with import
  parser.

---

## UI specifications

### Landing page

Dark by default (`#0b0e14` canvas, `#121722` surface, `#1f2937` hairline,
`#e5e7eb` text, `#94a3b8` muted), high-contrast light toggle persisted in
`localStorage`. Faint SVG dot-grid hero backdrop.

Semantic pin colors must be consistent across landing and workspace:

| State | Color |
|---|---|
| Unused | Slate `#475569` |
| Power / Reset / Boot | Amber `#eab308` |
| Assigned (valid) | Emerald `#10b981` |
| Partial mode | Orange `#f97316` |
| Conflict / error | Red `#ef4444` |
| Remap / search highlight | Cyan `#38bdf8` |

Typography: geometric sans for UI; `JetBrains Mono` / monospace for part
numbers, coordinates, AF indices, and code previews.

Required sections: minimal top nav with live catalog badge and theme toggle;
split hero with fuzzy quick search (Ctrl+K) and an interactive live
`STM32G431CBU6` chip preview; recent sessions and curated starter chips;
four capability cards; tabbed export preview; technical footer with live
`meta.json` provenance and upstream license credits.

### Workspace

Three-pane IDE:

- **Top toolbar (48px):** MCU switcher, global pin/signal search (Ctrl+F),
  undo/redo, clear all, fit view, rotate, share link, export modal.
- **Left pane (~280px):** categorized peripheral tree with status dots, mode
  selector, per-signal toggles with assigned pin badges.
- **Center pane:** custom pointer-event pan and cursor-centered zoom
  (0.4x-4.5x), `PerimeterPackage.svelte` and `GridPackage.svelte` SVG
  renderers, hover AF tooltips, left-click pin popover, right-click context
  menu, Ctrl+Click remap mode.
- **Right pane (~320px):** pin table, diagnostics with one-click fixes, DMA
  channel/contention view.
- **Export modal:** tabbed previews with copy and download for every format.

Keyboard shortcuts: Ctrl+K global search, Ctrl+F workspace search,
Ctrl+Click remap, Ctrl+Z/Y undo/redo, `0` fit view, Escape cancel.

---

## Multi-vendor expansion (roadmap)

Adding WCH CH32 and Raspberry Pi RP2040/RP235x. Execute only after the STM32
baseline stays green. Zero STM32 regressions is mandatory.

### Schema generalization

Extend `src/core/types.ts` backward-compatibly:

- `VendorId = 'stm32' | 'ch32' | 'rp'`
- `MuxModel = 'af' | 'remap-group' | 'funcsel-pio'`
- `PinTag` including `debug-sdi`, `hstx`, `qspi`, `bonded`, `5v-tolerant`
- `PinSignal.funcLabel`, `remapId`, `resourceId`
- `PeripheralRemapOption`
- `ChipData.vendor`, `muxModel`, `pio`, `PackageInfo.hasExposedPad`,
  `PinInfo.bondedNames/tags/note`, `PeripheralInfo.remaps`
- `WorkspaceState.activeRemaps`, `pioAssignments`
- `index.json` entries gain `vendor`; `meta.json` gains per-vendor `sources`
- Legacy state without these fields defaults to `vendor: 'stm32'`

### Data adapters

Refactor `tools/data-gen/` into orchestrator plus `adapters/stm32`,
`adapters/ch32`, `adapters/rp`, with `static/rp` and `static/ch32-packages`
verified overlays.

- **RP:** datasheet-verified QFN-56/60/80 specs for RP2040, RP2350A/B,
  RP2354A/B. Encode FUNCSEL tables with `funcLabel`, `resourceId` PWM slice
  keys (`PWM0A`..`PWM11B`), ADC/HSTX/USB/QSPI/SWD tags, PIO instances, and
  `gpioBaseOptions` (`[0]` or `[0, 16]`).
- **CH32:** shallow-clone `ch32-rs/ch32-data` into `.cache/ch32-data` and
  inspect its real schema before parsing. Group signals by remap index into
  `remaps[]`; merge peripheral signals onto physical pins by GPIO name; use
  curated overlays for priority packages (CH32V003 F4P6/F4U6/A4M6/J4M6,
  CH32V006, CH32V203, CH32V307, CH32X035, CH32L103). Multi-bonded SOP8 pins
  merge all bonded pads, populate `bondedNames`, and tag `bonded`.
  Tag PD1 with `debug-sdi`, SWD pairs with `debug-swd`, USB/PD pins with `usb`.
  Unmapped variants go to `build-warnings.json`, never to a hard failure.

### Solver extensions

- Coupled remap-group switching: atomic move of all active signals; locked
  target blocks the move; occupied target produces a clear diagnostic.
- `resourceId` collisions: two pins activating the same shared hardware
  resource (e.g. GPIO0 and GPIO16 both on PWM0A) are errors and highlight both
  pins red.
- PIO manager: contiguous block reservation and RP2350B 32-pin GPIOBASE window
  validation (GPIO0-31 or GPIO16-47); pins outside every valid window are an
  error.
- Vendor diagnostics: CH32 SWIO/SWD repurpose warning, bonded-pin mutual
  exclusion note, RP HSTX/ADC hints.

### Vendor-aware exporters and UI

- Rust exporter dispatches by vendor: `embassy-stm32`, `embassy-rp`,
  `ch32-hal`.
- C header: STM32 PORT/PIN/AF macros; RP Pico SDK `GPIO_FUNC_*`, PWM slice and
  channel macros; CH32/ch32v003fun macros plus remap summary.
- CSV columns: `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked`.
- JSON/URL schema bump to `version: 2` with full `version: 1` import
  compatibility; omit empty `activeRemaps`/`pioAssignments` from share links.
- UI: 2-sided package rendering, exposed thermal pad, bonded pin labels,
  remap dropdown, RP PIO panel, mux/hazard badges, vendor filter tabs,
  cross-vendor presets, hero vendor switcher.

### Multi-vendor gates

- **Gate 1:** `gen-data` succeeds for all three vendors; `meta.json` records
  counts and SHAs; assertions pass for RP2040 (56), RP2350A (60), RP2350B (80),
  CH32V003F4P6 (20), CH32V003J4M6 (8 bonded), CH32V203C8T6 (48),
  CH32X035G8U6 (28), STM32G431CBU6 (48).
- **Gate 2:** all unit tests pass, including CH32 atomic remap, locked/occupied
  remap blocks, bonded-pin exclusion, SWIO warning, RP PWM slice collision,
  RP2350B GPIOBASE error vs valid shifted window, vendor exporters, and
  version 1 import compatibility.
- **Gate 3:** clean SVG rendering for SOP8, TSSOP20, LQFP48, QFN-56, QFN-80 in
  both themes at multiple zooms; share URLs round-trip remaps and PIO
  assignments.
- **Gate 4:** `npm test && npm run check && BASE_PATH="/pincraft/" npm run build`
  succeed with zero warnings, no broken subpath requests, and no STM32
  regressions.

---

## Verification commands

```bash
npm ci                                   # clean install from package-lock.json
npm run gen-data                         # clone upstreams, emit static catalog
npm test                                 # Vitest unit tests
npm run check                            # tsc --noEmit (strict)
BASE_PATH="/pincraft/" npm run build     # production subpath build check
npm run dev                              # local dev on port 3000
npm run preview                          # preview dist on port 4173
```

Every phase must end with `npm test`, `npm run check`, and the production build
passing. Fix warnings before moving on. CI runs the same sequence on every push
to `main`, on manual dispatch, and weekly, then deploys `dist` to GitHub Pages.

---

## Code style and commits

- `snake_case` for functions, variables, modules; `PascalCase` for types.
- Keep upstream peripheral and signal names verbatim (`SPI1`, `SWDIO`, `SCK`).
- Every public function, type, and store should have a doc comment naming its
  upstream source or rationale where relevant.
- Prefer pure helpers in `src/core/`; keep DOM/Svelte logic in components and
  `src/state/`.
- Commit format:

  ```
  [phase] scope: short description

  References upstream: source/path/to/File.ext (when applicable)
  ```

  Examples: `fix(core): make mode templates exhaustive`,
  `chore: remove Google AI Studio scaffolding`, `feat(data): add RP adapter`.

## Do not

- Do not use emojis in any file.
- Do not introduce a backend, server routes, API keys, or GenAI/Gemini calls.
- Do not import Svelte or DOM APIs into `src/core/`.
- Do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`.
- Do not modify upstream reference data under `.cache/`.
- Do not use hash-independent routing; GitHub Pages subpaths require hash URLs.
- Do not hardcode an absolute `/` asset path; always use `import.meta.env.BASE_URL`.
- Do not let a small set of malformed upstream parts fail catalog generation;
  warn and continue.
- Do not regress STM32 behavior while adding multi-vendor support.
