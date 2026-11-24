/** Reusable per-vendor gate helpers. */
import type { VendorId } from '../../src/core/types';
import type { Gate, GateContext, GateResult } from './types';

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

/** Runs a vendor's gates against one catalog view. */
export function evaluateGates(
  gates: Gate[],
  ctx: GateContext,
): { results: GateResult[]; errors: string[]; notes: string[] } {
  const results = gates.map((gate) => gate.evaluate(ctx));
  return {
    results,
    errors: results.flatMap((r) => r.errors),
    notes: results.flatMap((r) => r.notes),
  };
}
