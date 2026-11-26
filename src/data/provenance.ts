/**
 * Shared, text-only provenance reference. These records mirror the canonical
 * source ids emitted into `meta.json`; the live revisions come from that file,
 * so the labels and licenses here are the only static copy in the app.
 */
import type { CatalogSourceId, VendorId } from '../core/types';

export interface ProvenanceSource {
  id: CatalogSourceId;
  label: string;
  url: string;
  license: string;
}

export interface ProvenanceVendor {
  id: VendorId;
  label: string;
}

export interface ShortcutReference {
  keys: string;
  action: string;
}

/** Thirteen canonical upstream sources credited in About. */
export const PROVENANCE_SOURCES: readonly ProvenanceSource[] = [
  {
    id: 'st-open-pin-data',
    label: 'STMicroelectronics/STM32_open_pin_data',
    url: 'https://github.com/STMicroelectronics/STM32_open_pin_data',
    license: 'BSD-3-Clause',
  },
  {
    id: 'stm32-data-generated',
    label: 'embassy-rs/stm32-data-generated',
    url: 'https://github.com/embassy-rs/stm32-data-generated',
    license: 'MIT / Apache-2.0',
  },
  {
    id: 'ch32-device-data',
    label: 'ch32-riscv-ug/ch32-device-data',
    url: 'https://github.com/ch32-riscv-ug/ch32-device-data',
    license: 'MIT',
  },
  {
    id: 'kicad',
    label: 'KiCad symbols and footprints',
    url: 'https://gitlab.com/kicad/libraries/kicad-symbols',
    license: 'CC-BY-SA-4.0 (generated-file exception)',
  },
  {
    id: 'pico-sdk',
    label: 'pico-sdk and picotool',
    url: 'https://github.com/raspberrypi/pico-sdk',
    license: 'BSD-3-Clause',
  },
  {
    id: 'zephyr',
    label: 'Zephyr',
    url: 'https://github.com/zephyrproject-rtos/zephyr',
    license: 'Apache-2.0',
  },
  {
    id: 'raspberry-pi-docs',
    label: 'raspberrypi/documentation',
    url: 'https://github.com/raspberrypi/documentation',
    license: 'CC-BY-SA-4.0',
  },
  {
    id: 'esp-gpio-tool',
    label: 'espressif/esp-gpio-tool',
    url: 'https://github.com/espressif/esp-gpio-tool',
    license: 'Apache-2.0',
  },
  {
    id: 'esp-hal-metadata',
    label: 'esp-rs/esp-hal esp-metadata',
    url: 'https://github.com/esp-rs/esp-hal',
    license: 'MIT / Apache-2.0',
  },
  {
    id: 'espressif-kicad',
    label: 'espressif/kicad-libraries',
    url: 'https://github.com/espressif/kicad-libraries',
    license: 'CC-BY-SA-4.0 (generated-file exception)',
  },
  {
    id: 'esp-idf',
    label: 'espressif/esp-idf',
    url: 'https://github.com/espressif/esp-idf',
    license: 'Apache-2.0',
  },
  {
    id: 'microchip-atdf',
    label: 'Microchip-MPLAB-Harmony/dev_packs (ATDF)',
    url: 'https://github.com/Microchip-MPLAB-Harmony/dev_packs',
    license: 'Apache-2.0',
  },
  {
    id: 'nrf-pacs',
    label: 'nrf-rs/nrf-pacs',
    url: 'https://github.com/nrf-rs/nrf-pacs',
    license: '0BSD',
  },
];

/** Vendors with a live per-vendor summary in `meta.json.sources`. */
export const PROVENANCE_VENDORS: readonly ProvenanceVendor[] = [
  { id: 'stm32', label: 'STM32' },
  { id: 'ch32', label: 'CH32' },
  { id: 'rp', label: 'RP' },
  { id: 'esp32', label: 'ESP32' },
  { id: 'microchip', label: 'SAM' },
  { id: 'nordic', label: 'Nordic' },
];

/** Text-only keyboard reference, shared by the start screen and About. */
export const SHORTCUTS: readonly ShortcutReference[] = [
  { keys: 'Ctrl+K', action: 'Open the MCU switcher' },
  { keys: 'Ctrl+F', action: 'Find a pin or signal in the workspace' },
  { keys: 'Ctrl+Click', action: 'Open pin remap mode' },
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'Ctrl+Y', action: 'Redo' },
  { keys: '0', action: 'Fit package in view' },
  { keys: '?', action: 'Show keyboard shortcuts' },
  { keys: 'Escape', action: 'Cancel the current action' },
];
