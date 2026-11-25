/**
 * Upstream source acquisition and provenance resolution for the catalog build.
 *
 * Sources are shallow-cloned on demand into the gitignored `.cache/` directory;
 * an existing checkout is never refreshed automatically (delete it to update).
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DeclaredSourceFile, ResolvedSource, SourceSpec } from './types';

/** License of STMicroelectronics/STM32_open_pin_data. */
export const LICENSE_OPEN_PIN_DATA = 'BSD-3-Clause';
/** License of embassy-rs/stm32-data-generated (dual licensed). */
export const LICENSE_EMBASSY_STM32 = 'MIT / Apache-2.0';
/** License of ch32-riscv-ug/ch32-device-data. */
export const LICENSE_CH32_DEVICE_DATA = 'MIT';
/** License of KiCad symbol/footprint libraries (generated-file exception). */
export const LICENSE_KICAD = 'CC-BY-SA-4.0 (generated-file exception)';
/** License of raspberrypi/picotool and pico-sdk. */
export const LICENSE_PICOTOOL = 'BSD-3-Clause';
/** License of Zephyr device-tree sources. */
export const LICENSE_ZEPHYR = 'Apache-2.0';
/** License of raspberrypi/documentation (variant tables). */
export const LICENSE_RPI_DOCS = 'CC-BY-SA-4.0';
/** License of espressif/esp-gpio-tool target tables. */
export const LICENSE_ESP_GPIO_TOOL = 'Apache-2.0';
/** License of esp-rs/esp-hal esp-metadata (dual licensed). */
export const LICENSE_ESP_HAL_METADATA = 'MIT / Apache-2.0';
/** License of espressif/kicad-libraries (generated-file exception). */
export const LICENSE_ESPRESSIF_KICAD = 'CC-BY-SA-4.0 (generated-file exception)';
/** License of espressif/esp-idf headers. */
export const LICENSE_ESP_IDF = 'Apache-2.0';
/** Pinned ESP-IDF release tag used for all fetched header evidence. */
export const ESP_IDF_REF = 'v5.4.1';
/** License of the Microchip ATDF files in MPLAB Harmony dev packs. */
export const LICENSE_MICROCHIP_ATDF = 'Apache-2.0';
/** License of the nrf-pacs CMSIS-SVD definitions. */
export const LICENSE_NRF_PACS = '0BSD';
/**
 * Pinned `Microchip-MPLAB-Harmony/dev_packs` revision used for raw ATDF fetches.
 * A full clone of this repository is disproportionate for the 39 consumed
 * files, so each file is fetched directly from this immutable ref.
 */
export const DEV_PACKS_REF = '345dc12d42a4fdec72117b64a8c3527023bdeca9';

/**
 * Curated ATDF files under the pinned dev-packs ref, grouped by SAM family.
 * These are upstream file paths, not transcribed chip facts; every device
 * fact is read from the fetched XML by `adapters/sam/`.
 */
export const SAM_ATDF_PATHS: readonly string[] = [
  ...['E15A', 'E16A', 'E17A', 'E18A', 'G15A', 'G16A', 'G17A', 'G17AU', 'G18A', 'G18AU', 'J15A', 'J16A', 'J17A', 'J18A'].map(
    (part) => `Microchip/SAMD21_DFP/3.6.144/samd21a/atdf/ATSAMD21${part}.atdf`,
  ),
  ...['G18A', 'G19A', 'J18A', 'J19A', 'J20A', 'N19A', 'N20A', 'P19A', 'P20A'].map(
    (part) => `Microchip/SAMD51_DFP/3.7.237/samd51a/atdf/ATSAMD51${part}.atdf`,
  ),
  ...['G18A', 'G19A', 'J18A', 'J19A', 'J20A', 'N19A', 'N20A'].map(
    (part) => `Microchip/SAME51_DFP/3.7.242/atdf/ATSAME51${part}.atdf`,
  ),
  ...['J19B', 'J20B', 'J21B', 'N19B', 'N20B', 'N21B', 'Q19B', 'Q20B', 'Q21B'].map(
    (part) => `Microchip/SAMV71_DFP/4.10.230/samv71b/atdf/ATSAMV71${part}.atdf`,
  ),
];

/** Builds the default `.cache` location for a repository root. */
export function defaultCacheDir(root: string = process.cwd()): string {
  return path.join(root, '.cache');
}

/**
 * Downloads the declared raw files of a source into its cache directory.
 * Existing files are left untouched, mirroring the git checkout cache policy.
 * `curl` is used because this pipeline is synchronous and Node has no built-in
 * synchronous HTTP client; it is available on every GitHub Actions runner.
 */
export function ensureRawFiles(spec: SourceSpec): void {
  for (const file of spec.rawFiles ?? []) {
    const target = path.join(spec.dir, file.path);
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    console.log(`Fetching ${file.url} into ${target}...`);
    execSync(`curl -fsSL --max-time 60 "${file.url}" -o "${target}"`, { stdio: 'inherit' });
  }
}

/**
 * Content revision for a raw-file source: the short SHA-256 of its file paths
 * and bytes. Returns `unknown` when any declared file is absent, so a missing
 * reference never crashes provenance generation.
 */
export function resolveRawRevision(spec: SourceSpec): string {
  const files = spec.rawFiles ?? [];
  if (files.length === 0) return 'unknown';
  const hash = createHash('sha256');
  for (const file of files) {
    const target = path.join(spec.dir, file.path);
    if (!fs.existsSync(target)) return 'unknown';
    hash.update(file.path);
    hash.update('\0');
    hash.update(fs.readFileSync(target));
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 12);
}

/** Shallow-clones `url` into `targetDir` only when that directory is absent. */
export function ensureRepo(url: string, targetDir: string, branch?: string): void {
  if (fs.existsSync(targetDir)) return;
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  console.log(`Cloning ${url} into ${targetDir}...`);
  const branchArg = branch ? ` --branch ${branch}` : '';
  execSync(`git clone --depth 1${branchArg} ${url} "${targetDir}"`, { stdio: 'inherit' });
}

/**
 * Resolves the short HEAD revision of a checkout.
 * Returns the literal `unknown` when no revision can be read, so a missing or
 * non-git source never crashes generation (provenance stays non-empty).
 */
export function resolveRevision(repoDir: string): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha.length > 0 ? sha : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Acquires one declared source and attaches its resolved short revision. */
export function acquireSource(spec: SourceSpec): ResolvedSource {
  if (spec.rawFiles && spec.rawFiles.length > 0) {
    ensureRawFiles(spec);
    return { ...spec, commit: resolveRawRevision(spec) };
  }
  ensureRepo(spec.url, spec.dir, spec.branch);
  return { ...spec, commit: resolveRevision(spec.dir) };
}

/** Acquires every declared source, preserving declaration order. */
export function acquireSources(specs: SourceSpec[]): ResolvedSource[] {
  return specs.map((spec) => acquireSource(spec));
}

/** Source declarations for the STM32 vendor adapter. */
export function stm32SourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  return [
    {
      id: 'stm32-open-pin-data',
      url: 'https://github.com/STMicroelectronics/STM32_open_pin_data.git',
      dir: path.join(cacheDir, 'STM32_open_pin_data'),
      license: LICENSE_OPEN_PIN_DATA,
    },
    {
      id: 'embassy-stm32-data',
      url: 'https://github.com/embassy-rs/stm32-data-generated.git',
      dir: path.join(cacheDir, 'stm32-data-generated'),
      license: LICENSE_EMBASSY_STM32,
    },
  ];
}

/**
 * CH32 electrical-kind evidence. The file lives in the same checkout as the
 * manifest-verified `index/` tables, but upstream does not publish a digest for
 * it, so the adapter records its own SHA-256 instead of treating it as verified.
 */
export const CH32_EVIDENCE_FILE: DeclaredSourceFile = {
  path: 'evidence/pins.csv',
  columns: ['part_number', 'pin', 'pad', 'type'],
  url: 'https://github.com/ch32-riscv-ug/ch32-device-data/blob/main/evidence/pins.csv',
};

/** Source declarations for the CH32 vendor adapter. */
export function ch32SourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  return [
    {
      id: 'ch32-device-data',
      url: 'https://github.com/ch32-riscv-ug/ch32-device-data.git',
      dir: path.join(cacheDir, 'ch32-device-data'),
      license: LICENSE_CH32_DEVICE_DATA,
      declaredFiles: [CH32_EVIDENCE_FILE],
    },
  ];
}

/** KiCad RP symbol files consumed by the RP adapter (all under one symdir). */
export const RP_SYMBOL_NAMES = [
  'RP2040',
  'RP2350A',
  'RP2350B',
  'RP2354A',
  'RP2354B',
] as const;

/** KiCad QFN footprint files used only for perimeter geometry. */
export const RP_FOOTPRINT_NAMES = [
  'QFN-56-1EP_7x7mm_P0.4mm_EP3.2x3.2mm',
  'QFN-60-1EP_7x7mm_P0.4mm_EP3.4x3.4mm',
  'QFN-80-1EP_10x10mm_P0.4mm_EP3.4x3.4mm',
] as const;

/** Source declarations for the RP vendor adapter (all fetched as raw files). */
export function rpSourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  const kicadBase = 'https://gitlab.com/kicad/libraries/kicad-symbols/-/raw/master';
  const footprintBase = 'https://gitlab.com/kicad/libraries/kicad-footprints/-/raw/master';
  const zephyrBase = 'https://raw.githubusercontent.com/zephyrproject-rtos/zephyr/main';
  const docsBase =
    'https://raw.githubusercontent.com/raspberrypi/documentation/master/documentation/asciidoc/microcontrollers/microcontroller-chips';
  return [
    {
      id: 'kicad-symbols',
      url: 'https://gitlab.com/kicad/libraries/kicad-symbols',
      dir: path.join(cacheDir, 'kicad-symbols'),
      license: LICENSE_KICAD,
      rawFiles: RP_SYMBOL_NAMES.map((name) => ({
        url: `${kicadBase}/MCU_RaspberryPi.kicad_symdir/${name}.kicad_sym`,
        path: `MCU_RaspberryPi.kicad_symdir/${name}.kicad_sym`,
      })),
    },
    {
      id: 'kicad-footprints',
      url: 'https://gitlab.com/kicad/libraries/kicad-footprints',
      dir: path.join(cacheDir, 'kicad-footprints'),
      license: LICENSE_KICAD,
      rawFiles: RP_FOOTPRINT_NAMES.map((name) => ({
        url: `${footprintBase}/Package_DFN_QFN.pretty/${name}.kicad_mod`,
        path: `Package_DFN_QFN.pretty/${name}.kicad_mod`,
      })),
    },
    {
      id: 'picotool',
      url: 'https://github.com/raspberrypi/picotool',
      dir: path.join(cacheDir, 'picotool'),
      license: LICENSE_PICOTOOL,
      rawFiles: [
        {
          url: 'https://raw.githubusercontent.com/raspberrypi/picotool/master/main.cpp',
          path: 'main.cpp',
        },
      ],
    },
    {
      id: 'pico-sdk',
      url: 'https://github.com/raspberrypi/pico-sdk',
      dir: path.join(cacheDir, 'pico-sdk'),
      license: LICENSE_PICOTOOL,
      rawFiles: [
        {
          url: 'https://raw.githubusercontent.com/raspberrypi/pico-sdk/master/src/rp2_common/hardware_gpio/include/hardware/gpio.h',
          path: 'src/rp2_common/hardware_gpio/include/hardware/gpio.h',
        },
      ],
    },
    {
      id: 'zephyr',
      url: 'https://github.com/zephyrproject-rtos/zephyr',
      dir: path.join(cacheDir, 'zephyr'),
      license: LICENSE_ZEPHYR,
      rawFiles: [
        {
          url: `${zephyrBase}/dts/arm/raspberrypi/rpi_pico/rp2040.dtsi`,
          path: 'dts/arm/raspberrypi/rpi_pico/rp2040.dtsi',
        },
        {
          url: `${zephyrBase}/dts/vendor/raspberrypi/rpi_pico/rp2350.dtsi`,
          path: 'dts/vendor/raspberrypi/rpi_pico/rp2350.dtsi',
        },
        {
          url: `${zephyrBase}/dts/vendor/raspberrypi/rpi_pico/rp2350a.dtsi`,
          path: 'dts/vendor/raspberrypi/rpi_pico/rp2350a.dtsi',
        },
        {
          url: `${zephyrBase}/dts/vendor/raspberrypi/rpi_pico/rp2350b.dtsi`,
          path: 'dts/vendor/raspberrypi/rpi_pico/rp2350b.dtsi',
        },
      ],
    },
    {
      id: 'raspberrypi-documentation',
      url: 'https://github.com/raspberrypi/documentation',
      dir: path.join(cacheDir, 'raspberrypi-documentation'),
      license: LICENSE_RPI_DOCS,
      rawFiles: ['rp2040', 'rp2350'].map((name) => ({
        url: `${docsBase}/${name}.adoc`,
        path: `documentation/asciidoc/microcontrollers/microcontroller-chips/${name}.adoc`,
      })),
    },
  ];
}

/** Pinned ESP-IDF header paths consumed by the matrix-count gate. */
export const ESP_IDF_HEADER_PATHS = [
  'components/soc/esp32c3/include/soc/soc_caps.h',
  'components/soc/esp32c3/include/soc/gpio_sig_map.h',
  'components/soc/esp32c3/register/soc/io_mux_reg.h',
] as const;

/** KiCad symbol and footprint files consumed by the ESP32 adapter. */
export const ESP_KICAD_FILES = [
  'symbols/Espressif.kicad_sym',
  'footprints/Espressif.pretty/QFN-32-1EP_4x4mm_P0.4mm_EP2.9x2.9mm.kicad_mod',
  'footprints/Espressif.pretty/QFN-48-1EP_5x5mm_P0.35mm_EP3.7x3.7mm.kicad_mod',
  'footprints/Espressif.pretty/ESP32-WROOM-32E.kicad_mod',
] as const;

/** Source declarations for the ESP32 vendor adapter. */
export function esp32SourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  const kicadBase = 'https://raw.githubusercontent.com/espressif/kicad-libraries/main';
  const idfBase = `https://raw.githubusercontent.com/espressif/esp-idf/${ESP_IDF_REF}`;
  return [
    {
      id: 'esp-gpio-tool',
      url: 'https://github.com/espressif/esp-gpio-tool',
      dir: path.join(cacheDir, 'esp-gpio-tool'),
      license: LICENSE_ESP_GPIO_TOOL,
    },
    {
      id: 'esp-hal-metadata',
      url: 'https://github.com/esp-rs/esp-hal',
      dir: path.join(cacheDir, 'esp-hal'),
      license: LICENSE_ESP_HAL_METADATA,
    },
    {
      id: 'espressif-kicad',
      url: 'https://github.com/espressif/kicad-libraries',
      dir: path.join(cacheDir, 'espressif-kicad'),
      license: LICENSE_ESPRESSIF_KICAD,
      rawFiles: ESP_KICAD_FILES.map((file) => ({
        url: `${kicadBase}/${file}`,
        path: file,
      })),
    },
    {
      id: 'esp-idf',
      url: 'https://github.com/espressif/esp-idf',
      dir: path.join(cacheDir, 'esp-idf'),
      license: LICENSE_ESP_IDF,
      rawFiles: ESP_IDF_HEADER_PATHS.map((file) => ({
        url: `${idfBase}/${file}`,
        path: file,
      })),
    },
  ];
}

/** Raw-file source declarations for the curated Microchip ATDF subset. */
export function microchipAtdfSourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  const base = 'https://raw.githubusercontent.com/Microchip-MPLAB-Harmony/dev_packs';
  return [
    {
      id: 'microchip-atdf',
      url: 'https://github.com/Microchip-MPLAB-Harmony/dev_packs',
      dir: path.join(cacheDir, 'microchip-atdf'),
      license: LICENSE_MICROCHIP_ATDF,
      rawFiles: SAM_ATDF_PATHS.map((file) => ({ url: `${base}/${DEV_PACKS_REF}/${file}`, path: file })),
    },
  ];
}

/** SVD files consumed by the Nordic adapter from the nrf-pacs checkout. */
export const NRF_PACS_SVD_FILES = [
  'nrf52840.svd',
  'nrf5340-app.svd',
  'nrf5340-net.svd',
] as const;

/** Zephyr Nordic device-tree, pinctrl binding, and pinctrl header paths. */
export const ZEPHYR_NORDIC_FILES = [
  'dts/arm/nordic/nrf52840.dtsi',
  'dts/arm/nordic/nrf5340_cpuapp.dtsi',
  'dts/arm/nordic/nrf5340_cpuapp_peripherals.dtsi',
  'dts/arm/nordic/nrf5340_cpuapp_qkaa.dtsi',
  'dts/arm/nordic/nrf5340_cpunet.dtsi',
  'dts/bindings/pinctrl/nordic,nrf-pinctrl.yaml',
  'include/zephyr/dt-bindings/pinctrl/nrf-pinctrl.h',
] as const;

/** KiCad Nordic symbol files consumed by the Nordic adapter. */
export const KICAD_NORDIC_FILES = [
  'nRF52840.kicad_sym',
  'nRF5340-QKxx.kicad_sym',
] as const;

/** Source declarations for the Nordic pilot selectors. */
export function nordicSourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  const zephyrBase = 'https://raw.githubusercontent.com/zephyrproject-rtos/zephyr/main';
  const kicadBase = 'https://gitlab.com/kicad/libraries/kicad-symbols/-/raw/master';
  return [
    {
      id: 'nrf-pacs',
      url: 'https://github.com/nrf-rs/nrf-pacs',
      dir: path.join(cacheDir, 'nrf-pacs'),
      license: LICENSE_NRF_PACS,
      branch: 'master',
    },
    {
      id: 'zephyr-nordic',
      url: 'https://github.com/zephyrproject-rtos/zephyr',
      dir: path.join(cacheDir, 'zephyr-nordic'),
      license: LICENSE_ZEPHYR,
      rawFiles: ZEPHYR_NORDIC_FILES.map((file) => ({
        url: `${zephyrBase}/${file}`,
        path: file,
      })),
    },
    {
      id: 'kicad-mcu-nordic',
      url: 'https://gitlab.com/kicad/libraries/kicad-symbols',
      dir: path.join(cacheDir, 'kicad-nordic'),
      license: LICENSE_KICAD,
      rawFiles: KICAD_NORDIC_FILES.map((file) => ({
        url: `${kicadBase}/MCU_Nordic.kicad_symdir/${file}`,
        path: `MCU_Nordic.kicad_symdir/${file}`,
      })),
    },
  ];
}

/** Every source configured for the current pipeline (used by CI pre-fetch). */
export const SOURCE_SPECS: SourceSpec[] = [
  ...stm32SourceSpecs(),
  ...ch32SourceSpecs(),
  ...rpSourceSpecs(),
  ...esp32SourceSpecs(),
  ...microchipAtdfSourceSpecs(),
  ...nordicSourceSpecs(),
];

function main(): void {
  for (const spec of SOURCE_SPECS) {
    const source = acquireSource(spec);
    console.log(`  ${source.id}: ${source.commit} (${source.license})`);
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
