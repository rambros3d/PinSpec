/** Strict, build-blocking gates for the Nordic adapter. */
import { findInvalidValues } from '../../gates';
import type { Gate, GateContext, GateResult } from '../../types';
import { readKicadSymbol } from './kicad';
import { readPselFunctions } from './pinctrl';
import { readSvd } from './svd';
import { NORDIC_PILOTS } from './parts';

function result(name: string, errors: string[], notes: string[] = []): GateResult {
  return { vendor: 'nordic', name, errors, notes };
}

const REFERENCE = NORDIC_PILOTS[0];

/** nRF52840-QIAA pin set, peripheral inventory, and PSEL evidence. */
export function createNordicReferenceGate(): Gate {
  return {
    name: 'nordic-reference-parts',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const chip = ctx.chips.get(REFERENCE.id);
      if (!chip) {
        return result('nordic-reference-parts', [`nordic gate: ${REFERENCE.id} shard is missing.`]);
      }
      if (chip.vendor !== 'nordic' || chip.muxModel !== 'psel') {
        errors.push('nordic gate: reference chip does not declare vendor nordic and muxModel psel.');
      }
      let symbolPins: string[] = [];
      try {
        symbolPins = readKicadSymbol(ctx.paths.cacheDir, REFERENCE.symbol).pins.map(
          (pin) => `${pin.number}:${pin.name}`,
        );
      } catch {
        errors.push('nordic gate: KiCad reference symbol is unavailable.');
      }
      if (symbolPins.length > 0) {
        const emitted = new Set(chip.pins.map((pin) => `${pin.pos}:${pin.name}`));
        if (emitted.size !== symbolPins.length) {
          errors.push(
            `nordic gate: emitted ${emitted.size} pins, KiCad symbol declares ${symbolPins.length}.`,
          );
        }
        for (const pin of symbolPins) {
          if (!emitted.has(pin)) errors.push(`nordic gate: symbol pin ${pin} is missing from the shard.`);
        }
      }
      try {
        const svd = readSvd(ctx.paths.cacheDir, REFERENCE.svds[0]);
        const inventory = new Set(
          svd.peripherals.flatMap((name) => [name, name.replace(/_(S|NS)$/, '')]),
        );
        const expected = new Set<string>();
        for (const func of readPselFunctions(ctx.paths.cacheDir)) {
          if (inventory.has(func.peripheral)) expected.add(func.peripheral);
          else if (inventory.has(func.peripheral.replace(/0$/, ''))) {
            expected.add(func.peripheral.replace(/0$/, ''));
          }
        }
        const missing = Array.from(expected).filter((name) => !(name in chip.peripherals));
        if (missing.length > 0) {
          errors.push(
            `nordic gate: ${missing.length}/${expected.size} SVD-backed PSEL peripherals are absent (${missing.slice(0, 5).join(', ')}).`,
          );
        }
      } catch {
        errors.push('nordic gate: SVD or pinctrl reference file is unavailable.');
      }
      const psel = chip.pins.flatMap((pin) => pin.signals).filter((sig) =>
        sig.funcLabel !== undefined && sig.af === null,
      );
      if (psel.length === 0) {
        errors.push('nordic gate: no PSEL funcLabel with a null AF was emitted.');
      }
      return result('nordic-reference-parts', errors);
    },
  };
}

/** Reject non-finite or undefined values before any shard is written. */
export function createNordicShardValuesGate(): Gate {
  return {
    name: 'nordic-shard-values',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      for (const [id, chip] of ctx.chips) {
        if (chip.vendor !== 'nordic') continue;
        for (const problem of findInvalidValues(chip, `shard ${id}`)) {
          errors.push(`nordic gate: ${problem}`);
        }
      }
      return result('nordic-shard-values', errors);
    },
  };
}

/** Require all three Nordic source revisions and a non-empty vendor summary. */
export function createNordicProvenanceGate(): Gate {
  return {
    name: 'nordic-provenance',
    evaluate(ctx: GateContext): GateResult {
      const errors: string[] = [];
      const resolved = ctx.sources ?? [];
      const ids = ['nrf-pacs', 'zephyr-nordic', 'kicad-mcu-nordic'];
      for (const id of ids) {
        const source = resolved.find((item) => item.id === id);
        if (!source || !source.commit || !source.url || !source.license) {
          errors.push(`nordic gate: provenance source ${id} is incomplete.`);
        }
      }
      const canonical = ctx.meta?.sources;
      if (ctx.meta) {
        if (!canonical?.['nrf-pacs']?.sha || !canonical['nrf-pacs'].url || !canonical['nrf-pacs'].license) {
          errors.push('nordic gate: meta.json has no complete nrf-pacs record.');
        }
        const repositories = canonical?.nordic?.repositories ?? [];
        for (const id of ids) {
          if (!repositories.some((repo) => repo.id === id)) {
            errors.push(`nordic gate: vendor summary omits ${id}.`);
          }
        }
      }
      if (ctx.index.length === 0) {
        errors.push('nordic gate: no emitted parts for the vendor summary.');
      }
      return result('nordic-provenance', errors);
    },
  };
}

/** All Nordic gates in declaration order. */
export function createNordicGates(): Gate[] {
  return [
    createNordicReferenceGate(),
    createNordicShardValuesGate(),
    createNordicProvenanceGate(),
  ];
}
