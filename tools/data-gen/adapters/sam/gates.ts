/** Strict, build-blocking gates for the Microchip SAM adapter. */
import { findInvalidValues } from '../../gates';
import type { Gate, GateContext, GateResult } from '../../types';
import { SAM_PART_COUNT } from './variants';
import { SAM_SOURCE_ID } from './sources';

function result(name: string, errors: string[], notes: string[] = []): GateResult {
  return { vendor: 'microchip', name, errors, notes };
}

/** Exact part count and reference geometry, mux, and AF evidence. */
export function createSamReferenceGate(): Gate {
  return {
    name: 'sam-reference-parts',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      if (ctx.index.length !== SAM_PART_COUNT) {
        errors.push(
          `microchip gate: emitted ${ctx.index.length} parts, expected exactly ${SAM_PART_COUNT}.`,
        );
      }
      const expected: Record<string, number> = {
        ATSAMD21G18A: 48,
        ATSAME51J20A: 64,
        ATSAMV71Q21B: 144,
      };
      for (const [id, pinCount] of Object.entries(expected)) {
        const chip = ctx.chips.get(id);
        if (!chip) {
          errors.push(`microchip gate: reference part ${id} is missing.`);
          continue;
        }
        if (chip.pins.length !== pinCount) {
          errors.push(`microchip gate: ${id} has ${chip.pins.length} pins, expected ${pinCount}.`);
        }
        if (chip.vendor !== 'microchip' || chip.muxModel !== 'af') {
          errors.push(`microchip gate: ${id} does not declare vendor microchip and muxModel af.`);
        }
      }
      const d21 = ctx.chips.get('ATSAMD21G18A');
      if (d21 && !d21.pins.some((pin) => pin.signals.some((sig) => sig.af !== null))) {
        errors.push('microchip gate: ATSAMD21G18A has no function-letter AF index.');
      }
      const d51 = ctx.chips.get('ATSAMD51P20A');
      if (!d51) {
        errors.push('microchip gate: reference part ATSAMD51P20A is missing.');
      } else {
        for (const [pkg, pinCount] of [
          ['TQFP128', 128],
          ['TFBGA120', 120],
        ] as const) {
          const pinout = d51.pinouts?.find((item) => item.package === pkg);
          if (!pinout || pinout.pinCount !== pinCount) {
            errors.push(
              `microchip gate: ATSAMD51P20A has no ${pkg} pinout with ${pinCount} pins.`,
            );
          }
        }
      }
      return result('sam-reference-parts', errors);
    },
  };
}

/** Reject non-finite or undefined values before any shard is written. */
export function createSamShardValuesGate(): Gate {
  return {
    name: 'sam-shard-values',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      for (const [id, chip] of ctx.chips) {
        for (const problem of findInvalidValues(chip, `shard ${id}`)) {
          errors.push(`microchip gate: ${problem}`);
        }
      }
      return result('sam-shard-values', errors);
    },
  };
}

/** Require the raw ATDF SHA, URL, license, and vendor summary. */
export function createSamProvenanceGate(): Gate {
  return {
    name: 'sam-provenance',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const source = (ctx.sources ?? []).find((item) => item.id === SAM_SOURCE_ID);
      if (!source || !source.commit || !source.license || !source.url) {
        errors.push('microchip gate: microchip-atdf provenance is incomplete.');
      }
      const metaSource = ctx.meta?.sources?.[SAM_SOURCE_ID];
      if (ctx.meta && (!metaSource?.sha || !metaSource.url || !metaSource.license)) {
        errors.push('microchip gate: meta.json has no complete microchip-atdf record.');
      }
      if (ctx.index.length === 0) {
        errors.push('microchip gate: no emitted parts for the microchip vendor summary.');
      }
      return result('sam-provenance', errors);
    },
  };
}

/** All SAM gates in declaration order. */
export function createSamGates(): Gate[] {
  return [createSamReferenceGate(), createSamShardValuesGate(), createSamProvenanceGate()];
}
