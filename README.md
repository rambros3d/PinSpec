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
- `src/state/`: Reactive Svelte 5 runes stores for hash routing (`#/`, `#/mcu/<MCU>`, `#/s/<PAYLOAD>`), catalog fetching/caching, workspace persistence in `localStorage`, and dark/light theme preference.
- `src/components/` & `src/pages/`: Engineering landing page with interactive `STM32G431CBU6` preview and three-pane CubeMX-style workspace featuring parametric perimeter (LQFP/QFN/UFQFPN/TSSOP) and zoom-adaptive grid (UFBGA/TFBGA/WLCSP) SVG renderers.

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
