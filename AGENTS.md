# AGENTS.md

## Project: PinSpec (STM32 / CH32 / RP / ESP32 / Microchip SAM / Nordic Pinout Configurator)

PinSpec is a fast, static, CubeMX-style pinout planning web application. It is a
browser-native alternative to STM32CubeMX: no backend, no install, no cloud
service. It combines an engineering-grade landing page, a three-pane pinout
workspace, and an automated build-time catalog generator.

- Repository: https://github.com/rambros3d/pinspec (public)
- Production site: https://rambros3d.github.io/pinspec/
- Source of truth for behavior: this file and `README.md`
- Upstream data is **read-only reference**; never edit files inside `.cache/`

### Current implementation status

All STM32, CH32, RP, ESP32, Microchip SAM, and Nordic pipeline phases are shipped: the
CI-native adapter generator, CH32/RP/ESP32/SAM/Nordic adapters, vendor-aware core
solver, exporters/state, workspace UI, and the `multi-vendor-ci-gates`
gate/documentation phase. The landing page, exporters, and GitHub Pages
deployment are green for all six vendors. The gate suite is the single release contract shared by local
generation and CI; its delta spec lives in `openspec/specs/multi-vendor-ci-gates/`.

Backward compatibility with legacy `version: 1` share links and project files
is explicitly NOT required for the multi-vendor expansion. STM32 behavior,
routes, and generated output must still remain stable.

---

## Agent operating contract

Agents have full architectural and implementation authority to execute work in
this repository end-to-end without pausing for confirmation, subject to the
guardrails below.

### OpenSpec workflow (mandatory)

All planning and all implementation in this repository shall use OpenSpec.
No feature work starts from an ad-hoc list.

- **Planning:** create a spec-driven change with `openspec new change <name>`,
  then produce proposal, delta spec(s), design, and tracked tasks. Validate
  every change with `openspec validate <name> --strict` before implementation.
- **Implementation:** work from the change's `tasks.md` using
  `openspec instructions apply --change <name> --json`. Mark each checkbox
  complete only after its stated verification passes.
- **Closeout by the implementation agent:** after all tasks pass and all
  verification is green, the implementation agent itself MUST run
  `openspec archive <name> -y`. This syncs the delta specs into
  `openspec/specs/` and moves the change into `openspec/changes/archive/`.
  Include those files in the implementation commit. Never leave a completed
  change unarchived for someone else to close.
- Commit and push only after archive. Report validation, test, build, and
  archive output as evidence.
- **Small edits are exempt.** Copy tweaks, removing a section, one-line fixes,
  and other self-contained changes do not need a new change. Use judgment:
  feature work and multi-file behavior changes still use OpenSpec.

### Persistence of settings and configuration

Two categories of state exist, and they have different persistence rules:

- **Pin configuration** (assignments, labels, locks, peripheral modes, remaps,
  PIO bindings, GPIO electrical settings and placement preferences that affect
  allocation) MUST be shareable. It belongs in workspace state, undo/redo
  history, `#/s/...` share URLs and version-2 project JSON, so another user
  opening a link or file gets the same pin plan.
- **UI preferences and view state** (selected peripheral, filter chips, section
  expansion, dock tab, theme, panel visibility and other presentation state)
  MUST be persisted only in `localStorage`. They do not belong in share URLs
  or exported project files.

Every new state field must declare which category it belongs to in the same
change that introduces it. Pin configuration without URL/JSON persistence is
incomplete; UI preferences placed in share URLs or project files are out of
scope for sharing.

### No handwritten MCU data

All MCU facts (packages, physical pin numbers, pin names and types, peripheral
signals, mux values, DMA channels, memory sizes, strapping and capability
metadata) MUST be generated from machine-readable upstream sources by a GitHub
Actions job. Hand-curated chip tables, static overlays, and transcribed
datasheet values are forbidden. If a family lacks suitable machine-readable
data, defer the family and record the reason in `build-warnings.json`; never
invent or manually transcribe chip data. Parser code and source declarations
are allowed; literal chip facts are not.

### Writing style

Use professional, clear wording in UI copy, documentation, commit messages,
and code comments. Avoid marketing and promotional language, slogans, hype
adjectives, and claims that cannot be verified from the code or generated
data. Describe what the software does and how it behaves, not why it is
supposed to be desirable.

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
4. Preserve STM32 behavior and generated output stability. Backward
   compatibility with older share-link or project-file versions is not
   required for the multi-vendor expansion.

### Autonomous blocker resolution

- If a third-party UI primitive (`bits-ui`, `paneforge`, `@tanstack/svelte-table`,
  etc.) conflicts with Svelte 5 or Tailwind CSS v4 peer dependencies, replace it
  immediately with a small custom Svelte 5 runes component. Do not stall on
  dependency resolution.
- If a subset of upstream MCU XML files fails schema matching (dual-die, SiP,
  undocumented SMPS variants), record each case in `public/data/build-warnings.json`,
  log the match ratio, and continue. Do not fail the whole catalog for a small
  subset of parts.
- If a dependency conflict blocks `npm ci`, resolve it in the lockfile rather
  than editing application code. No npm peer-dependency override is currently
  required; do not add one without a documented conflict.
- Keep generated output well within the GitHub Pages 1 GB limit. Target under
  150 MB uncompressed across all per-chip JSON shards by omitting unused
  register and memory-map fields.

### Hard engineering constraints

- **Zero emojis.** Do not use emojis anywhere: UI copy, tooltips, buttons,
  logs, code comments, commit messages, or documentation. Use the Solar Svelte
  icon package or inline SVG instead.
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
| UI primitives | Small custom Svelte 5 runes components; `@solar-icons/svelte` icons |
| Search & compression | Token-ranking fuzzy search + `fflate` deflate/Base64URL |
| Testing | Vitest (unit), `tsc --noEmit`, Vite production build |
| Data pipeline | TypeScript CLI via `tsx` |
| Hosting | GitHub Pages via `.github/workflows/deploy.yml` |

### Routing (GitHub Pages safe)

Hash routing only, so deep links never trigger Pages 404s under a subpath:

- `#/` - Landing page
- `#/catalog` - Full-screen catalog browser with query, vendor, family, and package filters
- `#/projects` - Recent sessions with open, delete, import, and project export actions
- `#/about` - Catalog statistics and the grouped upstream provenance table
- `#/mcu/<PART_NUMBER>` - Workspace, lazy-fetches `data/chips/<PART_NUMBER>.json`
- `#/s/<COMPRESSED_PAYLOAD>` - Shared pinout; decompresses state, loads chip,
  hydrates workspace

One global shell wraps every route. A thin h-8 (32 px) navigation bar is mounted
on every route: Home, Projects, and Catalog on the left; a centered app icon and
`PinSpec` name on non-workspace routes; Workspace, an About info icon, a GitHub
link, keyboard shortcuts, and the compact theme picker on the right. The
workspace action bar carries the app icon on workspace and shared routes.
Labels collapse to icons below the `sm` breakpoint and every target stays
operable without horizontal scrolling. No route-title text is rendered. The
right-side Workspace control appears only on non-workspace routes, opens the
loaded chip or the most recent local session, and is disabled when neither
exists. The landing route shows compact recent-session rows; the Projects route
is the full session manager. On workspace and shared routes a second h-12 (48 px)
action bar below the navigation bar is
mounted. That bar owns the inline project-name
editor, MCU switcher, undo, redo, Clear All, Compatible MCUs, Compare, Share,
Export, and the horizontal scroll affordance; other routes render no second bar.
The Clear All confirmation anchors below both bars. The shortcuts control opens
the shared dialog over the current route, and the keyboard reference is not
repeated on About. Dialog flags and the search-focus callback are transient view
state in `src/state/top-bar-ui.svelte.ts`. Discovery filters and theme are UI
preferences persisted only in `localStorage`. Neither category enters share URLs
or project files. About owns a single static provenance table and has no tab
preference.

`vite.config.ts` sets `base: process.env.BASE_PATH ?? '/'`. All runtime data
fetches resolve relative to `import.meta.env.BASE_URL`, e.g.
`${import.meta.env.BASE_URL}data/index.json`. The current production subpath is
`/pinspec/`.

### Repository layout

```
PinSpec/
+-- tools/data-gen/            # STM32 + CH32 + RP + ESP32 + SAM adapter orchestrator
|   +-- index.ts               # CLI entry point, emitters, gate invocation
|   +-- gates.ts               # Pure per-vendor and global gate helpers
|   +-- artifacts.ts           # In-memory shard preparation and artifact writers
|   +-- adapters/{stm32,ch32,rp,esp32,sam,nordic}  # Six vendor source parsers and assertions
|   +-- sources.ts             # Source declarations and license constants
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
|   +-- state/                 # Nine Svelte 5 runes stores plus the dialog-focus helper
|   |   +-- {router,catalog,workspace,theme,workspace-preferences,
|   |   |   discovery-preferences,placement-selection,top-bar-ui,
|   |   |   persisted-preference}.svelte.ts
|   +-- pages/{LandingPage,CatalogPage,ProjectsPage,AboutPage,WorkspacePage}.svelte
|   +-- components/shell/{AppShell,GlobalNavBar,WorkspaceTopBar,Dialog}.svelte
|   +-- components/landing/{RecentSessions,QuickSearchBar}.svelte
|   +-- components/catalog/PackageThumbnail.svelte
|   +-- components/about/ProvenancePanel.svelte
|   +-- components/workspace/    # Roughly 25 pin-planning and dialog components
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
| `ch32-riscv-ug/ch32-device-data` | MIT | manifest-verified `index/` CSV - part list, packages, pins, remaps |
| KiCad symbols and footprints | CC-BY-SA-4.0 (generated-file exception) | RP package symbols and QFN EP geometry |
| `raspberrypi/picotool` and `raspberrypi/pico-sdk` | BSD-3-Clause | RP FUNCSEL tables and GPIO function macros |
| `zephyrproject-rtos/zephyr` | Apache-2.0 | RP SRAM, GPIO counts, and variant device trees |
| `raspberrypi/documentation` | CC-BY-SA-4.0 | RP flash/package variant tables |
| `espressif/esp-gpio-tool` | Apache-2.0 | ESP32 GPIO capabilities, strapping, at-reset pull, MPN reserved pins, SRAM, ADC2 Wi-Fi conflict |
| `esp-rs/esp-hal` `esp-metadata` | MIT / Apache-2.0 | ESP32 IO_MUX functions, matrix signal ids, limitations, DMA, SoC facts |
| `espressif/kicad-libraries` | CC-BY-SA-4.0 (generated-file exception) | ESP32 symbol pins, footprint pad numbers, exposed-pad geometry |
| `espressif/esp-idf` | Apache-2.0 | Pinned `gpio_sig_map.h`, `soc_caps.h`, and `io_mux_reg.h` matrix evidence |
| `Microchip-MPLAB-Harmony/dev_packs` ATDF | Apache-2.0 | Curated raw ATDF files - variants, pinouts, module signals, memories, interrupts |
| `nrf-rs/nrf-pacs` | 0BSD | Nordic SVD - peripherals, interrupts, CPU, address blocks |
| KiCad `MCU_Nordic` symbols | CC-BY-SA-4.0 (generated-file exception) | Nordic physical pin numbers, ball IDs, multi-function names |
| `zephyrproject-rtos/zephyr` Nordic DTS and pinctrl | Apache-2.0 | Nordic GPIO counts, flash/SRAM, PSEL function names |

GitHub Actions restores `.cache/` through `actions/cache` keyed on source
declarations and `package-lock.json`; scheduled weekly runs delete it first so
revisions advance. Nordic SVD evidence is fetched as three raw files from a
pinned `nrf-pacs` ref instead of a full clone, and both RP and Nordic Zephyr
files are declared under one `zephyr` source and cache directory.

`npm run gen-data` (or `npm run acquire-sources` on its own) shallow-clones the
git sources and fetches the raw reference files into the gitignored `.cache/`.
The generator records a short SHA (or SHA-256 for raw files), license, and URL
for each of the thirteen canonical sources in `meta.json`, and the About
provenance table displays them. SAM ATDF files are fetched individually from a pinned ref; no
full 320 MB pack clone is performed. The local cache check is existence-only: it does not refresh an
existing checkout. The weekly CI schedule deletes `.cache/` before acquisition
so SHAs advance; to update locally, delete the relevant `.cache/` entry first.

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

- `public/data/meta.json` - generated timestamp, per-vendor counts and
  match/coverage ratios, and the thirteen canonical source records (`sha`, `url`,
  `license`) under `sources`.
- `public/data/index.json` - compact search index with `vendor`, `id`, `family`,
  `core`, `package`, `pinCount`, `flashKb`, `ramKb`, and exact `geometry`
  (`kind`, `sides`, `rows`, `cols`, `hasExposedPad`) copied from each generated
  package. Peripheral counts and upstream `series` are not emitted.
- `public/data/chips/<MCU>.json` - full `ChipData` for one part.
- `public/data/build-warnings.json` - always present; `{ id, vendor, source,
  reason }[]` plus aggregate counts for every deferred/unmapped part.
- No checked-in chip snapshot exists. Shards are fetched lazily from generated
  data under `public/data/chips/`.

### Release gates (`multi-vendor-ci-gates`, build-blocking)

`npm run gen-data` runs per-vendor gates followed by four global gates
(`artifact-budget`, `shard-integrity`, `provenance`, `warnings-contract`) before
writing anything, so a failure exits non-zero with no partial catalog. It must:

- Emit at least 1000 STM32 MCUs with at least a 95% Embassy match rate.
- Keep total generated JSON under 150 MB and make every index entry resolve to
  a consistent, parseable shard with no `NaN`/`undefined` values.
- Pass STM32 reference assertions on `STM32F411CEU6`, `STM32G431CBU6`,
  `STM32F103C8T6` (AFIO), `STM32H743VIT6`, `STM32U575RIT6` (DMA), and
  `STM32H743XIH6` (TFBGA grid), verifying package name, pin count, power pins,
  key AF mappings, SYS signals, and DMA entries.
- Emit all 105 CH32 parts and assert the four priority packages, their grouped
  `remaps[]`, bonded names/tags, and the PD1 `debug-sdi` tag.
- Assert RP2040/RP2350A/RP2350B pin and GPIO counts, QFN exposed pads, the
  `PWM0A`..`PWM11B` slice range, and HSTX/ADC/QSPI/SWD/PIO tags.
- Emit exactly 39 SAM D21/D51/E51/SAMV71 parts from curated ATDF files and
  assert `ATSAMD21G18A` (48 pins), `ATSAMD51P20A` (TQFP128 and TFBGA120
  pinouts), `ATSAME51J20A` (64 pins), `ATSAMV71Q21B` (144 pins), function-letter
  AF indices, and the `microchip-atdf` SHA. Missing DMA channel maps and other
  gaps are attributed warnings, never invented values.
- Record all thirteen source SHAs and per-vendor counts/ratios in `meta.json`, and
  attribute every deferred part in `build-warnings.json` without failing.

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
- `pwm`/`pio`: neutral channel-based templates used by CH32 and RP;
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

- `url-state.ts`: serialize `{ v: 2, m, a, l, k, p }` (the schema has no v1
  import path), deflate with `fflate`, Base64URL encode into `#/s/<payload>`.
  Malformed or outdated links must show a dismissible banner, never crash.
- `embassy-rust.ts`: dispatch to `embassy-stm32`, `embassy-rp`, `ch32-hal`, or `esp-hal`
  crate names by vendor; `BoardPins` struct plus `from_peripherals()`, labels
  sanitized to snake_case.
- `c-header.ts`: STM32 PORT/PIN/AF macros, RP Pico SDK `GPIO_FUNC_*` and PWM
  slice macros, or CH32/ch32v003fun macros with a remap summary.
- `csv.ts`: `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked,Level,Drive,Pull,Speed`.
- `json.ts`: version-2, deterministically key-sorted project file with import
  parser; empty `activeRemaps`/`pioAssignments` are omitted from share links.

---

## UI specifications

### Start screen

The start screen is a hero-led, two-column surface using daisyUI semantic tokens,
with the theme mode persisted in `localStorage`. It has no chip preview, package
outline, export preview, or technical footer.

- Hero: a full-width band inside `.landing-shell` and `max-w-7xl` with the
  `Plan a pinout` headline, one factual sentence, a `New pinout` action that
  opens the catalog, and the catalog quick search with vendor, family, and
  package filters. Generated catalog facts (indexed part count, vendor count,
  and sync date) and the retry control appear in the hero only.
- Body: two columns at `lg`. "Other ways to start" holds board presets, `.ioc`
  import, version-2 JSON import, and the two-file compare dialog; it is the only
  surface that accepts `.ioc` files, and the compare dialog accepts JSON only.
  "Recent sessions" renders compact rows with part, package, assigned/pins,
  relative time, Reopen, and Delete through `RecentSessions.svelte`. The
  Projects route remains the full session manager. Below `lg` the body stacks
  in one reading order without horizontal overflow.

Pin-state colors live in the vendored daisyUI theme file and package renderers;
no raw color literal is added to UI markup. Monospace styling is reserved for
part numbers, package names, counts, dates, coordinates, AF indices, shortcut
keys, and code previews. Provenance and license credits are owned by the About
route and repository documentation.

### Workspace

Three-pane IDE:

- **Global navigation bar (32px):** Home, Projects, and Catalog on the left;
  a centered app icon and name on non-workspace routes; Workspace, About,
  GitHub, keyboard shortcuts, and the compact theme picker on the right.
  GitHub and shortcuts are icon-only; labels collapse to icons below `sm`.
  No route title is rendered.
- **Workspace action bar (48px):** mounted only on workspace and shared routes.
  It hosts the inline project name, MCU switcher, undo/redo, Clear All,
  Compatible MCUs, Compare, Share, and Export, with a horizontal scroll
  affordance. Pin and signal search (Ctrl+F), rotate, fit, and placement live on
  the canvas.
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

## Multi-vendor architecture (shipped)

WCH CH32, Raspberry Pi RP2040/RP235x, ESP32, Microchip SAM, and Nordic support is
implemented alongside STM32. Zero STM32 regressions remains mandatory.

### Schema generalization

`src/core/types.ts` carries the generalized schema:

- `VendorId = 'stm32' | 'ch32' | 'rp' | 'esp32' | 'microchip' | 'nordic'`
- `MuxModel = 'af' | 'remap-group' | 'funcsel-pio' | 'gpio-matrix' | 'psel'`
- `PinTag` including `debug-sdi`, `hstx`, `qspi`, `bonded`, `5v-tolerant`
- `PinSignal.funcLabel`, `remapId`, `resourceId`
- `PeripheralRemapOption`
- `ChipData.vendor`, `muxModel`, `pio`, `PackageInfo.hasExposedPad`,
  `PinInfo.bondedNames/tags/note`, `PeripheralInfo.remaps`
- `PinTag` includes `nfc` for symbol-declared Nordic NFC pads
- `WorkspaceState.activeRemaps`, `pioAssignments`
- `index.json` entries carry `vendor`; `meta.json` carries per-vendor `sources`
  and the thirteen canonical source records
- `ChipData.variants`, `pinouts`, and `capabilityEvidence` retain ATDF ordercode
  and capability metadata without adding shards
- Every index entry declares an explicit vendor; only shard-side core helpers normalize an absent chip vendor to STM32

### Data adapters

The orchestrator in `tools/data-gen/index.ts` registers `adapters/stm32`,
`adapters/ch32`, `adapters/rp`, `adapters/esp32`, `adapters/sam`, and `adapters/nordic`, collects
vendor-attributed warnings, runs all gates, and writes artifacts once.

- **RP:** datasheet-verified QFN-56/60/80 specs for RP2040, RP2350A/B,
  RP2354A/B from KiCad, pico-sdk/picotool, Zephyr, and Raspberry Pi docs.
  FUNCSEL signals carry `funcLabel`, `resourceId` PWM slice keys
  (`PWM0A`..`PWM11B`), ADC/HSTX/USB/QSPI/SWD tags, PIO instances, and
  `gpioBaseOptions` (`[0]` or `[0, 16]`).
- **CH32:** `ch32-riscv-ug/ch32-device-data` is shallow-cloned to
  `.cache/ch32-device-data`; only manifest-verified `index/` CSV is consumed.
  Signals are grouped by remap index into `remaps[]` and merged onto physical
  pins by GPIO name. Multi-bonded SOP8 pins merge all bonded pads, populate
  `bondedNames`, and tag `bonded`. PD1 carries `debug-sdi`, SWD pairs
  `debug-swd`, and USB/PD pins `usb`. Unmapped variants are deferred to
  `build-warnings.json`, never to a hard failure.
- **ESP32:** `tools/data-gen/adapters/esp32/` joins first-party `esp-gpio-tool`
  YAML with `esp-hal` `esp-metadata` TOML by GPIO number, maps joined records
  to `espressif/kicad-libraries` pad numbers, and cross-checks matrix counts
  against pinned ESP-IDF headers. Bare dies carry `flashKb: null`; named
  modules and MPNs carry first-party flash evidence. Unavailable records are
  deferred with vendor attribution.
- **SAM:** `tools/data-gen/adapters/sam/` reads 39 curated ATDF files fetched as
  raw files from a pinned `dev_packs` ref with SHA-256 provenance. Variants,
  pinouts, instance signals, and memory segments are normalized; single-letter
  functions map to AF indices and non-letter functions keep their labels with
  `af: null`. DMA channel maps and unreadable facts are attributed warnings.
- **Nordic:** `tools/data-gen/adapters/nordic/` joins nrf-pacs CMSIS-SVD, Zephyr Nordic device-tree/pinctrl, and KiCad Nordic symbols into PSEL shards. Physical pins come from symbol numbers and multi-function names, routing labels from Zephyr pinctrl functions with `af: null`, and electrical tags only from acquired declarations. Pilots without a complete machine-readable pin set are deferred with vendor attribution.

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
  `ch32-hal`, `esp-hal`. ESP32 exports use `GPIO<n>` pad identifiers and
  matrix-route comments.
- C header: STM32 PORT/PIN/AF macros; RP Pico SDK `GPIO_FUNC_*`, PWM slice and
  channel macros; CH32/ch32v003fun macros plus remap summary; ESP32 `GPIO<n>`
  macros with matrix function comments and no `_AF` macro.
- CSV columns: `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked`.
- JSON/URL schema uses `version: 2`; there is no v1 import path, and empty
  `activeRemaps`/`pioAssignments` are omitted from share links.
- ESP32 module shards such as `ESP32-C3FH4` and `ESP32-WROOM-E` are emitted from
  first-party data and remain reachable through catalog search. Board presets
  and `.ioc` import remain STM32-only.
- UI: 2-sided package rendering, exposed thermal pad, bonded pin labels,
  remap dropdown, RP PIO panel, mux/hazard badges, and vendor filter tabs.

### Multi-vendor gates

- **Gate 1:** `gen-data` succeeds for all six vendors; `meta.json` records
  counts and SHAs; assertions pass for RP2040 (56), RP2350A (60), RP2350B (80),
  CH32V003F4P6 (20), CH32V003J4M6 (8 bonded), CH32V203C8T6 (48),
  CH32X035G8U6 (28), STM32G431CBU6 (48).
- **Gate 1 (ESP32):** all twelve families emit shards; ESP32-C3 QFN32 has 32
  pads and an exposed pad with GPIO2 strapping at pad 6; ESP32-C3FH4 reserves
  GPIO12-17 for flash; ESP32-WROOM-E has GPIO0/BOOT at pad 25 and EN at pad 3;
  ESP32 GPIO34-39 are input-only; matrix counts match the pinned
  `gpio_sig_map.h`.
- **Gate 1 (SAM):** exactly 39 parts; `ATSAMD21G18A` (48), `ATSAMD51P20A`
   (TQFP128/TFBGA120), `ATSAME51J20A` (64), `ATSAMV71Q21B` (144); function-letter
   AF indices and the `microchip-atdf` SHA.
- **Gate 1 (Nordic):** `nRF52840-QIAA` pins agree with the acquired KiCad symbol,
   SVD/device-tree peripherals are represented, at least one PSEL `funcLabel`
   has a null AF, and all three Nordic source SHAs are recorded. Parts without
   complete physical-pin evidence are deferred, not invented.
- **Gate 2:** all unit tests pass, including CH32 atomic remap, locked/occupied
  remap blocks, bonded-pin exclusion, SWIO warning, RP PWM slice collision,
  RP2350B GPIOBASE error vs valid shifted window, vendor exporters, gate
  helpers, provenance schemas, and warning contracts.
- **Gate 3:** clean SVG rendering for SOP8, TSSOP20, LQFP48, QFN-56, QFN-80 in
  both themes at multiple zooms; share URLs round-trip remaps and PIO
  assignments.
- **Gate 4:** `npm test && npm run check && BASE_PATH="/pinspec/" npm run build`
  succeed with zero warnings, no broken subpath requests, and no STM32
  regressions. CI additionally forces a weekly source refresh and smoke-tests
  `index.html`, `data/index.json`, and a sample chip shard under `/pinspec/`.

---

## Verification commands

```bash
npm ci                                   # clean install from package-lock.json
npm run acquire-sources                  # fetch all thirteen upstream sources
npm run gen-data                         # emit shards and run all release gates
npm test                                 # Vitest unit tests
npm run check                            # tsc --noEmit (strict)
BASE_PATH="/pinspec/" npm run build      # production subpath build check
npm run dev                              # local dev on port 3000
npm run preview                          # preview dist on port 4173
```

Every phase must end with `npm test`, `npm run check`, and the production build
passing. Fix warnings before moving on. CI runs the same sequence on every push
to `main`, on manual dispatch, and weekly (with a forced `.cache/` refresh),
then smoke-tests the built site under `/pinspec/` and deploys `dist` to GitHub
Pages. Runtime fetches must use `import.meta.env.BASE_URL` through the pure
`dataUrl()` helper in `src/core/data-url.ts`; no root-absolute `/data/` or
`/assets/` URL is permitted.

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

- Do not bypass OpenSpec for feature work or multi-file behavior changes;
  the implementation agent must archive its own change after verification.
  Small self-contained edits are exempt.
- Do not use marketing or promotional language in UI copy, documentation,
  or commit messages.
- Do not put UI preferences or view state in share URLs or project files; use
  localStorage for those. Only pin configuration is shareable.
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
