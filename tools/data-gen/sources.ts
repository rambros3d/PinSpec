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
export function ensureRepo(url: string, targetDir: string): void {
  if (fs.existsSync(targetDir)) return;
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  console.log(`Cloning ${url} into ${targetDir}...`);
  execSync(`git clone --depth 1 ${url} "${targetDir}"`, { stdio: 'inherit' });
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
  ensureRepo(spec.url, spec.dir);
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

/** Every source configured for the current pipeline (used by CI pre-fetch). */
export const SOURCE_SPECS: SourceSpec[] = [
  ...stm32SourceSpecs(),
  ...ch32SourceSpecs(),
  ...rpSourceSpecs(),
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
