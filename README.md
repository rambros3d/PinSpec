# PinCraft

Static, zero-backend STM32 pinout configurator built with Svelte 5 (Runes), TypeScript, Vite, and Tailwind CSS v4.

## Local Setup

```bash
npm install
npm run gen-data
npm run dev
```

`npm run gen-data` shallow-clones `STMicroelectronics/STM32_open_pin_data` and `embassy-rs/stm32-data-generated` into the gitignored `.cache/` directory and emits lazy-loaded static JSON files into `public/data/`.

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
