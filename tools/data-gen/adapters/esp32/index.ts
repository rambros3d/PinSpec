/**
 * ESP32 vendor adapter. All chip facts come from the four acquired upstream
 * sources; no literal pin tables are kept in this repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CatalogIndexEntry, ChipData } from '../../../../src/core/types';
import { esp32SourceSpecs, ESP_KICAD_FILES } from '../../sources';
import type { AdapterContext, AdapterResult, VendorAdapter } from '../../types';
import { readEspIdfSignalCounts } from './esp-idf';
import { readGpioToolTargets, displayFamily } from './gpio-tool';
import { createEsp32Gates } from './gates';
import { buildEspChip } from './join';
import { parseEspKicadFootprint, parseEspKicadSymbols } from './kicad';
import { readEspMetadata } from './metadata';
import { buildEspModules, symbolForFamily } from './modules';
import type { KicadFootprint, KicadSymbol } from './types';

/** Index counts mirror the declarative peripheral kinds used by the solver. */
function indexEntry(chip: ChipData): CatalogIndexEntry {
  const counts = { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 };
  for (const info of Object.values(chip.peripherals)) {
    if (info.kind === 'spi') counts.spi++;
    else if (info.kind === 'i2c') counts.i2c++;
    else if (info.kind === 'usart') counts.usart++;
    else if (info.kind === 'can') counts.can++;
    else if (info.kind === 'usb') counts.usb++;
    else if (info.kind === 'pwm' || info.kind === 'tim') counts.tim++;
    else if (info.kind === 'adc') counts.adc++;
  }
  return {
    id: chip.id,
    vendor: 'esp32',
    family: chip.family,
    core: chip.core,
    package: chip.package.name,
    pinCount: chip.package.pinCount,
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    peripherals: counts,
  };
}

function readSymbols(cacheDir: string): Map<string, KicadSymbol> {
  const file = path.join(cacheDir, 'espressif-kicad', 'symbols', 'Espressif.kicad_sym');
  if (!fs.existsSync(file)) return new Map();
  return parseEspKicadSymbols(fs.readFileSync(file, 'utf8'));
}

function readFootprints(cacheDir: string): Map<string, KicadFootprint> {
  const out = new Map<string, KicadFootprint>();
  for (const file of ESP_KICAD_FILES.filter((name) => name.endsWith('.kicad_mod'))) {
    const target = path.join(cacheDir, 'espressif-kicad', file);
    if (!fs.existsSync(target)) continue;
    const footprint = parseEspKicadFootprint(
      fs.readFileSync(target, 'utf8'),
      path.basename(file, '.kicad_mod'),
    );
    out.set(footprint.name, footprint);
  }
  return out;
}

function dieFootprint(family: string, footprints: Map<string, KicadFootprint>): KicadFootprint | undefined {
  const preferred =
    family === 'esp32c3'
      ? 'QFN-32-1EP_4x4mm_P0.4mm_EP2.9x2.9mm'
      : 'QFN-48-1EP_5x5mm_P0.35mm_EP3.7x3.7mm';
  return footprints.get(preferred);
}

/** Generate every available die, MPN, and module shard. */
export function generateEsp32(ctx: AdapterContext): AdapterResult {
  const targets = readGpioToolTargets(ctx.paths.cacheDir);
  const metadata = readEspMetadata(ctx.paths.cacheDir);
  const symbols = readSymbols(ctx.paths.cacheDir);
  const footprints = readFootprints(ctx.paths.cacheDir);
  const modules = buildEspModules(symbols, targets);
  const signalCounts = readEspIdfSignalCounts(ctx.paths.cacheDir);

  const chips = new Map<string, ChipData>();
  const index: CatalogIndexEntry[] = [];
  const families = Array.from(new Set([...targets.keys(), ...metadata.keys()])).sort();
  // Module symbols may contain slashes (for example "ESP32-C6-MINI-1/U");
  // shard ids must stay safe as file names.
  const safeId = (id: string): string => id.replace(/[^\w.-]/g, '_');
  const add = (rawId: string, chip: ChipData, deferred: string[]): void => {
    const id = safeId(rawId);
    if (chips.has(id)) return;
    const emitted = { ...chip, id };
    chips.set(id, emitted);
    index.push(indexEntry(emitted));
    for (const reason of deferred) {
      ctx.warnings.add({
        id,
        vendor: 'esp32',
        source: reason.includes('esp-metadata') ? 'esp-hal-metadata' : 'esp-gpio-tool',
        reason,
      });
    }
  };

  for (const family of families) {
    const device = metadata.get(family);
    if (!device) {
      ctx.warnings.add({
        id: displayFamily(family),
        vendor: 'esp32',
        source: 'esp-hal-metadata',
        reason: `${family} has no esp-metadata device facts; deferred.`,
      });
      continue;
    }
    const target = targets.get(family);
    const symbolName = symbolForFamily(displayFamily(family), symbols);
    const symbol = symbolName ? symbols.get(symbolName) : undefined;
    const footprint = dieFootprint(family, footprints);
    const die = buildEspChip(displayFamily(family), family, { target, device, symbol, footprint });
    add(die.chip.id, die.chip, die.deferred);

    for (const soc of target?.soc.values() ?? []) {
      if (soc.flashKb === null) continue;
      const mpn = buildEspChip(soc.name, family, { target, device, symbol, footprint, soc });
      add(mpn.chip.id, mpn.chip, mpn.deferred);
    }

    for (const module of modules.filter((item) => item.baseFamily === family)) {
      const moduleSymbol = symbols.get(module.symbol);
      const footprintName = (moduleSymbol?.footprint ?? '').split(':')[1] ?? '';
      const moduleFootprint = footprints.get(footprintName) ?? footprint;
      const built = buildEspChip(module.id, family, {
        target,
        device,
        symbol: moduleSymbol,
        footprint: moduleFootprint,
        module,
      });
      if (module.flashEvidence === 'none') {
        ctx.warnings.add({
          id: module.id,
          vendor: 'esp32',
          source: 'espressif-kicad',
          reason: `${module.id} has no first-party flash capacity evidence; emitted with flashKb null.`,
        });
      }
      add(built.chip.id, built.chip, built.deferred);
    }
  }

  if (!signalCounts) {
    ctx.warnings.add({
      id: 'esp-idf',
      vendor: 'esp32',
      source: 'esp-idf',
      reason: 'Pinned gpio_sig_map.h is unavailable; matrix count gate will fail.',
    });
  }

  return {
    vendor: 'esp32',
    chips,
    index,
    families: families.map(displayFamily),
    totalVariants: families.length,
    matchedVariants: families.filter((family) => chips.has(displayFamily(family))).length,
  };
}

/** Registered ESP32 adapter and its strict gate list. */
export const esp32Adapter: VendorAdapter = {
  vendor: 'esp32',
  sourceSpecs: esp32SourceSpecs(),
  primarySourceId: 'esp-gpio-tool',
  strict: true,
  generate: generateEsp32,
  gates: createEsp32Gates(),
};

export { createEsp32Gates } from './gates';
