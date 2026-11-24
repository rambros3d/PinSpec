/** Artifact builders and the single writer used by the generation orchestrator. */
import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogIndexEntry,
  CatalogMeta,
  CatalogVendorSource,
  ChipData,
  VendorId,
} from '../../src/core/types';
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
  for (const warning of warnings) {
    warningsByVendor[warning.vendor] = (warningsByVendor[warning.vendor] ?? 0) + 1;
  }
  return {
    generatedAt,
    totalVariants: stats.totalVariants,
    matchedVariants: stats.matchedVariants,
    matchRate: stats.matchRate,
    warningCount: warnings.length,
    warningsByVendor,
    warnings,
  };
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
  sources: Partial<Record<VendorId, CatalogVendorSource>>,
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

/** Writes every vendor's chip shards; returns emitted byte counts by vendor. */
export function writeChipShards(
  paths: DataGenPaths,
  chipsByVendor: Map<VendorId, Map<string, ChipData>>,
): Map<VendorId, number> {
  const bytesByVendor = new Map<VendorId, number>();
  for (const [vendor, chips] of chipsByVendor) {
    let bytes = 0;
    for (const [id, chip] of chips) {
      const shard = JSON.stringify(chip);
      fs.writeFileSync(path.join(paths.chipsOutDir, `${id}.json`), shard);
      bytes += Buffer.byteLength(shard, 'utf8');
    }
    bytesByVendor.set(vendor, bytes);
  }
  return bytesByVendor;
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
