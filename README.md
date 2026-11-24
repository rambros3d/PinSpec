# PinCraft

Static, zero-backend STM32 / CH32 / RP pinout configurator built with Svelte 5 (Runes), TypeScript, Vite, and Tailwind CSS v4.

## Local Setup

```bash
npm install
npm run gen-data
npm run dev
```

`npm run gen-data` shallow-clones `STMicroelectronics/STM32_open_pin_data`, `embassy-rs/stm32-data-generated`, and `ch32-riscv-ug/ch32-device-data` into the gitignored `.cache/` directory, fetches individual RP reference files (KiCad symbols/footprints, picotool/pico-sdk FUNCSEL tables, Zephyr device trees and Raspberry Pi documentation), and emits lazy-loaded static JSON files into `public/data/`. Sources may also be fetched on their own with `npm run acquire-sources`. An existing checkout or fetched file is never refreshed automatically; delete the relevant `.cache/` entry first to update upstream data.

Generation is orchestrated by `tools/data-gen/index.ts`, which resolves sources, registers vendor adapters, collects attributed warnings, evaluates per-vendor gates, and writes all artifacts exactly once. STM32 parsing lives in `tools/data-gen/adapters/stm32.ts`; CH32 parsing lives in `tools/data-gen/adapters/ch32.ts`; RP parsing lives in `tools/data-gen/adapters/rp/` (KiCad s-expression pins, FUNCSEL join, and Zephyr/documentation variant facts). The CH32 adapter reads only the upstream `index/` CSV surface and verifies every consumed file against `index/manifest.csv` SHA-256 digests before parsing. RP parts carry `vendor: 'rp'` and `muxModel: 'funcsel-pio'`.

## Verification Commands

```bash
npm run acquire-sources                      # Fetch all seven upstream sources into .cache/
npm run gen-data                             # Emit shards and run every generation gate
npm test                                     # Vitest unit tests for core, exporters, gates, and data-gen helpers
npm run check                                # svelte-check and TypeScript strict validation
BASE_PATH="/pincraft/" npm run build         # Production subpath build check
npm run dev                                  # Local dev server on port 3000
npm run preview                              # Preview dist on port 4173
```

## Generation Gates

`npm run gen-data` runs one shared gate suite locally and in CI, so the two
environments cannot disagree. Adapters contribute strict per-vendor assertions;
the orchestrator appends four global gates before any artifact is written, so a
failure exits non-zero without publishing a partial catalog:

- **STM32:** at least 1000 MCUs, at least 95% Embassy match rate, plus field
  assertions on `STM32F411CEU6`, `STM32G431CBU6`, `STM32F103C8T6` (AFIO),
  `STM32H743VIT6`, `STM32U575RIT6` (DMA), and `STM32H743XIH6` (TFBGA grid).
- **CH32:** all 105 covered parts plus structural assertions on
  `CH32V003F4P6` (20 pins), `CH32V003J4M6` (8 bonded leads), `CH32V203C8T6` (48
  pins), and `CH32X035G8U6` (28 pins), including grouped `remaps[]`, `bonded`
  names/tags, and the `debug-sdi` tag on PD1.
- **RP:** `RP2040` (56 pins/30 GPIO), `RP2350A` (60/30), and `RP2350B` (80/48),
  QFN exposed pads, `funcsel-pio` with `funcLabel`/`PWM0A`..`PWM11B`
  `resourceId` keys, and HSTX, ADC, QSPI, SWD, and PIO tags.
- **Global:** a 150 MB uncompressed JSON budget, shard integrity and index
  consistency, complete provenance (all seven source SHAs and per-vendor
  counts/ratios), and the `build-warnings.json` attribution contract.

Deferred or unmapped parts are recorded as vendor-attributed warnings and never
fail generation. The GitHub Pages workflow acquires all sources, force-refreshes
`.cache/` on the weekly schedule, records SHAs from `meta.json`, and runs the
generation, test, type-check, subpath build, and subpath fetch smoke checks in
order before uploading an artifact.

## Architecture Overview

- `tools/data-gen/`: Build-time CLI joining ST open pin XML geometry with Embassy peripheral AF and DMA metadata, manifest-verified WCH CH32 CSV tables, and CI-fetched KiCad/pico-sdk/Zephyr RP references into compact sharded JSONs (`meta.json`, `index.json`, `chips/<MCU>.json`). CH32 entries carry `vendor: 'ch32'` and `muxModel: 'remap-group'`; RP entries carry `vendor: 'rp'` and `muxModel: 'funcsel-pio'`.
- `src/core/`: 100% pure TypeScript domain engine (zero Svelte or DOM imports) containing normalized types, declarative peripheral mode templates, scarcity-aware backtracking auto-allocation, 1-hop remap discovery, fixed-channel DMA contention detection, undo/redo history, `fflate` Base64URL state codec, and exporters (`Embassy Rust`, `C Header`, `CSV`, deterministic `JSON`).
- `src/state/`: Reactive Svelte 5 runes stores for hash routing (`#/`, `#/mcu/<MCU>`, `#/s/<PAYLOAD>`), catalog fetching/caching, workspace persistence in `localStorage`, and daisyUI theme preference.
- `src/components/` & `src/pages/`: Engineering landing page with interactive `STM32G431CBU6` preview and three-pane CubeMX-style workspace featuring parametric perimeter (LQFP/QFN/UFQFPN/TSSOP) and zoom-adaptive grid (UFBGA/TFBGA/WLCSP) SVG renderers.

## Importing `.ioc` Files and Board Presets

The workspace accepts STM32CubeMX / CubeIDE `.ioc` project files. Drop a `.ioc`
file anywhere over the workspace or use the **Import .ioc** control in the
center pane. The importer parses the flat `key=value` format, maps ST signal
names (`GPIO_EXTI13`, `SYS_JTMS-SWDIO`, `GPIO_Output`, and others) to the
normalized PinCraft vocabulary, and joins signals to physical positions by pin
name. `.ioc` files do not carry package coordinates, so pin names are the only
join key. Virtual `VP_` entries are ignored.

Part identifiers with parenthesized flash-size variants and temperature
wildcards are expanded and resolved against `index.json`. When more than one
catalog MCU matches, the app lists the candidates and waits for an explicit
selection before opening a workspace. A malformed file reports an error and
leaves the current workspace unchanged. Imports produce the same version-2
`WorkspaceState` used by share links and project files, so the result is saved
in recent sessions and round-trips through both codecs.

The **Board preset** control opens a curated set of official ST board
configurations (Nucleo boards) checked into `src/data/boards.ts`. Selecting one
opens the matching MCU with its assignments, labels, and lock flags applied.
A preset whose MCU is absent from the catalog reports a message without opening
a broken workspace. Presets are transcribed from the official ST board `.ioc`
files in `STMicroelectronics/STM32_open_pin_data` (BSD-3-Clause); that source is
already credited in the footer. RP and CH32 board presets are not included:
their upstream board files do not provide comparable pin-level maps.

Implementation: `src/core/importers/ioc.ts` is a pure TypeScript parser and
mapper with no DOM or Svelte imports; UI handoff reuses
`workspaceStore.setPendingHandoff()` and `openMcu()`.

## Themes

PinCraft uses four vendored [daisyUI](https://github.com/saadeghi/daisyui) theme
variable blocks (`src/themes/daisyui.css`); no daisyUI runtime dependency is
installed. The available theme ids are `lofi` (light), `forest` (dark),
`caramellatte` (light), and `halloween` (dark). `forest` is the dark-first
default; when no theme has been saved and the system prefers a light color
scheme, `lofi` is used instead. The compact theme picker in the landing nav and
workspace toolbar selects any of the four themes and writes the chosen id to
`localStorage` under `pincraft:theme`. Legacy `light` and `dark` values are
migrated to `lofi` and `forest` respectively. An inline bootstrap in
`index.html` reads the same key and sets `data-theme` on `<html>` before paint
to avoid a flash of unthemed content.

All colors in the application resolve from these theme variables through
semantic tokens in `src/app.css` (`bg-canvas`, `bg-surface`, `text-primary`,
`border-hairline`, `bg-pin-success`, and so on). Raw color literals exist only
in the vendored theme CSS file.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Focus global MCU search / open MCU switcher |
| `Ctrl+F` / `Cmd+F` | Focus workspace pin and signal search |
| `Ctrl+Click` / `Cmd+Click` | Enter alternate-pin Remap Mode on an assigned pin |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `0` | Fit package view to canvas |
| `Escape` | Cancel remap mode or close active popover/modal |

## Upstream Data Credits & Licenses

- Physical package geometry and pinouts: [STMicroelectronics/STM32_open_pin_data](https://github.com/STMicroelectronics/STM32_open_pin_data) (BSD-3-Clause)
- Normalized peripheral signals, alternate function indices, and DMA tables: [embassy-rs/stm32-data-generated](https://github.com/embassy-rs/stm32-data-generated) (MIT / Apache-2.0)
- CH32 part, package, pinout, and remap CSV tables: [ch32-riscv-ug/ch32-device-data](https://github.com/ch32-riscv-ug/ch32-device-data) (MIT). Only the documented `index/` surface is consumed, pinned by commit and verified against `index/manifest.csv`.
- RP physical pins and packages: [KiCad symbols](https://gitlab.com/kicad/libraries/kicad-symbols) and [footprints](https://gitlab.com/kicad/libraries/kicad-footprints) (CC-BY-SA-4.0, generated-file exception).
- RP FUNCSEL tables: [raspberrypi/picotool](https://github.com/raspberrypi/picotool) and [raspberrypi/pico-sdk](https://github.com/raspberrypi/pico-sdk) (BSD-3-Clause).
- RP memory and variant facts: [Zephyr](https://github.com/zephyrproject-rtos/zephyr) (Apache-2.0) and [raspberrypi/documentation](https://github.com/raspberrypi/documentation) (CC-BY-SA-4.0).

## Generated Data Provenance

`public/data/meta.json` records `generatedAt`, the resolved revision, license, emitted chip count, and match/coverage ratios for every generated vendor under `sources`. The same map also carries seven canonical source records keyed by `st-open-pin-data`, `stm32-data-generated`, `ch32-device-data`, `kicad`, `pico-sdk`, `zephyr`, and `raspberry-pi-docs`, each with `sha`, `url`, and `license`. For raw-file sources (RP) the SHA is a short SHA-256 of the fetched files. The legacy top-level `openPinDataCommit`, `stm32DataCommit`, `chipCount`, `matchRate`, and `families` fields remain for existing consumers. The landing footer renders provenance directly from `meta.json.sources`.

```json
{
  "sources": {
    "stm32": {
      "commit": "embassy short SHA",
      "openPinDataCommit": "ST open pin data short SHA",
      "license": "BSD-3-Clause; MIT / Apache-2.0",
      "chipCount": 2699,
      "repositories": [
        { "id": "stm32-open-pin-data", "commit": "45c0459", "license": "BSD-3-Clause" },
        { "id": "embassy-stm32-data", "commit": "5de055b", "license": "MIT / Apache-2.0" }
      ]
    },
    "ch32": {
      "commit": "ch32-device-data short SHA",
      "license": "MIT",
      "chipCount": 105,
      "repositories": [
        { "id": "ch32-device-data", "commit": "ch32-device-data short SHA", "license": "MIT" }
      ]
    },
    "rp": {
      "commit": "kicad-symbols content SHA",
      "license": "CC-BY-SA-4.0 (generated-file exception); BSD-3-Clause; Apache-2.0; CC-BY-SA-4.0",
      "chipCount": 5,
      "repositories": [
        { "id": "kicad-symbols", "commit": "content SHA", "license": "CC-BY-SA-4.0 (generated-file exception)" },
        { "id": "picotool", "commit": "content SHA", "license": "BSD-3-Clause" },
        { "id": "zephyr", "commit": "content SHA", "license": "Apache-2.0" }
      ]
    }
  }
}
```

`public/data/build-warnings.json` is always written (even with zero warnings). Each record carries `{ id, vendor, source, reason }` with optional `file` / `refName` detail; `warningCount` and `warningsByVendor` aggregate the totals printed in the generation log. A revision that cannot be resolved is recorded as the literal `unknown`. The seven upstream sources are credited in the landing footer with ST open pin data (BSD-3-Clause), Embassy stm32-data-generated (MIT / Apache-2.0), ch32-device-data (MIT), KiCad (CC-BY-SA-4.0, generated-file exception), pico-sdk and picotool (BSD-3-Clause), Zephyr (Apache-2.0), and Raspberry Pi documentation (CC-BY-SA-4.0).
