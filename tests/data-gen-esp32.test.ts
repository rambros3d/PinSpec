import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_SOURCE_IDS, type ChipData } from '../src/core/types';
import {
  createEsp32Gates,
  esp32Adapter,
  generateEsp32,
} from '../tools/data-gen/adapters/esp32';
import { readEspIdfSignalCounts } from '../tools/data-gen/adapters/esp32/esp-idf';
import { displayFamily, readGpioToolTargets } from '../tools/data-gen/adapters/esp32/gpio-tool';
import { buildEspChip } from '../tools/data-gen/adapters/esp32/join';
import { parseEspKicadFootprint, parseEspKicadSymbols } from '../tools/data-gen/adapters/esp32/kicad';
import { readEspMetadata } from '../tools/data-gen/adapters/esp32/metadata';
import { buildEspModules, symbolForFamily } from '../tools/data-gen/adapters/esp32/modules';
import type { EspModule } from '../tools/data-gen/adapters/esp32/types';
import { canonicalSourceId } from '../tools/data-gen/artifacts';
import { DEFAULT_ADAPTERS, generateCatalog } from '../tools/data-gen/index';
import {
  ESP_IDF_HEADER_PATHS,
  ESP_IDF_REF,
  ESP_KICAD_FILES,
  LICENSE_ESP_GPIO_TOOL,
  LICENSE_ESP_HAL_METADATA,
  LICENSE_ESP_IDF,
  LICENSE_ESPRESSIF_KICAD,
  esp32SourceSpecs,
} from '../tools/data-gen/sources';
import type { AdapterContext, GateContext } from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.cache');
const SYMBOL_FILE = path.join(CACHE, 'espressif-kicad', 'symbols', 'Espressif.kicad_sym');
const FOOTPRINT_DIR = path.join(CACHE, 'espressif-kicad', 'footprints', 'Espressif.pretty');

function gateContext(chips: Map<string, ChipData>, index: GateContext['index'] = []): GateContext {
  return {
    paths: {
      root: ROOT,
      cacheDir: CACHE,
      outDir: path.join(ROOT, 'public', 'data'),
      chipsOutDir: path.join(ROOT, 'public', 'data', 'chips'),
    },
    chips,
    index,
    totalVariants: 12,
    matchedVariants: 12,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    sources: esp32SourceSpecs(CACHE).map((spec) => ({ ...spec, commit: 'abc1234' })),
  };
}

function adapterContext(): AdapterContext {
  return {
    paths: {
      root: ROOT,
      cacheDir: CACHE,
      outDir: path.join(ROOT, 'public', 'data'),
      chipsOutDir: path.join(ROOT, 'public', 'data', 'chips'),
    },
    sources: esp32SourceSpecs(CACHE).map((spec) => ({ ...spec, commit: 'abc1234' })),
    warnings: createWarningCollector(),
  };
}

describe('ESP32 source declarations and provenance ids', () => {
  it('declares four sources with pinned ESP-IDF headers and licenses', () => {
    const specs = esp32SourceSpecs(CACHE);
    expect(specs.map((spec) => spec.id)).toEqual([
      'esp-gpio-tool',
      'esp-hal-metadata',
      'espressif-kicad',
      'esp-idf',
    ]);
    expect(specs.map((spec) => spec.license)).toEqual([
      LICENSE_ESP_GPIO_TOOL,
      LICENSE_ESP_HAL_METADATA,
      LICENSE_ESPRESSIF_KICAD,
      LICENSE_ESP_IDF,
    ]);
    expect(specs[3].rawFiles?.map((file) => file.url)).toEqual(
      ESP_IDF_HEADER_PATHS.map((file) =>
        `https://raw.githubusercontent.com/espressif/esp-idf/${ESP_IDF_REF}/${file}`,
      ),
    );
    expect(specs[2].rawFiles).toHaveLength(ESP_KICAD_FILES.length);
  });

  it('keeps thirteen canonical ids and a distinct espressif-kicad mapping', () => {
    expect(CATALOG_SOURCE_IDS).toHaveLength(13);
    expect(canonicalSourceId('espressif-kicad')).toBe('espressif-kicad');
    expect(canonicalSourceId('kicad-symbols')).toBe('kicad');
    expect(canonicalSourceId('esp-gpio-tool')).toBe('esp-gpio-tool');
    expect(canonicalSourceId('esp-hal-metadata')).toBe('esp-hal-metadata');
    expect(canonicalSourceId('esp-idf')).toBe('esp-idf');
  });

  it('registers the strict ESP32 adapter before the SAM and Nordic adapters', () => {
    expect(DEFAULT_ADAPTERS.map((adapter) => adapter.vendor)).toEqual([
      'stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic',
    ]);
    expect(esp32Adapter.strict).toBe(true);
    expect(esp32Adapter.vendor).toBe('esp32');
    expect(createEsp32Gates().map((gate) => gate.name)).toEqual([
      'esp32-reference-parts',
      'esp32-matrix-counts',
      'esp32-shard-values',
      'esp32-provenance',
      'esp32-module-metadata',
    ]);
  });
});

describe('ESP32 first-party parsers', () => {
  it('reads gpio-tool target records with strapping, reserves, and flash evidence', () => {
    const targets = readGpioToolTargets(CACHE);
    expect(targets.size).toBeGreaterThanOrEqual(9);
    const c3 = targets.get('esp32c3')!;
    expect(displayFamily('esp32c3')).toBe('ESP32-C3');
    expect(c3.gpios.get(2)?.strappingNote).toContain('pulled-up');
    expect(c3.soc.get('ESP32-C3FH4')?.flashKb).toBe(4096);
    expect(c3.soc.get('ESP32-C3FH4')?.reservedPins).toEqual([12, 13, 14, 15, 16, 17]);
    expect(c3.adc2WifiConflict).toBe(true);
    expect(c3.sramKb).toBe(400);
  });

  it('reads esp-metadata signals, limitations, and the P4 input offset', () => {
    const devices = readEspMetadata(CACHE);
    expect(devices.size).toBeGreaterThanOrEqual(12);
    const c3 = devices.get('esp32c3')!;
    expect(c3.gpios.get(2)?.limitations).toContain('strapping');
    expect(c3.inputSignals.some((signal) => signal.name === 'U0RXD' && signal.id === 6)).toBe(true);
    expect(devices.get('esp32p4')?.funcInSelOffset).toBe(1);
  });

  it('reads KiCad pad numbers, multi-function labels, and the exposed pad', () => {
    const symbols = parseEspKicadSymbols(fs.readFileSync(SYMBOL_FILE, 'utf8'));
    expect(symbolForFamily('ESP32-C3', symbols)).toBe('ESP32-C3');
    const wroom = symbols.get('ESP32-WROOM-E')!;
    expect(wroom.pins.find((pin) => pin.number === '25')?.name).toContain('GPIO0/BOOT');
    expect(wroom.pins.find((pin) => pin.number === '3')?.name).toContain('EN');
    const footprint = parseEspKicadFootprint(
      fs.readFileSync(path.join(FOOTPRINT_DIR, 'QFN-32-1EP_4x4mm_P0.4mm_EP2.9x2.9mm.kicad_mod'), 'utf8'),
      'QFN-32',
    );
    expect(footprint.numberedPads).toHaveLength(33);
    expect(footprint.hasExposedPad).toBe(true);
  });

  it('cross-checks pinned ESP-IDF signal counts', () => {
    const counts = readEspIdfSignalCounts(CACHE)!;
    expect(counts.inputCount).toBeGreaterThan(10);
    expect(counts.outputCount).toBeGreaterThan(10);
    expect(counts.matchedNames.has('U0RXD')).toBe(true);
  });
});

describe('ESP32 join and module emission', () => {
  const targets = readGpioToolTargets(CACHE);
  const devices = readEspMetadata(CACHE);
  const symbols = parseEspKicadSymbols(fs.readFileSync(SYMBOL_FILE, 'utf8'));
  const footprints = parseEspKicadFootprint(
    fs.readFileSync(path.join(FOOTPRINT_DIR, 'QFN-32-1EP_4x4mm_P0.4mm_EP2.9x2.9mm.kicad_mod'), 'utf8'),
    'QFN-32',
  );

  it('keeps first-party strapping, flash, input-only, and matrix facts', () => {
    const c3 = buildEspChip('ESP32-C3', 'esp32c3', {
      target: targets.get('esp32c3'),
      device: devices.get('esp32c3')!,
      symbol: symbols.get('ESP32-C3'),
      footprint: footprints,
    }).chip;
    expect(c3.pins).toHaveLength(32);
    expect(c3.package.hasExposedPad).toBe(true);
    expect(c3.pins.find((pin) => pin.pos === '6')?.name).toContain('GPIO2');
    expect(c3.pins.find((pin) => pin.pos === '6')?.tags).toContain('strapping');
    expect(c3.flashKb).toBeNull();

    const fh4 = buildEspChip('ESP32-C3FH4', 'esp32c3', {
      target: targets.get('esp32c3'),
      device: devices.get('esp32c3')!,
      symbol: symbols.get('ESP32-C3'),
      footprint: footprints,
      soc: targets.get('esp32c3')!.soc.get('ESP32-C3FH4'),
    }).chip;
    expect(fh4.flashKb).toBe(4096);
    for (const gpio of [12, 13, 14, 15, 16, 17]) {
      expect(fh4.pins.find((pin) => pin.name.includes(`GPIO${gpio}`))?.tags).toContain('flash');
    }

    const base = buildEspChip('ESP32', 'esp32', {
      target: targets.get('esp32'),
      device: devices.get('esp32')!,
      symbol: symbols.get('ESP32'),
      footprint: footprints,
    }).chip;
    for (const gpio of [34, 35, 36, 37, 38, 39]) {
      expect(base.pins.find((pin) => pin.name.includes(`GPIO${gpio}`))?.tags).toContain('input-only');
    }
    expect(base.pins.some((pin) => pin.signals.some((sig) => sig.direction === 'input'))).toBe(true);
  });

  it('derives modules from first-party names and defers missing flash evidence', () => {
    const modules: EspModule[] = buildEspModules(symbols, targets);
    const wroom = modules.find((module) => module.id === 'ESP32-WROOM-E');
    expect(wroom).toBeDefined();
    expect(wroom?.baseFamily).toBe('esp32');
    expect(wroom?.flashKb).toBeNull();
    expect(wroom?.flashEvidence).toBe('none');
    expect(modules.some((module) => module.id.includes('DevKit'))).toBe(false);
    const mini = modules.find((module) => module.id === 'ESP32-C3-MINI-1');
    expect(mini).toBeDefined();
  });

  it('emits twelve families, bare dies, MPNs, and attributed warnings', () => {
    const result = generateEsp32(adapterContext());
    expect(result.vendor).toBe('esp32');
    expect(result.families).toHaveLength(12);
    expect(result.index.length).toBeGreaterThanOrEqual(12);
    expect(result.index.every((entry) => entry.vendor === 'esp32')).toBe(true);
    const bare = result.chips.get('ESP32-C3');
    expect(bare?.flashKb).toBeNull();
    expect(result.index.find((entry) => entry.id === 'ESP32-C3')?.flashKb).toBeNull();
    expect(result.chips.get('ESP32-C3FH4')?.flashKb).toBe(4096);
    expect(result.chips.has('ESP32-WROOM-E')).toBe(true);
    expect(result.index.every((entry) => !Number.isNaN(entry.flashKb as number))).toBe(true);
  });

  it('emits provenance-backed module identity only on module shards', () => {
    const result = generateEsp32(adapterContext());
    const wroom = result.chips.get('ESP32-WROOM-E')!;
    expect(wroom.module).toEqual({
      kind: 'module',
      name: 'ESP32-WROOM-E',
      baseFamily: 'esp32',
      symbol: 'ESP32-WROOM-E',
    });
    expect(result.index.find((entry) => entry.id === 'ESP32-WROOM-E')?.module).toBe(true);
    for (const dieId of ['ESP32-C3', 'ESP32-C3FH4']) {
      expect(result.chips.get(dieId)).not.toHaveProperty('module');
      expect(result.index.find((entry) => entry.id === dieId)).not.toHaveProperty('module');
    }
    // Every index marker agrees with its shard, and no marker is ever false.
    for (const entry of result.index) {
      expect(Boolean(result.chips.get(entry.id)?.module)).toBe(entry.module === true);
    }
    expect(result.index.every((entry) => Number.isFinite(entry.pinCount))).toBe(true);
  });
});

describe('ESP32 strict gate behavior', () => {
  const result = generateEsp32(adapterContext());

  it('accepts a complete catalog and blocks on a broken reference value', () => {
    const ctx = gateContext(result.chips, result.index);
    for (const gate of createEsp32Gates()) {
      expect(gate.evaluate(ctx).errors, gate.name).toEqual([]);
    }
    const broken = new Map(result.chips);
    const c3 = broken.get('ESP32-C3')!;
    broken.set('ESP32-C3', {
      ...c3,
      pins: c3.pins.map((pin) =>
        pin.pos === '6' ? { ...pin, tags: pin.tags?.filter((tag) => tag !== 'strapping') } : pin,
      ),
    });
    const errors = createEsp32Gates()[0].evaluate(gateContext(broken, result.index)).errors;
    expect(errors.some((error) => error.includes('GPIO2'))).toBe(true);
  });

  it('rejects NaN and undefined shard values', () => {
    const invalid = new Map<string, ChipData>([
      ['BAD', { ...result.chips.get('ESP32-C3')!, id: 'BAD', flashKb: Number.NaN }],
    ]);
    const errors = createEsp32Gates()[2].evaluate(gateContext(invalid)).errors;
    expect(errors.some((error) => error.includes('NaN'))).toBe(true);
  });

  it('requires all four ESP32 source records', () => {
    const ctx = gateContext(result.chips, result.index);
    const missing = { ...ctx, sources: ctx.sources?.filter((source) => source.id !== 'esp-idf') };
    const errors = createEsp32Gates()[3].evaluate(missing).errors;
    expect(errors.some((error) => error.includes('esp-idf'))).toBe(true);
  });

  it('names missing, invented and mismatched module metadata', () => {
    const moduleGate = () => createEsp32Gates().find((gate) => gate.name === 'esp32-module-metadata')!;

    const missing = new Map(result.chips);
    const { module: _removed, ...withoutModule } = missing.get('ESP32-WROOM-E')!;
    missing.set('ESP32-WROOM-E', withoutModule);
    const missingErrors = moduleGate().evaluate(gateContext(missing, result.index)).errors;
    expect(missingErrors.some((error) => error.includes('ESP32-WROOM-E'))).toBe(true);

    const invented = new Map(result.chips);
    invented.set('ESP32-C3', {
      ...invented.get('ESP32-C3')!,
      module: { kind: 'module', name: 'ESP32-C3', baseFamily: 'esp32c3', symbol: 'ESP32-C3' },
    });
    const inventedErrors = moduleGate().evaluate(gateContext(invented, result.index)).errors;
    expect(
      inventedErrors.some(
        (error) => error.includes('ESP32-C3') && error.includes('without module evidence'),
      ),
    ).toBe(true);

    const mismatchIndex = result.index.map((entry) =>
      entry.id === 'ESP32-WROOM-E' ? { ...entry, module: undefined } : entry,
    );
    const mismatchErrors = moduleGate().evaluate(gateContext(result.chips, mismatchIndex)).errors;
    expect(
      mismatchErrors.some(
        (error) => error.includes('ESP32-WROOM-E') && error.includes('disagrees'),
      ),
    ).toBe(true);
  });

  it('publishes no partial catalog when a strict ESP32 gate fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-esp32-gate-'));
    try {
      fs.symlinkSync(CACHE, path.join(root, '.cache'), 'dir');
      const failing = {
        ...esp32Adapter,
        gates: [
          {
            name: 'forced-failure',
            evaluate: () => ({
              vendor: 'esp32' as const,
              name: 'forced-failure',
              errors: ['forced ESP32 gate failure'],
              notes: [],
            }),
          },
        ],
      };
      expect(() => generateCatalog(root, [failing])).toThrow(/forced ESP32 gate failure/);
      const chipsDir = path.join(root, 'public', 'data', 'chips');
      expect(fs.existsSync(chipsDir) ? fs.readdirSync(chipsDir) : []).toEqual([]);
      expect(fs.existsSync(path.join(root, 'public', 'data', 'index.json'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
