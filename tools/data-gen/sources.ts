/**
 * Upstream source acquisition and provenance resolution for the catalog build.
 *
 * Sources are shallow-cloned on demand into the gitignored `.cache/` directory;
 * an existing checkout is never refreshed automatically (delete it to update).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResolvedSource, SourceSpec } from './types';

/** License of STMicroelectronics/STM32_open_pin_data. */
export const LICENSE_OPEN_PIN_DATA = 'BSD-3-Clause';
/** License of embassy-rs/stm32-data-generated (dual licensed). */
export const LICENSE_EMBASSY_STM32 = 'MIT / Apache-2.0';
/** License of ch32-riscv-ug/ch32-device-data. */
export const LICENSE_CH32_DEVICE_DATA = 'MIT';

/** Builds the default `.cache` location for a repository root. */
export function defaultCacheDir(root: string = process.cwd()): string {
  return path.join(root, '.cache');
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

/** Source declarations for the CH32 vendor adapter. */
export function ch32SourceSpecs(cacheDir: string = defaultCacheDir()): SourceSpec[] {
  return [
    {
      id: 'ch32-device-data',
      url: 'https://github.com/ch32-riscv-ug/ch32-device-data.git',
      dir: path.join(cacheDir, 'ch32-device-data'),
      license: LICENSE_CH32_DEVICE_DATA,
    },
  ];
}

/** Every source configured for the current pipeline (used by CI pre-fetch). */
export const SOURCE_SPECS: SourceSpec[] = [...stm32SourceSpecs(), ...ch32SourceSpecs()];

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
