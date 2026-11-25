# PinCraft

Static, zero-backend STM32 / CH32 / RP / ESP32 / Microchip SAM / Nordic pinout configurator built with Svelte 5 (Runes), TypeScript, Vite, and Tailwind CSS v4.

## Local Setup

```bash
npm install
npm run gen-data
npm run dev
```

`npm run gen-data` shallow-clones `STMicroelectronics/STM32_open_pin_data`, `embassy-rs/stm32-data-generated`, `ch32-riscv-ug/ch32-device-data`, `espressif/esp-gpio-tool`, and `esp-rs/esp-hal` into the gitignored `.cache/` directory, fetches individual RP, ESP32, and SAM reference files (KiCad symbols/footprints, picotool/pico-sdk FUNCSEL tables, Zephyr device trees, Raspberry Pi documentation, pinned ESP-IDF headers, and Microchip ATDF device files), and emits lazy-loaded static JSON files into `public/data/`. Sources may also be fetched on their own with `npm run acquire-sources`. An existing checkout or fetched file is never refreshed automatically; delete the relevant `.cache/` entry first to update upstream data.

Generation is orchestrated by `tools/data-gen/index.ts`, which resolves sources, registers vendor adapters, collects attributed warnings, evaluates per-vendor gates, and writes all artifacts exactly once. STM32 parsing lives in `tools/data-gen/adapters/stm32.ts`; CH32 parsing lives in `tools/data-gen/adapters/ch32.ts`; RP parsing lives in `tools/data-gen/adapters/rp/` (KiCad s-expression pins, FUNCSEL join, and Zephyr/documentation variant facts). The CH32 adapter verifies every consumed `index/` CSV against `index/manifest.csv` SHA-256 digests before parsing. It also reads the declared `evidence/pins.csv` file for electrical I/O types, requires its `part_number`, `pin`, `pad`, and `type` columns, and records that file's own SHA-256 in provenance; upstream publishes no manifest digest for it. RP parts carry `vendor: 'rp'` and `muxModel: 'funcsel-pio'`. SAM parsing lives in `tools/data-gen/adapters/sam/`; it reads 39 curated ATDF files fetched as raw files from a pinned `Microchip-MPLAB-Harmony/dev_packs` ref, records SHA-256 provenance, and emits `vendor: 'microchip'` parts with `muxModel: 'af'`. Nordic parsing lives in `tools/data-gen/adapters/nordic/`; it joins nrf-pacs SVD, Zephyr device-tree/pinctrl, and KiCad Nordic symbol evidence into `vendor: 'nordic'` parts with `muxModel: 'psel'`.

## Verification Commands

```bash
npm run acquire-sources                      # Fetch all thirteen upstream sources into .cache/
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
  names/tags, the `debug-sdi` tag on PD1, and at least one priority part with a
  `5v-tolerant` pin backed by an `I/O/FT` row in `evidence/pins.csv`. Parts with
  no upstream FT row remain untagged.
- **RP:** `RP2040` (56 pins/30 GPIO), `RP2350A` (60/30), and `RP2350B` (80/48),
  QFN exposed pads, `funcsel-pio` with `funcLabel`/`PWM0A`..`PWM11B`
  `resourceId` keys, and HSTX, ADC, QSPI, SWD, and PIO tags.
- **ESP32:** all twelve available families, first-party joins between
  `esp-gpio-tool` YAML and `esp-hal` `esp-metadata` TOML, KiCad pad mapping,
  strict assertions on ESP32-C3 QFN32, ESP32-C3FH4 flash reservations,
  ESP32-WROOM-E pad 25 GPIO0/BOOT and pad 3 EN, ESP32 GPIO34-39 input-only,
  matrix signal counts against the pinned `gpio_sig_map.h`, and missing-value
  checks on every emitted shard.
- **Microchip SAM:** exactly 39 ATDF parts spanning SAM D21, D51, E51, and
  SAMV71; `ATSAMD21G18A` (48 pins), `ATSAMD51P20A` (TQFP128 and TFBGA120
  pinouts), `ATSAME51J20A` (64 pins), and `ATSAMV71Q21B` (144 pins); function
  letters mapped to AF indices with non-letter functions preserved as labels;
  ordercode and memory evidence from ATDF, with DMA channel maps deferred.
- **Nordic:** the nRF52840-QIAA and nRF5340-QKxx shards are checked against
  KiCad symbol pin sets, SVD/device-tree peripheral inventories, and at least
  one PSEL `funcLabel` with a null AF; nRF54L15 is deferred when no complete
  machine-readable pin set exists. Strapping, input-only, and fixed QSPI pins
  are never synthesized.
- **Global:** a 150 MB uncompressed JSON budget, shard integrity and index
  consistency (including matching `flashKb: null` for bare dies), complete
  provenance (all thirteen source SHAs and per-vendor counts/ratios), and the
  `build-warnings.json` attribution contract.

Deferred or unmapped parts are recorded as vendor-attributed warnings and never
fail generation. The GitHub Pages workflow acquires all sources, force-refreshes
`.cache/` on the weekly schedule, records SHAs from `meta.json`, and runs the
generation, test, type-check, subpath build, and subpath fetch smoke checks in
order before uploading an artifact.

## Architecture Overview

- `tools/data-gen/`: Build-time CLI joining ST open pin XML geometry with Embassy peripheral AF and DMA metadata, manifest-verified WCH CH32 CSV tables, CI-fetched KiCad/pico-sdk/Zephyr RP references, Espressif gpio-tool/esp-metadata/KiCad/ESP-IDF evidence, Microchip ATDF variants, pinouts, signals, and memories, and Nordic SVD/device-tree/pinctrl/KiCad evidence into compact sharded JSONs (`meta.json`, `index.json`, `chips/<MCU>.json`). CH32 entries carry `vendor: 'ch32'` and `muxModel: 'remap-group'`; RP entries carry `vendor: 'rp'` and `muxModel: 'funcsel-pio'`; ESP32 entries carry `vendor: 'esp32'`, `muxModel: 'gpio-matrix'`, and `flashKb: null` for bare dies; SAM entries carry `vendor: 'microchip'` and `muxModel: 'af'`; Nordic entries carry `vendor: 'nordic'` and `muxModel: 'psel'`.
- `src/core/`: 100% pure TypeScript domain engine (zero Svelte or DOM imports) containing normalized types, declarative peripheral mode templates, scarcity-aware backtracking auto-allocation, 1-hop remap discovery, fixed-channel DMA contention detection, undo/redo history, `fflate` Base64URL state codec, and exporters (`Embassy Rust` with `embassy-stm32` / `embassy-rp` / `ch32-hal` / `esp-hal` dispatch, `C Header`, `CSV`, deterministic `JSON`).
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

Starter chips include ESP32 module shards such as `ESP32-C3FH4` and
`ESP32-WROOM-E`; they open generated module data through the same handoff as
other vendors. No ESP32 board preset or `.ioc` import path is offered.

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

PinCraft uses two vendored [daisyUI](https://github.com/saadeghi/daisyui) theme
variable blocks (`src/themes/daisyui.css`): `fantasy` for light mode and
`halloween` for dark mode. daisyUI is licensed under MIT
(https://github.com/saadeghi/daisyui/blob/master/LICENSE); its component layer
is registered as a build-time plugin. The theme button in the landing nav and
workspace toolbar cycles through System, Light, and Dark, and writes the chosen
mode to `localStorage` under `pincraft:theme`. System mode reads the operating
system color scheme once at load; no live change listener is registered. With no
saved mode and no OS preference, light mode is the baseline. Saved values outside
the three mode values, including theme ids from the previous picker, are ignored
and resolved as System. An inline bootstrap in `index.html` reads the same key
and sets `data-theme` on `<html>` before paint to avoid a flash of unthemed
content. The mode is a UI preference and is not included in share URLs or
project files.

Non-SVG surfaces use daisyUI component classes and semantic color utilities;
`text-foreground` is the application's foreground text utility, distinct from
daisyUI's brand-color `text-primary`. The IC package renderers keep their own
SVG geometry, pin-state colors, and always-on depth and noise texture. Raw
color literals exist only in the vendored theme CSS file.

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
- CH32 part, package, pinout, and remap CSV tables: [ch32-riscv-ug/ch32-device-data](https://github.com/ch32-riscv-ug/ch32-device-data) (MIT). The documented `index/` surface is pinned by commit and verified against `index/manifest.csv`; `evidence/pins.csv` is consumed in addition for `I/O/FT` electrical types with an independently recorded SHA-256. No compatibility shim is provided for the regenerated CH32 shards that carry the new tag.
- RP physical pins and packages: [KiCad symbols](https://gitlab.com/kicad/libraries/kicad-symbols) and [footprints](https://gitlab.com/kicad/libraries/kicad-footprints) (CC-BY-SA-4.0, generated-file exception).
- RP FUNCSEL tables: [raspberrypi/picotool](https://github.com/raspberrypi/picotool) and [raspberrypi/pico-sdk](https://github.com/raspberrypi/pico-sdk) (BSD-3-Clause).
- RP memory and variant facts: [Zephyr](https://github.com/zephyrproject-rtos/zephyr) (Apache-2.0) and [raspberrypi/documentation](https://github.com/raspberrypi/documentation) (CC-BY-SA-4.0).
- ESP32 GPIO capabilities, strapping, pull state, and MPN reserved pins: [espressif/esp-gpio-tool](https://github.com/espressif/esp-gpio-tool) (Apache-2.0).
- ESP32 IO_MUX functions, matrix signal ids, limitations, and SoC facts: [esp-rs/esp-hal esp-metadata](https://github.com/esp-rs/esp-hal) (MIT / Apache-2.0).
- ESP32 symbol and footprint pad geometry: [espressif/kicad-libraries](https://github.com/espressif/kicad-libraries) (CC-BY-SA-4.0, generated-file exception).
- ESP32 matrix signal count evidence: [espressif/esp-idf](https://github.com/espressif/esp-idf) (Apache-2.0), pinned to release `v5.4.1`.
- SAM variants, pinouts, module signals, and memories: [Microchip-MPLAB-Harmony/dev_packs](https://github.com/Microchip-MPLAB-Harmony/dev_packs) ATDF files (Apache-2.0), fetched as individual raw files from a pinned ref.
- Nordic SVD descriptions: [nrf-rs/nrf-pacs](https://github.com/nrf-rs/nrf-pacs) from the `master` branch (0BSD).
- Nordic device-tree and PSEL functions: [Zephyr](https://github.com/zephyrproject-rtos/zephyr) Nordic DTS and pinctrl binding/header (Apache-2.0).
- Nordic physical pins: [KiCad Nordic symbols](https://gitlab.com/kicad/libraries/kicad-symbols) (CC-BY-SA-4.0, generated-file exception).

## Generated Data Provenance

`public/data/meta.json` records `generatedAt`, the resolved revision, license, emitted chip count, and match/coverage ratios for every generated vendor under `sources`. The same map also carries thirteen canonical source records keyed by `st-open-pin-data`, `stm32-data-generated`, `ch32-device-data`, `kicad`, `pico-sdk`, `zephyr`, `raspberry-pi-docs`, `esp-gpio-tool`, `esp-hal-metadata`, `espressif-kicad`, `esp-idf`, `microchip-atdf`, and `nrf-pacs`, each with `sha`, `url`, and `license`. For raw-file sources (RP, SAM, and Nordic Zephyr/KiCad evidence) the SHA is a short SHA-256 of the fetched files. The CH32 vendor record also carries `evidenceFiles` with the full SHA-256, row count, URL, and license of the additional electrical-kind file. The legacy top-level `openPinDataCommit`, `stm32DataCommit`, `chipCount`, `matchRate`, and `families` fields remain for existing consumers. The landing footer renders provenance directly from `meta.json.sources`.

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
    },
    "microchip": {
      "commit": "microchip-atdf content SHA",
      "license": "Apache-2.0",
      "chipCount": 39,
      "repositories": [
        { "id": "microchip-atdf", "commit": "content SHA", "license": "Apache-2.0" }
      ]
    },
    "nordic": {
      "commit": "nrf-pacs short SHA",
      "license": "0BSD; Apache-2.0; CC-BY-SA-4.0 (generated-file exception)",
      "chipCount": 2,
      "repositories": [
        { "id": "nrf-pacs", "commit": "short SHA", "license": "0BSD" },
        { "id": "zephyr-nordic", "commit": "content SHA", "license": "Apache-2.0" },
        { "id": "kicad-mcu-nordic", "commit": "content SHA", "license": "CC-BY-SA-4.0 (generated-file exception)" }
      ]
    }
  }
}
```

`public/data/build-warnings.json` is always written (even with zero warnings). Each record carries `{ id, vendor, source, reason }` with optional `file` / `refName` detail; `warningCount` and `warningsByVendor` aggregate the totals printed in the generation log. A revision that cannot be resolved is recorded as the literal `unknown`. The thirteen canonical sources are credited in the landing footer with ST open pin data (BSD-3-Clause), Embassy stm32-data-generated (MIT / Apache-2.0), ch32-device-data (MIT), KiCad (CC-BY-SA-4.0, generated-file exception), pico-sdk and picotool (BSD-3-Clause), Zephyr (Apache-2.0), Raspberry Pi documentation (CC-BY-SA-4.0), esp-gpio-tool (Apache-2.0), esp-hal esp-metadata (MIT / Apache-2.0), espressif/kicad-libraries (CC-BY-SA-4.0, generated-file exception), esp-idf (Apache-2.0), Microchip ATDF dev packs (Apache-2.0), and nrf-pacs SVDs (0BSD). Nordic Zephyr pinctrl and KiCad Nordic symbol files are attributed under the existing Zephyr and KiCad entries.
