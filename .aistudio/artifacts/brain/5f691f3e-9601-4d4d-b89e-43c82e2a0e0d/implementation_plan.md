# PinCraft Multi-Vendor Expansion — Adding WCH CH32 & Raspberry Pi RP2040 / RP235x

Extend PinCraft from an STM32-only pinout configurator into a unified multi-vendor hardware planning workspace supporting **STMicroelectronics STM32**, **WCH CH32 RISC-V**, and **Raspberry Pi RP2040 / RP235x**. All three microcontroller ecosystems share a single normalized static catalog, pure TypeScript constraint solver, parametric SVG package renderer, compressed URL sharing protocol, and automated static deployment pipeline with strict zero regressions on STM32.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All three architectural scope choices from Phase 1 are locked in below. Review the multi-vendor solver rules, package rendering upgrades, and catalog strategy before approving execution.

- **Confirmed Decision 1 — WCH CH32 Catalog Coverage**: Ship datasheet-verified physical package overlays for all 18 priority CH32 parts across six families (`CH32V003`, `CH32V006`, `CH32V203`, `CH32V307`, `CH32X035`, `CH32L103`) **plus every additional part from `ch32-rs/ch32-data` that provides physical package pin mapping**. Unmapped upstream variants are logged into the build warnings report rather than failing catalog generation.
- **Confirmed Decision 2 — STM32F1 Preservation**: Keep **STM32F1 unchanged** on its existing AFIO solver and pin-selection behavior to guarantee 100% backward compatibility for STM32 tests, saved sessions, and share links. Apply the new coupled `remap-group` architecture specifically to WCH CH32 parts.
- **Confirmed Decision 3 — Raspberry Pi PIO Manager Scope**: Implement full interactive PIO planning for `RP2040`, `RP2350A`, `RP2354A`, `RP2350B`, and `RP2354B` covering **individual pin bindings, contiguous N-pin block reservations, optional state machine (`SM0`–`SM3`) and role labeling, and real-time 32-pin `GPIOBASE` (`0–31` vs `16–47`) window validation**.

> [!NOTE]
> **Toolchain Alignment**: The workspace uses npm/tsx scripts (`npm run gen-data`, `npm test`, `npm run check`, `npm run build`). All verification gates and GitHub Actions deployment steps will run natively on the repository's existing npm/Vite 8/Svelte 5 toolchain while preserving `BASE_PATH`-aware subpath hosting and keeping the static production bundle well within GitHub Pages limits.

---

## 1. Overview & Core Concept

- **What It Does**: Engineers can search, filter, and switch effortlessly between STM32, WCH CH32, and Raspberry Pi RP microcontrollers in one browser tab. Each vendor's genuine silicon pin-muxing rules are modeled accurately: per-pin alternate functions (`AF0`–`AF15`) for STM32, coupled peripheral AFIO remap slots (`RM0`–`RM3`) and multi-bonded SOP8 pads for WCH CH32, and per-pin `FUNCSEL` (`F0`–`F11`), wrap-around PWM slice collision detection, and flexible PIO allocation for RP2040 and RP235x.
- **Target Audience / Persona**: Embedded firmware engineers, Rust/Embassy and C/SDK developers, and PCB designers working across mixed-vendor microcontroller boards who need instant pinout verification, hardware hazard warnings, and idiomatic code/CAD exports without switching tools.
- **Key Value**: Unifies three distinct hardware pin-mux paradigms under one fast, deterministic, zero-backend browser instrument—eliminating datasheet cross-referencing errors such as RP2040/RP2350B PWM slice wrap-around collisions, RP2350B PIO 32-pin window violations, CH32 `PD1` 1-wire `SWIO` lockouts, and CH32 partial-remap mismatches.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Multi-Vendor Discovery & Interactive Hero (Landing Page `#/`)**:
   - The split engineering hero broadens its positioning to STM32, WCH CH32, and RP2040 / RP235x while retaining the crisp hardware-EDA tone.
   - **Vendor Filter Tabs**: Both the landing fuzzy search bar (`Ctrl+K`) and the workspace MCU Switcher modal gain an interactive segmented vendor selector (`All`, `STM32`, `WCH CH32`, `Raspberry Pi`) showing live per-vendor indexed counts from catalog metadata alongside contextual family/package filters (`LQFP`, `QFN`, `TSSOP`, `SOP`, `BGA`).
   - **Interactive Hero Ecosystem Switcher**: A compact segmented switcher (`STM32G431` | `CH32V203` | `RP2350B`) sits directly above the live hero chip stage so visitors can click pins, toggle peripherals, test CH32 remaps or RP PWM/PIO assignments, and hand off any of the three chips directly into the full workspace.
   - **Cross-Vendor Starter Presets**: Curated grid covering all renderers and mux models—`RP2350B` (QFN-80 + EP), `RP2040` (QFN-56 + EP), `CH32V203C8T6` (LQFP48), `CH32V003F4P6` (TSSOP20), `CH32X035G8U6` (QFN28), `STM32G431CBU6` (UFQFPN48), `STM32H743VIT6` (LQFP100), and `STM32H743XIH6` (TFBGA240).
   - **Live Export Preview Strip**: Expands to five interactive tabs (`Embassy STM32` | `Embassy RP` | `ch32-hal` | `C Header` | `CSV`) synchronized live with the active hero chip (automatically matching the ecosystem tab or displaying the corresponding vendor output).

2. **WCH CH32 Remap & Bonded-Pin Planning (Workspace `#/mcu/CH32...`)**:
   - **2-Sided & Compact Packages**: `SOP8`, `SOP16`, `TSSOP20`, and `SSOP20` render with proportioned rectangular IC bodies, zero empty top/bottom lead spacing, and a clear Pin 1 top-left notch/dot. Multi-bonded pads (such as `CH32V003J4M6` SOP8) display compact notation (`PC1/2/4`) on the lead while expanding the full bonded pad breakdown in tooltips and the pin popover.
   - **Coupled Remap Selector**: Inside the Left Peripheral Tree accordion, any peripheral offering multiple AFIO remap groups displays a `Remap` dropdown listing each option and its pin summary (for example, `RM0: PA9, PA10` vs `RM1: PB6, PB7`). Switching the remap moves all active peripheral signals atomically while preserving user net labels, blocks moves onto locked pins with a clear diagnostic, and flags unlocked collisions cleanly.
   - **Canvas Coupling & `Ctrl+Click`**: Selecting a signal directly from the Pin Popover automatically adopts a compatible `remapId` or flags a remap-mismatch error if sibling signals belong to a different remap group. Holding `Ctrl+Click` on an assigned CH32 peripheral pin highlights alternate remap targets and shows a canvas status hint that clicking shifts the full peripheral remap group atomically.
   - **Debug & Bonded Guardrails**: Assigning a non-debug signal to `PD1` (`debug-sdi` on CH32V00x) or `PA13`/`PA14`/`PC18`/`PC19` (`debug-swd`) triggers a clear non-blocking warning. Assigning one internal pad on a bonded physical pin enforces mutual exclusion and adds an informational note listing unused bonded pads to keep floating in firmware.

3. **Raspberry Pi RP2040 / RP235x Planning & PIO Allocation (Workspace `#/mcu/RP...`)**:
   - **QFN Thermal Exposed Pad**: `QFN-56`, `QFN-60`, and `QFN-80` render a subtle hatched center thermal pad (`EP / GND`) behind the part marking with preserved text contrast in both dark and light themes.
   - **FUNCSEL & PWM Wrap-Around Protection**: Hover tooltips and the Pin Popover display `F0`–`F11` mux indices alongside unboxed hardware capability indicators (`ADC`, `HSTX`, `USB`, `SWD`, `QSPI`). Assigning two pins that share a hardware PWM slice channel (such as `GPIO0` and `GPIO16` both on `PWM0A` on RP2040, or `GPIO4` and `GPIO28` on `PWM2A` on RP2350B) immediately highlights both pads red and links them in Diagnostics.
   - **Interactive PIO Manager**: A dedicated `PIO` section in the Left Peripheral Tree lets users assign individual GPIOs or reserve contiguous N-pin blocks (`start GPIO` + `count`) to `PIO0`, `PIO1`, or `PIO2` (on RP235x) with optional state machine (`SM0`–`SM3`) and role prefix. On `RP2350B` and `RP2354B`, the panel displays the computed `GPIOBASE` window (`GPIO0–31` or `GPIO16–47`) and raises an error diagnostic whenever a single PIO instance spans beyond any valid 32-pin window (such as `GPIO2` and `GPIO36` on `PIO0`).

4. **Vendor-Aware Export & Backward-Compatible Sharing**:
   - Export previews automatically adapt to the active chip's vendor: `embassy-stm32` (unchanged), `embassy-rp` (with `embassy_rp::init`, typed `p.PIN_x` bindings, peripheral groupings, and a `bind_interrupts!` skeleton), or `ch32-hal` (with `ch32_hal::init`, `p.Pxx` bindings, active AFIO remap comments, and debug-pin warnings).
   - C headers adapt to STM32 `PORT/PIN/AF` macros (unchanged), Pico SDK `PIN` / `GPIO_FUNC_*` / `PWM_SLICE` / `PWM_CHAN` macros, or WCH SDK / `ch32v003fun` macros with `AFIO_PCFR1` remap summaries.
   - CSV adds `Vendor`, unified `Mux` (`AF7` / `F1` / `RM1`), and `Resource` (`PWM0A`, etc.) columns.
   - JSON projects bump to `version: 2` (recording `vendor`, `activeRemaps`, and `pioAssignments`) while continuing to import legacy `version: 1` STM32 files seamlessly; URL share links (`#/s/...`) omit remap and PIO fields when empty so STM32 links stay identical and compact.

### Visual Identity & Theme

- **Aesthetic Direction**: Calibrated hardware-EDA console—flat single-elevation surfaces separated by crisp 1px hairline borders, high scannable density, disciplined whitespace, strictly zero emojis anywhere (monochrome `lucide-svelte` and custom SVG marks only), and zero decorative clutter.
- **Color Palette & Dual-Theme Parity** (60-30-10 discipline, dark default with high-contrast light mode via Tailwind v4 `@custom-variant dark`):
  - *Dark*: Canvas `#0b0e14`, Structural Surface `#121722`, Elevated Control `#171d2b`, Hairline Border `#1f2937`, Primary Text `#e5e7eb`, Muted Text `#94a3b8`.
  - *Light*: Canvas `#f8fafc`, Structural Surface `#ffffff`, Elevated Control `#f1f5f9`, Hairline Border `#e2e8f0`, Primary Text `#0f172a`, Muted Text `#475569`.
  - *Semantic States* (always paired with explicit text labels or monochrome glyphs, never hue-only): Unused Slate `#475569`, Power/Reset/Boot Amber `#eab308`, Assigned Emerald `#10b981`, Partial/Warning Orange `#f97316`, Conflict/Error Red `#ef4444`, Interactive/Remap/PIO Accent Cyan `#38bdf8`.
- **Typography & Hierarchy**: Retain `Plus Jakarta Sans` (400 / 600 / 700, `text-wrap: balance` on display headlines) paired with `JetBrains Mono` (`font-variant-numeric: tabular-nums`) across pin tables, mux labels (`AF7`, `F1`, `RM1`), flash/RAM readouts, and code exports.
- **Metadata & Control Styling**:
  - Follow strict zero-pill discipline on cards, headers, and catalog rows—render chip counts, vendor labels, memory specs, and pin capability metadata as clean unboxed typographic text separated by `·` or `/` (with crisp compact bordered key-tags strictly inside dense pin inspection dialogs/tooltips where hazard tokens like `SWIO`, `SWD`, `HSTX`, `ADC`, `USB`, and `BONDED` act as schematic annotations).
  - Style vendor filters (`All`, `STM32`, `WCH CH32`, `Raspberry Pi`), hero switcher tabs, and export format selectors as single-line (`whitespace-nowrap shrink-0`) segmented `<button>` groups.
  - Keep the Landing Top Bar locked to its clean 3-zone single-row contract and the Workspace Top Toolbar locked at `48px`.
- **Interactive Feedback & Motion**: Compositor-only transitions (`transform`, `opacity`, `<= 150ms`) honoring `prefers-reduced-motion`, skeleton placeholders during lazy chip JSON loading, inline diagnostics with one-click pin focus, and non-blocking confirmation toasts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Modular Build-Time Vendor Adapters Over Monolithic Script**
  - *Chosen Approach*: Split the catalog build pipeline into three isolated vendor adapters (`STM32`, `Raspberry Pi`, `WCH CH32`) orchestrated by one unified generator emitting shared `meta.json`, `index.json`, and per-chip JSON shards.
  - *Why*: Isolates upstream schema differences (ST XML + Embassy JSON vs `ch32-rs/ch32-data` YAML/JSON + physical overlays vs hand-verified RP QFN specs) so a schema change in one upstream repo never corrupts another vendor's build.
  - *Alternatives Considered*: Appending CH32 and RP parsing inline inside the existing STM32 generator script (unmaintainable and fragile).

- **Decision 2 — Hybrid CH32 Package Strategy (Priority Overlays + Upstream Mapped Parts)**
  - *Chosen Approach*: Author datasheet-verified physical pinout overlays for the 18 priority CH32 parts (including `CH32V003J4M6` multi-bonded SOP8, 2-sided TSSOP20/SOP16, QFN20/28/32/48/68, and LQFP32/48/64/100) while dynamically emitting any other `ch32-rs/ch32-data` part that exposes physical package pin mappings, logging unmapped variants to `build-warnings.json`.
  - *Why*: Guarantees 100% electrical accuracy (VDD, VSS, NRST, VCAP, bonded pads, debug tags) on flagship CH32 MCUs while still indexing the broader `ch32-rs` ecosystem automatically as upstream expands.
  - *Alternatives Considered*: Restricting to only 18 hardcoded chips (narrower catalog) or guessing synthetic pin orders for unmapped chips (risks misleading PCB designers).

- **Decision 3 — Unified Resource-Conflict Key (`resourceId`) & Pure Solver Engine**
  - *Chosen Approach*: Represent shared hardware resources (like RP PWM slices `PWM0A`–`PWM11B`) via an optional `resourceId` on normalized pin signals and keep remap-group switching, PIO block reservation, and `GPIOBASE` validation inside the zero-DOM pure TypeScript solver.
  - *Why*: One generic collision detector automatically catches RP2040 16-pin PWM wrap-arounds, RP2350B 24-pin PWM wrap-arounds, and future shared-resource constraints while keeping 100% deterministic Vitest coverage.
  - *Alternatives Considered*: Hardcoding vendor-specific conflict checks inside Svelte UI components (fragile and untestable).

- **Decision 4 — Backward-Compatible State Hydration (`v1` & `v2`)**
  - *Chosen Approach*: Default missing `vendor` to `"stm32"` and optional `activeRemaps`/`pioAssignments` to `{}` whenever hydrating legacy `localStorage` entries, `version: 1` JSON files, or existing `#/s/...` share links; omit new fields from serialized URL payloads when empty.
  - *Why*: Ensures zero breakage for any previously shared STM32 link or saved browser session and avoids inflating STM32 share URLs.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Multi-Vendor Data Flow

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-VENDOR BUILD PIPELINE (CLI)                        │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌───────────────────┐  │
│  │    STM32 Adapter     │  │     CH32 Adapter      │  │    RP Adapter     │  │
│  │ ST Open Pin XML +    │  │ ch32-rs/ch32-data +   │  │ Verified QFN56 /  │  │
│  │ Embassy stm32-data   │  │ Verified Pkg Overlays │  │ QFN60 / QFN80     │  │
│  │ (unchanged behavior) │  │ (coupled RM0..RM3 +   │  │ (RP2040, RP2350A/ │  │
│  │                      │  │  bonded SOP8 + tags)  │  │  B, RP2354A/B)    │  │
│  └──────────┬───────────┘  └───────────┬───────────┘  └─────────┬─────────┘  │
│             └──────────────────────────┼────────────────────────┘            │
│                                        v                                     │
│              Orchestrator: Unified Normalization + Gate 1 Assertions         │
└────────────────────────────────────────┬─────────────────────────────────────┘
                                         │ emits static shards (BASE_PATH-safe)
                                         v
┌──────────────────────────────────────────────────────────────────────────────┐
│              STATIC CATALOG + HERO BUNDLES (Zero-Backend Static)             │
│   Per-vendor meta.json | Vendor-tagged index.json | Per-MCU chip JSON shards │
│   Pre-cached Landing Hero Chips (STM32G431CBU6, CH32V203C8T6, RP2350B)       │
└────────────────────────────────────────┬─────────────────────────────────────┘
                                         │ lazy fetch + in-memory cache
                                         v
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SVELTE 5 RUNES STATE LAYER                           │
│   Catalog Store (vendor filter + fuzzy search)  |  Hash Router & Theme Store │
│   Workspace Store (assignments, labels, locks, modes, activeRemaps, PIO,     │
│                    undo/redo history, localStorage, v1/v2 URL hydration)     │
└───────────────────┬───────────────────────────────────────┬──────────────────┘
                    │ pure domain calls                     │ reactive bindings
                    v                                       v
┌──────────────────────────────────────┐   ┌───────────────────────────────────┐
│     PURE TYPESCRIPT CORE ENGINE      │   │          UI VIEW LAYER            │
│                                      │   │                                   │
│  • Unified Chip & Mux Schema         │   │  Landing Page (#/)                │
│    (af | remap-group | funcsel-pio)  │   │   ├─ Vendor-Filtered Search Bar   │
│  • Coupled Remap-Group Engine        │   │   ├─ Hero Switcher (STM32|CH32|RP)│
│    (atomic shift, lock guard, sync)  │   │   ├─ Cross-Vendor Preset Grid     │
│  • Shared Resource Collision Index   │   │   └─ 5-Tab Live Export Strip      │
│    (RP PWM slice wrap-arounds)       │   │                                   │
│  • RP PIO Manager & GPIOBASE Solver  │   │  Workspace IDE (#/mcu/:id)        │
│    (single pin, N-pin block, 32-pin  │   │   ├─ Top Toolbar + Vendor Switcher│
│     window check for RP2350B/2354B)  │   │   ├─ Left: Peripheral Tree        │
│  • Vendor Hazard Diagnostics         │   │   │   ├─ Remap Selector (CH32)    │
│    (SWIO, SWD, Bonded, HSTX, ADC)    │   │   │   └─ PIO Block Manager (RP)   │
│  • Vendor-Dispatched Exporters       │   │   ├─ Center: Pan/Zoom/Rotate Stage│
│    (Embassy STM32/RP, ch32-hal,      │   │   │   ├─ PerimeterPackage (2-side │
│     STM32/Pico/WCH C, CSV, JSON v2)  │   │   │   │   SOP/TSSOP, QFN EP pad,  │
│  • Compact v1/v2 fflate URL Codec    │   │   │   │   bonded pin labels)      │
│                                      │   │   │   ├─ GridPackage (STM32 BGA)  │
│                                      │   │   │   └─ PinPopover + Tooltip     │
│                                      │   │   │       (AF/F/RM + Hazard Tags) │
│                                      │   │   └─ Right: Summary Drawer        │
│                                      │   │       (Pin Table / Diag / DMA)    │
└──────────────────────────────────────┘   └───────────────────────────────────┘
```

### Data Model & State Extensions

- **Backward-Compatible Chip Contract**:
  - `vendor: "stm32" | "ch32" | "rp"` (defaults to `"stm32"` when absent) and `muxModel: "af" | "remap-group" | "funcsel-pio"`.
  - Package extensions: `hasExposedPad?: boolean` for QFN thermal GND pads alongside `[leftCount, 0, rightCount, 0]` 2-sided geometry for SOP/TSSOP/SSOP.
  - Pin extensions: optional `bondedNames?: string[]` (multi-bonded pads such as `CH32V003J4M6`), `tags?: PinTag[]` (`debug-swd`, `debug-sdi`, `usb`, `adc`, `hstx`, `qspi`, `bonded`, `5v-tolerant`, `boot`), and `note?: string`.
  - Signal extensions: optional `funcLabel?: string` (`AF7`, `F1`, `RM2`), `remapId?: number`, and `resourceId?: string` (`PWM0A`, `PWM11B`).
  - Peripheral & RP extensions: `peripherals[name].remaps?: PeripheralRemapOption[]` (mapping each remap ID to its human-readable name, register note, and `signal -> pinName` table) and chip-level `pio?: { instances, stateMachinesPerInstance, gpioBaseOptions }`.
- **Workspace State & Sharing**:
  - Adds optional `activeRemaps: Record<string, number>` and `pioAssignments: Record<string, { instance: string; sm?: number; role?: string }>` initialized cleanly on empty or legacy hydrated workspaces.
  - Catalog metadata records per-vendor `sources: { stm32, ch32, rp }` (commit/version + chip count) while preserving existing top-level STM32 fields for compatibility; every catalog index entry carries `vendor` for instant client-side tab filtering.

### Interactive Component & State Mapping

- **Vendor Search & Switcher Flow**: Clicking a vendor tab (`All`, `STM32`, `WCH CH32`, `Raspberry Pi`) filters the cached index immediately and updates contextual family/package filter buttons; keyboard navigation (`Up`/`Down`/`Enter`/`Escape`) opens the selected chip in `#/mcu/<ID>`.
- **CH32 Atomic Remap Flow**: Selecting a remap option in the Peripheral Tree (or `Ctrl+Clicking` a remap-group pin on the canvas and clicking a highlighted alternate target) calls the pure atomic remap switcher—validating target pins against locks, migrating active signals and custom net labels in one undoable history step, or emitting actionable conflict diagnostics if blocked.
- **RP PIO Allocation & Validation Flow**: Assigning a single GPIO or submitting the contiguous block form (`PIOx`, `Start GPIO`, `Count`, optional `SM`, optional `Role`) checks lock and peripheral collisions, writes both pin assignments and `pioAssignments` atomically into undoable history, and re-runs `evaluateWorkspace` to verify that every pin in `PIOx` fits inside an allowed `[base, base + 31]` window (`[0..31]` or `[16..47]` on RP2350B/RP2354B).
- **Hero Ecosystem Switching**: Switching between `STM32G431`, `CH32V203`, and `RP2350B` on the Landing Page swaps the active pre-cached hero chip and its curated demo workspace state, refreshes the live interactive SVG package, and synchronizes the 5-tab Export Preview Strip in real time.

### Phased Execution & Verification Gates

1. **Phase 1 — Schema & Multi-Vendor Data Pipeline**: Extend normalized types with backward-compatible defaults; split the generator into `stm32`, `rp`, and `ch32` adapters; shallow-clone and inspect `ch32-rs/ch32-data`; author verified RP QFN specs (5 SKUs) and priority CH32 physical package overlays (18 SKUs) plus upstream mapped CH32 parts. **Gate 1**: `npm run gen-data` passes cleanly across all three vendors with automated assertions on `RP2040` (56), `RP2350A` (60), `RP2350B` (80), `CH32V003F4P6` (20), `CH32V003J4M6` (8, bonded), `CH32V203C8T6` (48), `CH32X035G8U6` (28), and existing STM32 reference parts.
2. **Phase 2 — Pure Solver & Vendor-Aware Exporters**: Implement coupled remap-group resolution, `resourceId` collision detection, RP PIO allocation + `GPIOBASE` validation, CH32/RP hazard diagnostics, and vendor-dispatched exporters + `v2` JSON/URL codec with `v1` backward compatibility. **Gate 2**: `npm test` passes 100% including all existing STM32 tests plus new unit tests for CH32 remap switching, SOP8 bonded mutual exclusion, `PD1` SWIO warning, RP PWM wrap-around collision, RP2350B `GPIOBASE` valid/invalid windows, and multi-vendor exporter outputs.
3. **Phase 3 — Package Renderer & Workspace UI**: Upgrade `PerimeterPackage` for 2-sided SOP/TSSOP proportions, QFN hatched thermal exposed pads, and compact bonded pin labels; wire the CH32 Remap dropdown, RP PIO panel, `Ctrl+Click` group remap hints, vendor mux badges (`AF`/`F`/`RM`), and hazard tags in tooltips, `PinPopover`, and `SummaryDrawer`. **Gate 3**: Verify clean SVG rendering across SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 in dark/light themes across zoom levels, and verify `#/s/...` round-trips for CH32 remaps and RP PIO assignments.
4. **Phase 4 — Landing Page, CI/CD & Final Verification**: Upgrade landing copy, vendor filter tabs, cross-vendor preset grid, 3-vendor hero switcher, 5-tab export preview strip, GitHub Actions workflow (cloning `ch32-rs/ch32-data` alongside ST/Embassy repos), and `README.md` attribution. **Gate 4**: `npm test`, `npm run check`, and `BASE_PATH="/test-repo/" npm run build` pass with zero errors, zero console errors, zero emojis, and zero STM32 regressions.
