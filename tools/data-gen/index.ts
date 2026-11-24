/**
 * Catalog generation orchestrator.
 *
 * Resolves upstream sources, resets outputs, delegates to registered vendor
 * adapters, and writes every artifact exactly once. No vendor-specific parsing
 * lives here; see `adapters/stm32.ts` for the STM32 implementation.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  CatalogIndexEntry,
  CatalogMeta,
  CatalogVendorSource,
  ChipData,
  VendorId,
} from '../../src/core/types';
import { stm32Adapter } from './adapters/stm32';
import {
  buildMetaDocument,
  buildWarningsDocument,
  resetOutputDir,
  writeChipShards,
  writeIndexFile,
  writeMetaFile,
  writeWarningsFile,
  type WarningsDocument,
} from './artifacts';
import { evaluateGates } from './gates';
import { acquireSources } from './sources';
import type {
  AdapterResult,
  DataGenPaths,
  GateContext,
  GateResult,
  VendorAdapter,
} from './types';
import { createWarningCollector } from './warnings';

/** Adapters registered for this build. New vendors are added here only. */
export const DEFAULT_ADAPTERS: VendorAdapter[] = [stm32Adapter];

/** End-of-run view used for logging and tests. */
export interface GenerationSummary {
  meta: CatalogMeta;
  warnings: WarningsDocument;
  gateResults: GateResult[];
  vendorStats: Array<{
    vendor: VendorId;
    chipCount: number;
    matchRate: number;
    warnings: number;
    bytes: number;
  }>;
  totalBytes: number;
}

function pathsFor(root: string): DataGenPaths {
  const outDir = path.join(root, 'public', 'data');
  return {
    root,
    cacheDir: path.join(root, '.cache'),
    outDir,
    chipsOutDir: path.join(outDir, 'chips'),
  };
}

/** Builds per-vendor provenance entries for `meta.json.sources`. */
export function buildVendorSourcesMeta(
  adapters: VendorAdapter[],
  sources: ReturnType<typeof acquireSources>,
  results: AdapterResult[],
): Partial<Record<VendorId, CatalogVendorSource>> {
  const out: Partial<Record<VendorId, CatalogVendorSource>> = {};
  for (const adapter of adapters) {
    const vendorSources = sources.filter((s) =>
      adapter.sourceSpecs.some((spec) => spec.id === s.id),
    );
    const primary =
      vendorSources.find((s) => s.id === adapter.primarySourceId) ?? vendorSources[0];
    const entry: CatalogVendorSource = {
      commit: primary?.commit ?? 'unknown',
      license: Array.from(new Set(vendorSources.map((s) => s.license))).join('; ') || 'unknown',
      chipCount: results.find((r) => r.vendor === adapter.vendor)?.index.length ?? 0,
      repositories: vendorSources.map((s) => ({
        id: s.id,
        url: s.url,
        commit: s.commit,
        license: s.license,
      })),
    };
    if (adapter.vendor === 'stm32') {
      entry.openPinDataCommit =
        vendorSources.find((s) => s.id === 'stm32-open-pin-data')?.commit ?? 'unknown';
    }
    out[adapter.vendor] = entry;
  }
  return out;
}

/** Runs the full pipeline for the supplied adapters. */
export function generateCatalog(
  root: string = process.cwd(),
  adapters: VendorAdapter[] = DEFAULT_ADAPTERS,
): GenerationSummary {
  const startedAt = Date.now();
  const paths = pathsFor(root);

  // Deduplicate source declarations across adapters, preserving order.
  const sourceSpecs = Array.from(
    new Map(adapters.flatMap((a) => a.sourceSpecs).map((spec) => [spec.id, spec])).values(),
  );
  const sources = acquireSources(sourceSpecs);
  resetOutputDir(paths);

  const warnings = createWarningCollector();
  const results: AdapterResult[] = [];
  for (const adapter of adapters) {
    const adapterSources = sources.filter((s) =>
      adapter.sourceSpecs.some((spec) => spec.id === s.id),
    );
    results.push(adapter.generate({ paths, sources: adapterSources, warnings }));
  }
  if (results.length === 0) {
    throw new Error('Catalog generation failed: no vendor adapters registered.');
  }

  const allChips = new Map<string, ChipData>();
  const chipsByVendor = new Map<VendorId, Map<string, ChipData>>();
  for (const result of results) {
    chipsByVendor.set(result.vendor, result.chips);
    for (const [id, chip] of result.chips) {
      if (allChips.has(id)) {
        throw new Error(`Catalog generation failed: duplicate chip id ${id} across vendors.`);
      }
      allChips.set(id, chip);
    }
  }

  const bytesByVendor = writeChipShards(paths, chipsByVendor);
  const index: CatalogIndexEntry[] = results
    .flatMap((r) => r.index)
    .sort((a, b) => a.id.localeCompare(b.id));
  const indexBytes = writeIndexFile(paths, index);
  const totalBytes = Array.from(bytesByVendor.values()).reduce((a, b) => a + b, 0) + indexBytes;

  // Per-vendor gates: strict vendors fail, lenient vendors record notes as warnings.
  const gateResults: GateResult[] = [];
  const errors: string[] = [];
  const vendorStats: GenerationSummary['vendorStats'] = [];
  for (const adapter of adapters) {
    const result = results.find((r) => r.vendor === adapter.vendor)!;
    const matchRate =
      result.totalVariants > 0 ? (result.matchedVariants / result.totalVariants) * 100 : 0;
    const gateCtx: GateContext = {
      paths,
      chips: result.chips,
      index: result.index,
      totalVariants: result.totalVariants,
      matchedVariants: result.matchedVariants,
      matchRate,
      totalBytes,
      warnings: warnings.all(),
    };
    const evaluated = evaluateGates(adapter.gates, gateCtx);
    gateResults.push(...evaluated.results);
    if (adapter.strict) {
      errors.push(...evaluated.errors);
    } else {
      for (const note of evaluated.notes) {
        warnings.add({ vendor: adapter.vendor, reason: note });
      }
      for (const err of evaluated.errors) {
        warnings.add({ vendor: adapter.vendor, reason: err });
      }
    }
    vendorStats.push({
      vendor: adapter.vendor,
      chipCount: result.index.length,
      matchRate,
      warnings: warnings.countFor(adapter.vendor),
      bytes: bytesByVendor.get(adapter.vendor) ?? 0,
    });
  }

  const generatedAt = new Date().toISOString();
  const totalVariants = results.reduce((n, r) => n + r.totalVariants, 0);
  const matchedVariants = results.reduce((n, r) => n + r.matchedVariants, 0);
  const legacyResult = results.find((r) => r.vendor === 'stm32') ?? results[0];
  const legacyRate =
    legacyResult.totalVariants > 0
      ? (legacyResult.matchedVariants / legacyResult.totalVariants) * 100
      : 0;
  const meta = buildMetaDocument(
    generatedAt,
    {
      stm32DataCommit:
        sources.find((s) => s.id === 'embassy-stm32-data')?.commit ??
        sources[sources.length - 1]?.commit ??
        'unknown',
      openPinDataCommit:
        sources.find((s) => s.id === 'stm32-open-pin-data')?.commit ??
        sources[0]?.commit ??
        'unknown',
      chipCount: index.length,
      matchRate: legacyRate,
      families: Array.from(new Set(results.flatMap((r) => r.families))).sort(),
    },
    buildVendorSourcesMeta(adapters, sources, results),
  );
  writeMetaFile(paths, meta);

  const warningsDoc = buildWarningsDocument(generatedAt, warnings.all(), {
    totalVariants,
    matchedVariants,
    matchRate: meta.matchRate ?? 0,
  });
  writeWarningsFile(paths, warningsDoc);

  logSummary(startedAt, vendorStats, warningsDoc, meta, totalBytes, indexBytes);

  if (errors.length > 0) {
    throw new Error(`Catalog generation failed gate checks:\n  ${errors.join('\n  ')}`);
  }

  return { meta, warnings: warningsDoc, gateResults, vendorStats, totalBytes };
}

function logSummary(
  startedAt: number,
  vendorStats: GenerationSummary['vendorStats'],
  warningsDoc: WarningsDocument,
  meta: CatalogMeta,
  totalBytes: number,
  indexBytes: number,
): void {
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log('\nPer-vendor gate summary:');
  for (const stat of vendorStats) {
    console.log(
      `  ${stat.vendor}: ${stat.chipCount} chips, ${stat.matchRate.toFixed(2)}% match, ${stat.warnings} warnings, ${(stat.bytes / (1024 * 1024)).toFixed(2)} MB`,
    );
  }
  console.log(`  warnings by vendor: ${JSON.stringify(warningsDoc.warningsByVendor)}`);
  console.log(`  total: ${meta.chipCount} chips, ${warningsDoc.warningCount} warnings`);
  console.log(`\nData generation complete in ${elapsedSec}s`);
  console.log(`  Emitted MCUs : ${meta.chipCount}`);
  console.log(`  Match rate   : ${warningsDoc.matchRate.toFixed(2)}% (${warningsDoc.matchedVariants}/${warningsDoc.totalVariants})`);
  console.log(`  Warnings     : ${warningsDoc.warningCount} (written to public/data/build-warnings.json)`);
  console.log(`  Index size   : ${(indexBytes / 1024).toFixed(1)} KB uncompressed`);
  console.log(`  Total output : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB uncompressed`);
  console.log(`  Families     : ${meta.families.join(', ')}`);
}

function main(): void {
  generateCatalog();
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
