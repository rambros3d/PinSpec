/**
 * Pure, host-testable gate helpers shared by the orchestrator and unit tests.
 *
 * Per-vendor gates live in the adapters; the `create*Gate` factories below are
 * the orchestrator-level checks that certify the emitted catalog as a whole.
 * Every factory returns a `Gate`, so local `npm run gen-data` and CI evaluate
 * exactly the same assertions.
 */
import {
  CATALOG_SOURCE_IDS,
  getChipVendor,
  type CatalogSourceRecord,
  type VendorId,
} from '../../src/core/types';
import type { WarningsDocument } from './artifacts';
import type { Gate, GateContext, GateResult } from './types';

/** Uncompressed JSON budget for `public/data/` (GitHub Pages safeguard). */
export const MAX_CATALOG_BYTES = 150 * 1024 * 1024;

/** Collected results of one gate suite. */
export interface GateOutcome {
  results: GateResult[];
  errors: string[];
  notes: string[];
}

/**
 * Lenient gate for vendors that are still landing incrementally: a missing
 * reference part or shortfall is reported as a note, not a build failure.
 */
export function createReferencePartsGate(vendor: VendorId, requiredIds: string[]): Gate {
  return {
    name: `${vendor}-reference-parts`,
    evaluate(ctx: GateContext): GateResult {
      const notes: string[] = [];
      for (const id of requiredIds) {
        if (!ctx.chips.has(id)) {
          notes.push(`${vendor} gate note: expected reference chip ${id} was not emitted.`);
        }
      }
      return { vendor, name: `${vendor}-reference-parts`, errors: [], notes };
    },
  };
}

/** Lenient minimum-count gate; shortfalls become warnings for non-strict vendors. */
export function createMinCountGate(vendor: VendorId, minCount: number): Gate {
  return {
    name: `${vendor}-min-count`,
    evaluate(ctx: GateContext): GateResult {
      const notes: string[] = [];
      if (ctx.index.length < minCount) {
        notes.push(
          `${vendor} gate note: emitted ${ctx.index.length} chips, below expected ${minCount}.`,
        );
      }
      return { vendor, name: `${vendor}-min-count`, errors: [], notes };
    },
  };
}

/** Evaluates every gate, preserving declaration order. */
export function evaluateGates(gates: Gate[], ctx: GateContext): GateOutcome {
  const results = gates.map((gate) => gate.evaluate(ctx));
  return {
    results,
    errors: results.flatMap((r) => r.errors),
    notes: results.flatMap((r) => r.notes),
  };
}

/**
 * Evaluates gates in order. With `failFast` (the orchestrator default) the
 * first failing gate stops the suite so the build reports the earliest cause.
 */
export function runGateSuite(gates: Gate[], ctx: GateContext, failFast = true): GateOutcome {
  const results: GateResult[] = [];
  for (const gate of gates) {
    const result = gate.evaluate(ctx);
    results.push(result);
    if (failFast && result.errors.length > 0) break;
  }
  return {
    results,
    errors: results.flatMap((r) => r.errors),
    notes: results.flatMap((r) => r.notes),
  };
}

/**
 * Recursively finds `NaN`, infinities, and `undefined` in a catalog value.
 * `JSON.stringify` silently turns these into `null` or omits them, so the gate
 * inspects the in-memory object before it is serialized.
 */
export function findInvalidValues(value: unknown, path = '$'): string[] {
  if (value === undefined) return [`${path}=undefined`];
  if (typeof value === 'number' && !Number.isFinite(value)) return [`${path}=${String(value)}`];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findInvalidValues(item, `${path}[${i}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      findInvalidValues(item, `${path}.${key}`),
    );
  }
  return [];
}

/** Fails when the summed shard/index bytes reach the 150 MB budget. */
export function createArtifactBudgetGate(maxBytes: number = MAX_CATALOG_BYTES): Gate {
  return {
    name: 'artifact-budget',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      if (!Number.isFinite(ctx.totalBytes) || ctx.totalBytes >= maxBytes) {
        errors.push(
          `artifact gate failed: total output ${(ctx.totalBytes / (1024 * 1024)).toFixed(2)} MB ` +
            `(${ctx.totalBytes} bytes) exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB budget.`,
        );
      }
      return { vendor: 'stm32', name: 'artifact-budget', errors, notes: [] };
    },
  };
}

/** Checks that every index entry resolves to a consistent, parseable shard. */
export function createShardIntegrityGate(): Gate {
  return {
    name: 'shard-integrity',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      for (const entry of ctx.index) {
        const problems: string[] = [];
        const chip = ctx.chips.get(entry.id);
        if (!chip) {
          problems.push('missing chip payload');
        } else {
          if (chip.id !== entry.id) problems.push(`chip id ${chip.id} disagrees with index id`);
          const vendor = getChipVendor(chip);
          if (vendor !== (entry.vendor ?? 'stm32')) {
            problems.push(`vendor ${vendor} disagrees with index vendor ${entry.vendor ?? 'stm32'}`);
          }
          if (chip.pins.length !== entry.pinCount || chip.package.pinCount !== entry.pinCount) {
            problems.push(
              `pin count ${chip.pins.length}/${chip.package.pinCount} disagrees with index ${entry.pinCount}`,
            );
          }
          problems.push(...findInvalidValues(chip, `shard ${entry.id}`));
        }
        const shard = ctx.serializedShards?.get(entry.id);
        if (ctx.serializedShards && shard === undefined) {
          problems.push('missing serialized shard');
        } else if (shard !== undefined) {
          try {
            JSON.parse(shard);
          } catch {
            problems.push('shard is not parseable JSON');
          }
        }
        if (problems.length > 0) errors.push(`shard gate failed for ${entry.id}: ${problems.join('; ')}.`);
      }
      return { vendor: 'stm32', name: 'shard-integrity', errors, notes: [] };
    },
  };
}

/** Requires complete source SHAs, licenses, and per-vendor counts/ratios. */
export function createProvenanceGate(
  expectedSourceIds: readonly string[] = CATALOG_SOURCE_IDS,
): Gate {
  return {
    name: 'provenance',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const meta = ctx.meta;
      if (!meta) {
        errors.push('provenance gate failed: meta.json document was not built.');
        return { vendor: 'stm32', name: 'provenance', errors, notes: [] };
      }
      if (!meta.generatedAt || meta.generatedAt.trim() === '') {
        errors.push('provenance gate failed: generatedAt is missing.');
      }
      const sources = (meta.sources ?? {}) as Record<string, CatalogSourceRecord | undefined>;
      for (const id of expectedSourceIds) {
        const record = sources[id];
        if (!record) {
          errors.push(`provenance gate failed: missing source record ${id}.`);
          continue;
        }
        for (const key of ['sha', 'url', 'license'] as const) {
          const value = record[key];
          if (typeof value !== 'string' || value.trim() === '') {
            errors.push(`provenance gate failed: source ${id} has no ${key}.`);
          }
        }
      }
      for (const vendor of ['stm32', 'ch32', 'rp'] as VendorId[]) {
        const entry = meta.sources?.[vendor];
        if (!entry) continue;
        if (!Number.isFinite(entry.chipCount) || entry.chipCount < 0) {
          errors.push(`provenance gate failed: ${vendor} has no valid chipCount.`);
        }
        if (
          !entry.ratios ||
          !Number.isFinite(entry.ratios.match) ||
          !Number.isFinite(entry.ratios.coverage)
        ) {
          errors.push(`provenance gate failed: ${vendor} has no match/coverage ratios.`);
        }
      }
      if (meta.chipCount !== ctx.index.length) {
        errors.push(
          `provenance gate failed: meta chipCount ${meta.chipCount} disagrees with index ${ctx.index.length}.`,
        );
      }
      return { vendor: 'stm32', name: 'provenance', errors, notes: [] };
    },
  };
}

/** Requires the always-present, fully attributed build-warnings document. */
export function createWarningsContractGate(): Gate {
  return {
    name: 'warnings-contract',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const doc: WarningsDocument | undefined = ctx.warningDoc;
      if (!doc || !Array.isArray(doc.warnings)) {
        errors.push('warnings gate failed: build-warnings.json document was not built.');
        return { vendor: 'stm32', name: 'warnings-contract', errors, notes: [] };
      }
      doc.warnings.forEach((warning, index) => {
        for (const field of ['id', 'vendor', 'source', 'reason'] as const) {
          const value = warning[field];
          if (typeof value !== 'string' || value.trim() === '') {
            errors.push(`warnings gate failed: warning ${index} has no ${field}.`);
          }
        }
      });
      if (doc.warningCount !== doc.warnings.length) {
        errors.push(
          `warnings gate failed: warningCount ${doc.warningCount} disagrees with ${doc.warnings.length} records.`,
        );
      }
      return { vendor: 'stm32', name: 'warnings-contract', errors, notes: [] };
    },
  };
}

/** The global gate suite appended to every adapter's per-vendor gates. */
export function createGlobalGates(expectedSourceIds: readonly string[] = CATALOG_SOURCE_IDS): Gate[] {
  return [
    createArtifactBudgetGate(),
    createShardIntegrityGate(),
    createProvenanceGate(expectedSourceIds),
    createWarningsContractGate(),
  ];
}
