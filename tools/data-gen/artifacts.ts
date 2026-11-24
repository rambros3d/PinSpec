/** Artifact builders and the single writer used by the generation orchestrator. */
import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogIndexEntry,
  CatalogMeta,
  CatalogMetaSources,
  CatalogSourceRecord,
  CatalogVendorSource,
  ChipData,
  VendorId,
} from '../../src/core/types';
import type { ResolvedSource } from './types';
import { normalizeWarnings } from './warnings';
import type { BuildWarning, DataGenPaths } from './types';

/** Shape of the centralized `build-warnings.json` document. */
export interface WarningsDocument {
  generatedAt: string;
  totalVariants: number;
  matchedVariants: number;
  matchRate: number;
  warningCount: number;
  warningsByVendor: Partial<Record<VendorId, number>>;
  warnings: BuildWarning[];
}

/** Builds a warnings document; always emitted, even with zero warnings. */
export function buildWarningsDocument(
  generatedAt: string,
  warnings: BuildWarning[],
  stats: { totalVariants: number; matchedVariants: number; matchRate: number },
): WarningsDocument {
  const warningsByVendor: Partial<Record<VendorId, number>> = {};
  const normalized = normalizeWarnings(warnings);
  for (const warning of normalized) {
    warningsByVendor[warning.vendor] = (warningsByVendor[warning.vendor] ?? 0) + 1;
  }
  return {
    generatedAt,
    totalVariants: stats.totalVariants,
    matchedVariants: stats.matchedVariants,
    matchRate: stats.matchRate,
    warningCount: normalized.length,
    warningsByVendor,
    warnings: normalized,
  };
}

/**
 * Maps the adapter/declared source ids onto the eleven canonical provenance ids.
 * KiCad symbols and footprints collapse to `kicad`, except the Espressif
 * library, which keeps its own id and SHA for separate license attribution.
 * picotool and pico-sdk collapse to `pico-sdk`, matching the README and footer.
 */
export function canonicalSourceId(sourceId: string): string {
  if (sourceId === 'stm32-open-pin-data') return 'st-open-pin-data';
  if (sourceId === 'embassy-stm32-data') return 'stm32-data-generated';
  if (sourceId === 'ch32-device-data') return 'ch32-device-data';
  if (sourceId === 'espressif-kicad') return 'espressif-kicad';
  if (sourceId === 'esp-gpio-tool') return 'esp-gpio-tool';
  if (sourceId === 'esp-hal-metadata') return 'esp-hal-metadata';
  if (sourceId === 'esp-idf') return 'esp-idf';
  if (sourceId.startsWith('kicad')) return 'kicad';
  if (sourceId === 'picotool' || sourceId === 'pico-sdk') return 'pico-sdk';
  if (sourceId === 'zephyr') return 'zephyr';
  if (sourceId === 'raspberrypi-documentation') return 'raspberry-pi-docs';
  return sourceId;
}

/** Builds the eleven-source provenance map from resolved upstream sources. */
export function buildSourceRegistry(
  sources: ResolvedSource[],
): Partial<Record<string, CatalogSourceRecord>> {
  const registry: Partial<Record<string, CatalogSourceRecord>> = {};
  for (const source of sources) {
    const id = canonicalSourceId(source.id);
    // The primary (alphabetically first) declaration wins when two sources
    // collapse to one canonical id; SHAs of the others remain in the
    // per-vendor `repositories` arrays.
    if (registry[id]) continue;
    registry[id] = { sha: source.commit || 'unknown', url: source.url, license: source.license };
  }
  return registry;
}

/** Builds `meta.json`, retaining the legacy STM32 top-level fields. */
export function buildMetaDocument(
  generatedAt: string,
  legacy: {
    stm32DataCommit: string;
    openPinDataCommit: string;
    chipCount: number;
    matchRate: number;
    families: string[];
  },
  sources: CatalogMetaSources,
): CatalogMeta {
  return {
    generatedAt,
    stm32DataCommit: legacy.stm32DataCommit,
    openPinDataCommit: legacy.openPinDataCommit,
    chipCount: legacy.chipCount,
    matchRate: Number(legacy.matchRate.toFixed(2)),
    families: legacy.families,
    sources,
  };
}

/** Serialized shard payloads and their uncompressed byte totals. */
export interface PreparedShards {
  byVendor: Map<VendorId, Map<string, string>>;
  all: Map<string, string>;
  bytesByVendor: Map<VendorId, number>;
}

/**
 * Serializes every shard in memory so gates can validate the exact payloads
 * before any file is written. A failing gate therefore never publishes a
 * partial catalog.
 */
export function prepareChipShards(chipsByVendor: Map<VendorId, Map<string, ChipData>>): PreparedShards {
  const byVendor = new Map<VendorId, Map<string, string>>();
  const all = new Map<string, string>();
  const bytesByVendor = new Map<VendorId, number>();
  for (const [vendor, chips] of chipsByVendor) {
    const vendorShards = new Map<string, string>();
    let bytes = 0;
    for (const [id, chip] of chips) {
      const shard = JSON.stringify(chip);
      vendorShards.set(id, shard);
      all.set(id, shard);
      bytes += Buffer.byteLength(shard, 'utf8');
    }
    byVendor.set(vendor, vendorShards);
    bytesByVendor.set(vendor, bytes);
  }
  return { byVendor, all, bytesByVendor };
}

/** Writes previously serialized shards; called only after every gate passes. */
export function writePreparedShards(paths: DataGenPaths, prepared: PreparedShards): void {
  for (const shards of prepared.byVendor.values()) {
    for (const [id, shard] of shards) {
      fs.writeFileSync(path.join(paths.chipsOutDir, `${id}.json`), shard);
    }
  }
}

/** Writes every vendor's chip shards; returns emitted byte counts by vendor. */
export function writeChipShards(
  paths: DataGenPaths,
  chipsByVendor: Map<VendorId, Map<string, ChipData>>,
): Map<VendorId, number> {
  const prepared = prepareChipShards(chipsByVendor);
  writePreparedShards(paths, prepared);
  return prepared.bytesByVendor;
}

/** Writes the compact catalog index and returns its byte size. */
export function writeIndexFile(paths: DataGenPaths, index: CatalogIndexEntry[]): number {
  const payload = JSON.stringify(index);
  fs.writeFileSync(path.join(paths.outDir, 'index.json'), payload);
  return Buffer.byteLength(payload, 'utf8');
}

/** Writes `meta.json` with stable 2-space formatting. */
export function writeMetaFile(paths: DataGenPaths, meta: CatalogMeta): void {
  fs.writeFileSync(path.join(paths.outDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

/** Writes `build-warnings.json` with stable 2-space formatting. */
export function writeWarningsFile(paths: DataGenPaths, doc: WarningsDocument): void {
  fs.writeFileSync(path.join(paths.outDir, 'build-warnings.json'), JSON.stringify(doc, null, 2));
}

/** Resets and recreates the generated output directory tree. */
export function resetOutputDir(paths: DataGenPaths): void {
  fs.rmSync(paths.outDir, { recursive: true, force: true });
  fs.mkdirSync(paths.chipsOutDir, { recursive: true });
}
