/** Strict, build-blocking gates for the ESP32 adapter. */
import { findInvalidValues } from '../../gates';
import type { Gate, GateContext, GateResult } from '../../types';
import { readEspIdfSignalCounts } from './esp-idf';
import { readEspMetadata } from './metadata';

function result(name: string, errors: string[], notes: string[] = []): GateResult {
  return { vendor: 'esp32', name, errors, notes };
}

const REQUIRED_SOURCE_IDS = ['esp-gpio-tool', 'esp-hal-metadata', 'espressif-kicad', 'esp-idf'];

/** Reference geometry and electrical facts that must be present in the catalog. */
export function createEsp32ReferenceGate(): Gate {
  return {
    name: 'esp32-reference-parts',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const c3 = ctx.chips.get('ESP32-C3');
      if (!c3) {
        errors.push('esp32 gate: ESP32-C3 reference shard is missing.');
      } else {
        if (c3.pins.length !== 32) {
          errors.push(`esp32 gate: ESP32-C3 has ${c3.pins.length} pads, expected 32.`);
        }
        if (!c3.package.hasExposedPad) {
          errors.push('esp32 gate: ESP32-C3 has no exposed pad.');
        }
        const pad6 = c3.pins.find((pin) => pin.pos === '6');
        if (!pad6?.name.includes('GPIO2')) {
          errors.push('esp32 gate: ESP32-C3 pad 6 is not GPIO2.');
        }
        if (!pad6?.tags?.includes('strapping')) {
          errors.push('esp32 gate: ESP32-C3 GPIO2 is missing the strapping fact.');
        }
      }
      const c3fh4 = ctx.chips.get('ESP32-C3FH4');
      if (!c3fh4) {
        errors.push('esp32 gate: ESP32-C3FH4 reference shard is missing.');
      } else {
        for (const pos of ['12', '13', '14', '15', '16', '17']) {
          if (!c3fh4.pins.find((pin) => pin.name.includes(`GPIO${pos}`))?.tags?.includes('flash')) {
            errors.push(`esp32 gate: ESP32-C3FH4 GPIO${pos} is not flash-reserved.`);
          }
        }
      }
      const wroom = ctx.chips.get('ESP32-WROOM-E');
      if (!wroom) {
        errors.push('esp32 gate: ESP32-WROOM-E reference shard is missing.');
      } else {
        const pad25 = wroom.pins.find((pin) => pin.pos === '25');
        if (!pad25?.name.includes('GPIO0') || !pad25.name.includes('BOOT')) {
          errors.push('esp32 gate: ESP32-WROOM-E pad 25 is not GPIO0/BOOT.');
        }
        const pad3 = wroom.pins.find((pin) => pin.pos === '3');
        if (!pad3?.name.includes('EN')) {
          errors.push('esp32 gate: ESP32-WROOM-E pad 3 is not EN.');
        }
      }
      const base = ctx.chips.get('ESP32');
      if (!base) {
        errors.push('esp32 gate: ESP32 reference shard is missing.');
      } else {
        for (const gpio of [34, 35, 36, 37, 38, 39]) {
          const pin = base.pins.find((p) => p.name.includes(`GPIO${gpio}`));
          if (!pin?.tags?.includes('input-only')) {
            errors.push(`esp32 gate: ESP32 GPIO${gpio} is not input-only.`);
          }
        }
      }
      return result('esp32-reference-parts', errors);
    },
  };
}

/** Cross-check emitted matrix signal counts against the pinned ESP-IDF header. */
export function createEsp32MatrixGate(): Gate {
  return {
    name: 'esp32-matrix-counts',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const counts = readEspIdfSignalCounts(ctx.paths.cacheDir);
      if (!counts) {
        errors.push('esp32 gate: pinned gpio_sig_map.h is unavailable.');
        return result('esp32-matrix-counts', errors);
      }
      const device = readEspMetadata(ctx.paths.cacheDir).get('esp32c3');
      if (!device) {
        errors.push('esp32 gate: ESP32-C3 esp-metadata is unavailable.');
        return result('esp32-matrix-counts', errors);
      }
      if (counts.inputCount < 10 || counts.outputCount < 10) {
        errors.push(
          `esp32 gate: gpio_sig_map.h exposes ${counts.inputCount} inputs and ${counts.outputCount} outputs, too few for a count cross-check.`,
        );
      }
      const metadataIds = new Set(
        [...device.inputSignals, ...device.outputSignals]
          .filter((signal) => signal.id !== null)
          .map((signal) => signal.name),
      );
      const shared = Array.from(counts.matchedNames).filter((name) => metadataIds.has(name));
      if (shared.length < 10) {
        errors.push(
          `esp32 gate: only ${shared.length} pinned signals match esp-metadata; expected at least ten.`,
        );
      }
      const p4 = readEspMetadata(ctx.paths.cacheDir).get('esp32p4');
      if (!p4 || p4.funcInSelOffset !== 1) {
        errors.push('esp32 gate: P4 func_in_sel_offset is not 1.');
      }
      return result('esp32-matrix-counts', errors);
    },
  };
}

/** Reject non-finite or undefined values before any shard is written. */
export function createEsp32ShardValuesGate(): Gate {
  return {
    name: 'esp32-shard-values',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      for (const [id, chip] of ctx.chips) {
        if (chip.vendor !== 'esp32') continue;
        for (const problem of findInvalidValues(chip, `shard ${id}`)) errors.push(`esp32 gate: ${problem}`);
      }
      return result('esp32-shard-values', errors);
    },
  };
}

/** Require all four ESP32 source records and the esp32 vendor summary. */
export function createEsp32ProvenanceGate(): Gate {
  return {
    name: 'esp32-provenance',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const resolved = ctx.sources ?? [];
      for (const id of REQUIRED_SOURCE_IDS) {
        const record = resolved.find((source) => source.id === id);
        if (!record || !record.commit || !record.url || !record.license) {
          errors.push(`esp32 gate: provenance source ${id} is incomplete.`);
        }
      }
      if (ctx.index.length <= 0 || !Number.isFinite(ctx.matchRate)) {
        errors.push('esp32 gate: provenance vendor summary is incomplete.');
      }
      return result('esp32-provenance', errors);
    },
  };
}

/**
 * Require generated module identity on module shards, its absence on dies and
 * MPNs, and agreement between every index marker and its shard.
 */
export function createEsp32ModuleGate(): Gate {
  return {
    name: 'esp32-module-metadata',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const wroom = ctx.chips.get('ESP32-WROOM-E');
      if (
        !wroom?.module ||
        wroom.module.kind !== 'module' ||
        !wroom.module.name ||
        !wroom.module.baseFamily ||
        !wroom.module.symbol
      ) {
        errors.push('esp32 gate: ESP32-WROOM-E has no generated module record.');
      }
      for (const dieId of ['ESP32-C3', 'ESP32-C3FH4']) {
        if (ctx.chips.get(dieId)?.module) {
          errors.push(`esp32 gate: ${dieId} declares module metadata without module evidence.`);
        }
      }
      for (const entry of ctx.index) {
        const hasRecord = Boolean(ctx.chips.get(entry.id)?.module);
        const hasMarker = entry.module === true;
        if (hasRecord !== hasMarker) {
          errors.push(`esp32 gate: ${entry.id} index module marker disagrees with its shard.`);
        }
      }
      return result('esp32-module-metadata', errors);
    },
  };
}

/** All ESP32 gates in declaration order. */
export function createEsp32Gates(): Gate[] {
  return [
    createEsp32ReferenceGate(),
    createEsp32MatrixGate(),
    createEsp32ShardValuesGate(),
    createEsp32ProvenanceGate(),
    createEsp32ModuleGate(),
  ];
}
