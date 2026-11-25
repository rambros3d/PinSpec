import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_SOURCE_IDS,
  type CatalogIndexEntry,
  type ChipData,
  type PinInfo,
} from '../src/core/types';
import {
  ch32ReferenceGate,
} from '../tools/data-gen/adapters/ch32';
import { rpReferenceGate } from '../tools/data-gen/adapters/rp';
import { createSamGates, samAdapter } from '../tools/data-gen/adapters/sam';
import { createNordicGates, nordicAdapter } from '../tools/data-gen/adapters/nordic';
import { generateNordicParts } from '../tools/data-gen/adapters/nordic/parts';
import { buildMetaDocument, buildSourceRegistry } from '../tools/data-gen/artifacts';
import {
  createArtifactBudgetGate,
  createGlobalGates,
  createProvenanceGate,
  createShardIntegrityGate,
  createWarningsContractGate,
  evaluateGates,
  findInvalidValues,
  runGateSuite,
  MAX_CATALOG_BYTES,
} from '../tools/data-gen/gates';
import { buildVendorSourcesMeta, DEFAULT_ADAPTERS, generateCatalog } from '../tools/data-gen/index';
import { buildWarningsDocument } from '../tools/data-gen/artifacts';
import type {
  AdapterResult,
  DataGenPaths,
  Gate,
  GateContext,
  ResolvedSource,
  VendorAdapter,
} from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';

function testPaths(root: string = process.cwd()): DataGenPaths {
  const outDir = path.join(root, 'public', 'data');
  return { root, cacheDir: path.join(root, '.cache'), outDir, chipsOutDir: path.join(outDir, 'chips') };
}

function chip(id: string, overrides: Partial<ChipData> = {}): ChipData {
  const pins: PinInfo[] = [
    { pos: '1', name: 'VDD', type: 'power', signals: [] },
    ...Array.from({ length: 7 }, (_, i) => ({
      pos: String(i + 2), name: `GPIO${i}`, type: 'io' as const, signals: [],
    })),
  ];
  return {
    id,
    family: 'TEST',
    core: 'Cortex-M0+',
    flashKb: 64,
    ramKb: 16,
    package: { name: 'TSSOP8', kind: 'perimeter', pinCount: 8, sides: [2, 2, 2, 2] },
    pins,
    peripherals: {},
    ...overrides,
  };
}

function indexEntry(c: ChipData, overrides: Partial<CatalogIndexEntry> = {}): CatalogIndexEntry {
  return {
    id: c.id,
    vendor: c.vendor,
    family: c.family,
    core: c.core,
    package: c.package.name,
    pinCount: c.pins.length,
    flashKb: c.flashKb,
    ramKb: c.ramKb,
    peripherals: { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 },
    ...overrides,
  };
}

function ctx(chips: ChipData[], overrides: Partial<GateContext> = {}): GateContext {
  const map = new Map(chips.map((c) => [c.id, c]));
  return {
    paths: testPaths(),
    chips: map,
    index: chips.map((c) => indexEntry(c)),
    totalVariants: chips.length,
    matchedVariants: chips.length,
    matchRate: 100,
    totalBytes: 4096,
    warnings: [],
    serializedShards: new Map(chips.map((c) => [c.id, JSON.stringify(c)])),
    ...overrides,
  };
}

function gate(name: string, errors: string[] = [], notes: string[] = []): Gate {
  return {
    name,
    evaluate: () => ({ vendor: 'stm32', name, errors, notes }),
  };
}

describe('orchestrator-level gate runner', () => {
  it('runs every gate and aggregates errors and notes', () => {
    const result = evaluateGates(
      [gate('ok'), gate('bad', ['first'], ['note']), gate('also-bad', ['second'])],
      ctx([]),
    );
    expect(result.results).toHaveLength(3);
    expect(result.errors).toEqual(['first', 'second']);
    expect(result.notes).toEqual(['note']);
  });

  it('stops at the first failing gate in fail-fast mode', () => {
    const second = vi.fn(() => ({ vendor: 'stm32' as const, name: 'second', errors: [], notes: [] }));
    const result = runGateSuite([gate('first', ['boom']), { name: 'second', evaluate: second }], ctx([]));
    expect(result.errors).toEqual(['boom']);
    expect(result.results).toHaveLength(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe('artifact budget and shard integrity gates', () => {
  it('reports the byte total when the budget is exceeded', () => {
    const errors = createArtifactBudgetGate(1024).evaluate(ctx([], { totalBytes: 151 * 1024 * 1024 })).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('151.00 MB');
    expect(errors[0]).toContain(String(151 * 1024 * 1024));
    expect(createArtifactBudgetGate().evaluate(ctx([], { totalBytes: MAX_CATALOG_BYTES - 1 })).errors).toEqual([]);
  });

  it('rejects a missing, inconsistent, or unparseable shard by id', () => {
    const c = chip('TESTCHIP');
    const missing = createShardIntegrityGate().evaluate(
      ctx([], { index: [indexEntry(c)], chips: new Map([[c.id, c]]) }),
    ).errors;
    expect(missing[0]).toContain('TESTCHIP');
    const mismatched = createShardIntegrityGate().evaluate(
      ctx([c], { index: [indexEntry(c, { pinCount: 9 })] }),
    ).errors;
    expect(mismatched[0]).toContain('pin count');
    const broken = createShardIntegrityGate().evaluate(
      ctx([c], { serializedShards: new Map([[c.id, '{not json']]) }),
    ).errors;
    expect(broken[0]).toContain('not parseable JSON');
  });

  it('accepts matching null flash for bare dies and rejects numeric mismatches', () => {
    const bare = chip('BARE', { vendor: 'esp32', flashKb: null });
    expect(createShardIntegrityGate().evaluate(ctx([bare])).errors).toEqual([]);
    const mismatch = createShardIntegrityGate().evaluate(
      ctx([bare], { index: [indexEntry(bare, { flashKb: 4096 })] }),
    ).errors;
    expect(mismatch[0]).toContain('flashKb');
    const numeric = chip('MODULE', { vendor: 'esp32', flashKb: 4096 });
    expect(
      createShardIntegrityGate().evaluate(
        ctx([numeric], { index: [indexEntry(numeric, { flashKb: 8192 })] }),
      ).errors[0],
    ).toContain('flashKb');
  });

  it('detects NaN, infinity, and undefined before serialization', () => {
    expect(findInvalidValues({ a: Number.NaN })).toEqual(['$.a=NaN']);
    expect(findInvalidValues([1, Number.POSITIVE_INFINITY])).toEqual(['$[1]=Infinity']);
    expect(findInvalidValues({ nested: { missing: undefined } })).toEqual(['$.nested.missing=undefined']);
    const bad = chip('BAD', { flashKb: Number.NaN });
    const errors = createShardIntegrityGate().evaluate(ctx([bad])).errors;
    expect(errors[0]).toContain('BAD');
    expect(errors[0]).toContain('NaN');
  });
});

describe('CH32 and RP structural gate extensions', () => {
  function ch32Priority(id: string, pkg: string, pins: number): ChipData {
    const pinList: PinInfo[] = Array.from({ length: pins }, (_, i) => {
      const name = i === 0 ? 'PD1' : `PA${i}`;
      return {
        pos: String(i + 1),
        name,
        type: 'io',
        signals: [],
        ...(name === 'PD1'
          ? {
              tags: id.endsWith('J4M6')
                ? ['debug-sdi', 'bonded', '5v-tolerant']
                : ['debug-sdi', '5v-tolerant'],
              bondedNames: id.endsWith('J4M6') ? ['PD1', 'PD6'] : undefined,
            }
          : {}),
      };
    });
    return chip(id, {
      vendor: 'ch32',
      muxModel: 'remap-group',
      package: {
        name: pkg,
        kind: 'perimeter',
        pinCount: pins,
        sides: [pins / 4, pins / 4, pins / 4, pins / 4],
        hasExposedPad: id === 'CH32V203C8T6' || id === 'CH32X035G8U6',
      },
      pins: pinList,
      peripherals: {
        USART1: {
          kind: 'usart',
          signals: ['TX'],
          remaps: [{ id: 0, name: 'Default (RM0)', signals: { TX: 'PD1' } }],
        },
      },
    });
  }

  const priorityChips = () => [
    ch32Priority('CH32V003F4P6', 'TSSOP20', 20),
    ch32Priority('CH32V003J4M6', 'SOP8', 8),
    ch32Priority('CH32V203C8T6', 'LQFP48', 48),
    ch32Priority('CH32X035G8U6', 'QFN28', 28),
  ];

  it('accepts grouped remaps, bonded tags, and PD1 debug-sdi', () => {
    expect(ch32ReferenceGate.evaluate(ctx(priorityChips())).errors).toEqual([]);
  });

  it('names a missing priority part and a missing debug-sdi tag', () => {
    const chips = priorityChips();
    expect(ch32ReferenceGate.evaluate(ctx(chips.slice(1))).errors[0]).toContain('CH32V003F4P6');
    const untagged = priorityChips().map((c) => ({
      ...c,
      pins: c.pins.map((p) => ({ ...p, tags: p.tags?.filter((t) => t !== 'debug-sdi') })),
    }));
    expect(ch32ReferenceGate.evaluate(ctx(untagged)).errors.some((e) => e.includes('debug-sdi'))).toBe(true);
    const noFt = priorityChips().map((c) => ({
      ...c,
      pins: c.pins.map((p) => ({
        ...p,
        tags: p.tags?.filter((tag) => tag !== '5v-tolerant'),
      })),
    }));
    expect(ch32ReferenceGate.evaluate(ctx(noFt)).errors.some(
      (e) => e.includes('CH32V003F4P6') && e.includes('5v-tolerant'),
    )).toBe(true);
  });

  it('names an out-of-range PWM slice resource on an RP part', () => {
    const gpioPins: PinInfo[] = Array.from({ length: 30 }, (_, i) => {
      const adcIndex = i >= 26 ? i - 26 : -1;
      return {
        pos: `G${i}`,
        name: adcIndex >= 0 ? `GPIO${i}/ADC${adcIndex}` : `GPIO${i}`,
        type: 'io',
        tags: adcIndex >= 0 ? ['adc'] : [],
        signals: i === 0
          ? [{ peripheral: 'PWM', signal: 'PWM12A', af: 1, funcLabel: 'F1', resourceId: 'PWM12A' }]
          : [],
      };
    });
    const rp = chip('RP2040', {
      vendor: 'rp',
      muxModel: 'funcsel-pio',
      package: { name: 'QFN-56', kind: 'perimeter', pinCount: 56, sides: [14, 14, 14, 14], hasExposedPad: true },
      flashKb: 0,
      pio: { instances: ['PIO0', 'PIO1'], stateMachinesPerInstance: 4, gpioBaseOptions: [0] },
      pins: [
        ...gpioPins,
        { pos: 'SWC', name: 'SWCLK', type: 'io', signals: [], tags: ['debug-swd'] },
        { pos: 'SWD', name: 'SWDIO', type: 'io', signals: [], tags: ['debug-swd'] },
        { pos: 'QS', name: 'QSPI_SCLK', type: 'io', signals: [], tags: ['qspi'] },
        ...Array.from({ length: 23 }, (_, i) => ({ pos: `P${i}`, name: `PAD${i}`, type: 'io' as const, signals: [] })),
      ],
    });
    const errors = rpReferenceGate.evaluate(ctx([rp])).errors;
    expect(errors.some((e) => e.includes('PWM12A'))).toBe(true);
  });
});

describe('provenance and warning contracts', () => {
  const sources: ResolvedSource[] = [
    ...DEFAULT_ADAPTERS.flatMap((a) => a.sourceSpecs).map((spec) => ({ ...spec, commit: 'abc1234' })),
  ];
  const results: AdapterResult[] = DEFAULT_ADAPTERS.map((adapter) => ({
    vendor: adapter.vendor,
    chips: new Map(),
    index: [],
    families: [],
    totalVariants: 10,
    matchedVariants: 10,
    ...(adapter.vendor === 'ch32'
      ? {
          evidenceFiles: [{
            path: 'evidence/pins.csv',
            sha256: 'a'.repeat(64),
            rows: 2,
            url: 'https://github.com/ch32-riscv-ug/ch32-device-data/blob/main/evidence/pins.csv',
            license: 'MIT',
          }],
        }
      : {}),
  }));

  it('emits all thirteen source ids with sha, url, and license', () => {
    const registry = buildSourceRegistry(sources);
    for (const id of CATALOG_SOURCE_IDS) {
      expect(registry[id], id).toBeDefined();
      expect(registry[id]!.sha).toBe('abc1234');
      expect(registry[id]!.url).toContain('http');
      expect(registry[id]!.license).not.toBe('');
    }
  });

  it('fails provenance when a source SHA or vendor ratio is missing', () => {
    const registry = buildSourceRegistry(sources);
    const vendorSources = buildVendorSourcesMeta(DEFAULT_ADAPTERS, sources, results);
    const meta = buildMetaDocument('2026-01-01T00:00:00.000Z', {
      ...vendorSources,
      ...registry,
    });
    const base = ctx([], { meta, warningDoc: buildWarningsDocument('2026-01-01T00:00:00.000Z', [], {
      totalVariants: 0, matchedVariants: 0, matchRate: 100,
    }) });
    expect(createProvenanceGate().evaluate(base).errors).toEqual([]);
    const brokenMeta = { ...meta, sources: { ...meta.sources, kicad: { ...registry.kicad!, sha: '' } } };
    expect(createProvenanceGate().evaluate({ ...base, meta: brokenMeta }).errors.some((e) => e.includes('kicad') && e.includes('sha'))).toBe(true);
    const noRatio = { ...meta, sources: { ...meta.sources, rp: { ...vendorSources.rp!, ratios: undefined } } };
    expect(createProvenanceGate().evaluate({ ...base, meta: noRatio }).errors.some((e) => e.includes('rp') && e.includes('ratios'))).toBe(true);
    const noEvidence = {
      ...meta,
      sources: { ...meta.sources, ch32: { ...vendorSources.ch32!, evidenceFiles: undefined } },
    };
    expect(createProvenanceGate().evaluate({ ...base, meta: noEvidence }).errors.some((e) => e.includes('ch32') && e.includes('evidence'))).toBe(true);
    const shortDigest = {
      ...meta,
      sources: {
        ...meta.sources,
        ch32: {
          ...vendorSources.ch32!,
          evidenceFiles: [{ ...vendorSources.ch32!.evidenceFiles![0], sha256: 'short' }],
        },
      },
    };
    expect(createProvenanceGate().evaluate({ ...base, meta: shortDigest }).errors.some((e) => e.includes('SHA-256'))).toBe(true);
  });

  it('attributes a deferred CH32 part and keeps the empty-warning case valid', () => {
    const collector = createWarningCollector();
    collector.add({
      vendor: 'ch32',
      refName: 'CH32V003M8T6',
      reason: 'No curated package mapping; part deferred.',
    });
    const doc = buildWarningsDocument('2026-01-01T00:00:00.000Z', collector.all(), {
      totalVariants: 1, matchedVariants: 0, matchRate: 0,
    });
    expect(doc.warnings[0]).toMatchObject({
      id: 'CH32V003M8T6',
      vendor: 'ch32',
      source: 'ch32-device-data',
      reason: 'No curated package mapping; part deferred.',
    });
    expect(createWarningsContractGate().evaluate(ctx([], { warningDoc: doc })).errors).toEqual([]);
    const empty = buildWarningsDocument('2026-01-01T00:00:00.000Z', [], {
      totalVariants: 0, matchedVariants: 0, matchRate: 100,
    });
    expect(empty.warnings).toEqual([]);
    expect(createWarningsContractGate().evaluate(ctx([], { warningDoc: empty })).errors).toEqual([]);
  });

  it('accepts ESP32 deferred-part warnings with vendor attribution', () => {
    const collector = createWarningCollector();
    collector.add({
      id: 'ESP32-C6-MINI-1/U',
      vendor: 'esp32',
      source: 'espressif-kicad',
      reason: 'No first-party flash capacity evidence; module deferred.',
    });
    const doc = buildWarningsDocument('2026-01-01T00:00:00.000Z', collector.all(), {
      totalVariants: 1, matchedVariants: 0, matchRate: 0,
    });
    expect(doc.warningsByVendor.esp32).toBe(1);
    expect(createWarningsContractGate().evaluate(ctx([], { warningDoc: doc })).errors).toEqual([]);
  });

  it('accepts a deferred SAM record with microchip attribution', () => {
    const collector = createWarningCollector();
    collector.add({
      id: 'ATSAMD21G18A',
      vendor: 'microchip',
      source: 'microchip-atdf',
      reason: 'ATDF declares no DMA channel-to-signal map; channels deferred.',
    });
    const doc = buildWarningsDocument('2026-01-01T00:00:00.000Z', collector.all(), {
      totalVariants: 1, matchedVariants: 1, matchRate: 100,
    });
    expect(doc.warningsByVendor.microchip).toBe(1);
    expect(createWarningsContractGate().evaluate(ctx([], { warningDoc: doc })).errors).toEqual([]);
  });

  it('accepts a deferred Nordic part with vendor attribution', () => {
    const collector = createWarningCollector();
    collector.add({
      id: 'nRF54L15',
      vendor: 'nordic',
      source: 'nrf-pacs',
      reason: 'No machine-readable SVD and no KiCad symbol; part deferred.',
    });
    const doc = buildWarningsDocument('2026-01-01T00:00:00.000Z', collector.all(), {
      totalVariants: 1, matchedVariants: 0, matchRate: 0,
    });
    expect(doc.warningsByVendor.nordic).toBe(1);
    expect(createWarningsContractGate().evaluate(ctx([], { warningDoc: doc })).errors).toEqual([]);
  });

  it('rejects a warning document with missing attribution', () => {
    const doc = buildWarningsDocument('2026-01-01T00:00:00.000Z', [], {
      totalVariants: 0, matchedVariants: 0, matchRate: 100,
    });
    doc.warnings = [{ vendor: 'ch32', reason: 'deferred' }];
    const errors = createWarningsContractGate().evaluate(ctx([], { warningDoc: doc })).errors;
    expect(errors.some((e) => e.includes('id'))).toBe(true);
    expect(errors.some((e) => e.includes('source'))).toBe(true);
  });
});

describe('SAM strict gate contract', () => {
  function samChips(): ChipData[] {
    const base = (id: string, pinCount = 8): ChipData =>
      chip(id, {
        vendor: 'microchip',
        muxModel: 'af',
        family: 'SAM',
        package: {
          name: 'TQFP', kind: 'perimeter', pinCount,
          sides: [Math.ceil(pinCount / 4), 0, Math.floor(pinCount / 4), 0],
        },
        pins: [
          { pos: '1', name: 'PA00', type: 'io', signals: [{ peripheral: 'PORTA', signal: 'PAD0', af: 0 }] },
          ...Array.from({ length: pinCount - 1 }, (_, i) => ({
            pos: String(i + 2), name: `GPIO${i}`, type: 'io' as const, signals: [],
          })),
        ],
      });
    const chips = [
      base('ATSAMD21G18A', 48),
      base('ATSAMD51P20A', 120),
      base('ATSAME51J20A', 64),
      base('ATSAMV71Q21B', 144),
      ...Array.from({ length: 35 }, (_, i) => base(`SAMPART${i}`)),
    ];
    chips[1].pinouts = [
      { name: 'SAMD51P', package: 'TQFP128', pinCount: 128 },
      { name: 'SAMD51PC', package: 'TFBGA120', pinCount: 120 },
    ];
    return chips;
  }

  const samSources: ResolvedSource[] = [{
    id: 'microchip-atdf', url: 'https://example.test/dev_packs', dir: '/tmp',
    license: 'Apache-2.0', commit: 'abc1234',
  }];

  it('registers strict SAM gates and accepts a complete catalog', () => {
    expect(samAdapter.strict).toBe(true);
    expect(createSamGates().map((gate) => gate.name)).toEqual([
      'sam-reference-parts', 'sam-shard-values', 'sam-provenance',
    ]);
    const results = createSamGates().map((gate) =>
      gate.evaluate(ctx(samChips(), { sources: samSources })),
    );
    expect(results.map((result) => result.errors)).toEqual([[], [], []]);
  });

  it('fails the reference gate on a short count or missing AF index', () => {
    const reference = createSamGates()[0];
    expect(reference.evaluate(ctx(samChips().slice(1), { sources: samSources })).errors[0]).toContain('39');
    const noAf = samChips().map((item) => ({
      ...item,
      pins: item.pins.map((pin) => ({ ...pin, signals: [] })),
    }));
    expect(reference.evaluate(ctx(noAf, { sources: samSources })).errors.some((e) => e.includes('function-letter'))).toBe(true);
  });

  it('fails provenance when the microchip-atdf SHA is missing', () => {
    const provenance = createSamGates()[2];
    const errors = provenance.evaluate(ctx(samChips(), { sources: [] })).errors;
    expect(errors.some((e) => e.includes('microchip-atdf'))).toBe(true);
  });
});

describe('Nordic strict gate contract', () => {
  const nordicSources: ResolvedSource[] = [
    ...nordicAdapter.sourceSpecs.map((spec) => ({ ...spec, commit: 'abc1234' })),
  ];

  function nordicChips(): ChipData[] {
    const collector = createWarningCollector();
    return Array.from(
      generateNordicParts({
        paths: testPaths(),
        sources: nordicSources,
        warnings: collector,
      }).chips.values(),
    );
  }

  it('registers strict Nordic gates and accepts the generated reference part', () => {
    expect(nordicAdapter.strict).toBe(true);
    expect(createNordicGates().map((gate) => gate.name)).toEqual([
      'nordic-reference-parts', 'nordic-shard-values', 'nordic-provenance',
    ]);
    const chips = nordicChips();
    expect(chips.length).toBeGreaterThan(0);
    const results = createNordicGates().map((gate) =>
      gate.evaluate(ctx(chips, { sources: nordicSources })),
    );
    expect(results.map((result) => result.errors)).toEqual([[], [], []]);
  });

  it('fails on a missing PSEL label and incomplete provenance', () => {
    const chip = nordicChips()[0];
    const stripped = { ...chip, pins: chip.pins.map((pin) => ({ ...pin, signals: [] })) };
    const reference = createNordicGates()[0];
    expect(reference.evaluate(ctx([stripped], { sources: nordicSources })).errors.some(
      (error) => error.includes('PSEL'),
    )).toBe(true);
    const provenance = createNordicGates()[2];
    expect(provenance.evaluate(ctx([chip], { sources: [] })).errors.some(
      (error) => error.includes('nrf-pacs'),
    )).toBe(true);
  });
});

describe('global gate suite and no partial catalog', () => {
  it('includes budget, shard, provenance, and warnings gates', () => {
    expect(createGlobalGates().map((g) => g.name)).toEqual([
      'artifact-budget', 'shard-integrity', 'provenance', 'warnings-contract',
    ]);
  });

  it('throws before writing shards when an injected assertion fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-gate-write-'));
    const tmpSource = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-gate-source-'));
    const c = chip('TESTCHIP');
    const adapter: VendorAdapter = {
      vendor: 'ch32',
      sourceSpecs: [{ id: 'ch32-device-data', url: 'unused://local', dir: tmpSource, license: 'MIT' }],
      generate: () => ({
        vendor: 'ch32', chips: new Map([[c.id, c]]), index: [indexEntry(c)],
        families: [], totalVariants: 1, matchedVariants: 1,
      }),
      gates: [{
        name: 'injected-failure',
        evaluate: () => ({
          vendor: 'ch32', name: 'injected-failure',
          errors: ['CH32 gate failed: injected assertion failure'], notes: [],
        }),
      }],
      strict: true,
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [adapter])).toThrow('injected assertion failure');
      expect(fs.existsSync(path.join(root, 'public', 'data', 'chips', 'TESTCHIP.json'))).toBe(false);
      expect(fs.existsSync(path.join(root, 'public', 'data', 'meta.json'))).toBe(false);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(tmpSource, { recursive: true, force: true });
    }
  });
});
