# PinCraft

Static, zero-backend STM32 pinout configurator built with Svelte 5 (Runes), TypeScript, Vite, and Tailwind CSS v4.

## Local Setup

```bash
npm install
npm run gen-data
npm run dev
```

`npm run gen-data` shallow-clones `STMicroelectronics/STM32_open_pin_data` and `embassy-rs/stm32-data-generated` into the gitignored `.cache/` directory and emits lazy-loaded static JSON files into `public/data/`. Sources may also be fetched on their own with `npm run acquire-sources`. An existing checkout is never refreshed automatically; delete the relevant `.cache/` subdirectory first to update upstream data.

Generation is orchestrated by `tools/data-gen/index.ts`, which resolves sources, registers vendor adapters, collects attributed warnings, evaluates per-vendor gates, and writes all artifacts exactly once. STM32 parsing lives in `tools/data-gen/adapters/stm32.ts`.

## Verification Commands

```bash
npm test                                    # Vitest unit tests for core solver, URL codec, exporters, and data-gen helpers
npm run check                               # svelte-check and TypeScript strict validation
BASE_PATH="/stm32-pinout/" npm run build    # Production subpath build check
```

## Architecture Overview

- `tools/data-gen/`: Build-time CLI joining ST open pin XML geometry with Embassy peripheral AF and DMA metadata into compact sharded JSONs (`meta.json`, `index.json`, `chips/<MCU>.json`).
- `src/core/`: 100% pure TypeScript domain engine (zero Svelte or DOM imports) containing normalized types, declarative peripheral mode templates, scarcity-aware backtracking auto-allocation, 1-hop remap discovery, fixed-channel DMA contention detection, undo/redo history, `fflate` Base64URL state codec, and exporters (`Embassy Rust`, `C Header`, `CSV`, deterministic `JSON`).
- `src/state/`: Reactive Svelte 5 runes stores for hash routing (`#/`, `#/mcu/<MCU>`, `#/s/<PAYLOAD>`), catalog fetching/caching, workspace persistence in `localStorage`, and daisyUI theme preference.
- `src/components/` & `src/pages/`: Engineering landing page with interactive `STM32G431CBU6` preview and three-pane CubeMX-style workspace featuring parametric perimeter (LQFP/QFN/UFQFPN/TSSOP) and zoom-adaptive grid (UFBGA/TFBGA/WLCSP) SVG renderers.

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

## Generated Data Provenance

`public/data/meta.json` records the resolved revision, license, and emitted chip count for every generated vendor under `sources`. The current STM32 entry has the shape below; the legacy top-level `openPinDataCommit`, `stm32DataCommit`, `chipCount`, `matchRate`, and `families` fields remain for existing consumers. The landing footer renders provenance directly from `meta.json.sources`.

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
    }
  }
}
```

`public/data/build-warnings.json` is always written (even with zero warnings). Each record carries `vendor`, optional `file` / `refName`, and `reason`; `warningCount` and `warningsByVendor` aggregate the totals printed in the generation log. A revision that cannot be resolved is recorded as the literal `unknown`.
