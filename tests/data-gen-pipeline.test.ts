import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  CatalogIndexEntry,
  ChipData,
  PinInfo,
  PeripheralInfo,
} from '../src/core/types';
import {
  generateStm32,
  stm32Adapter,
  stm32ReferenceGate,
  stm32ThresholdGate,
} from '../tools/data-gen/adapters/stm32';
import {
  buildMetaDocument,
  buildWarningsDocument,
} from '../tools/data-gen/artifacts';
import { createMinCountGate, createReferencePartsGate } from '../tools/data-gen/gates';
import { aggregateChipHash, chipHash, indexHash } from '../tools/data-gen/hashes';
import {
  buildVendorSourcesMeta,
  generateCatalog,
} from '../tools/data-gen/index';
import { LICENSE_EMBASSY_STM32, LICENSE_OPEN_PIN_DATA, resolveRevision } from '../tools/data-gen/sources';
import type {
  AdapterResult,
  DataGenPaths,
  GateContext,
  ResolvedSource,
  VendorAdapter,
} from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';
import golden from './fixtures/stm32-golden.json';

const ROOT = process.cwd();
const OPEN_PIN_DIR = path.join(ROOT, '.cache', 'STM32_open_pin_data');
const EMBASSY_DIR = path.join(ROOT, '.cache', 'stm32-data-generated');
const HAS_CACHE =
  fs.existsSync(path.join(OPEN_PIN_DIR, 'mcu')) &&
  fs.existsSync(path.join(EMBASSY_DIR, 'data', 'chips'));

function testPaths(root: string = ROOT): DataGenPaths {
  const outDir = path.join(root, 'public', 'data');
  return { root, cacheDir: path.join(root, '.cache'), outDir, chipsOutDir: path.join(outDir, 'chips') };
}

function fakeChip(id: string, overrides: Partial<ChipData> = {}): ChipData {
  const pkg = overrides.package ?? {
    name: 'UFQFPN48',
    kind: 'perimeter' as const,
    pinCount: 48,
    sides: [12, 12, 12, 12] as [number, number, number, number],
  };
  const pins: PinInfo[] = [
    { pos: '1', name: 'VDD', type: 'power', signals: [] },
    {
      pos: '2',
      name: 'PA5',
      type: 'io',
      signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }],
    },
    ...Array.from({ length: Math.max(0, pkg.pinCount - 2) }, (_, i) => ({
      pos: String(i + 3),
      name: `P${i + 3}`,
      type: 'io' as const,
      signals: [],
    })),
  ];
  return {
    id,
    family: 'STM32G4',
    core: 'Cortex-M4',
    flashKb: 128,
    ramKb: 32,
    package: pkg,
    pins,
    peripherals: {
      SYS: { kind: 'sys', signals: ['SWDIO', 'SWCLK'] },
      SPI1: { kind: 'spi', signals: ['SCK'] },
      TIM1: { kind: 'tim', signals: ['CH1'] },
      GPDMA1: { kind: 'other', signals: [] },
      ...(overrides.peripherals ?? {}),
    },
    ...overrides,
  };
}

function referenceChips(): Map<string, ChipData> {
  const chips = new Map<string, ChipData>();
  chips.set('STM32F411CEU6', fakeChip('STM32F411CEU6'));
  chips.set('STM32G431CBU6', fakeChip('STM32G431CBU6'));
  const f103 = fakeChip('STM32F103C8T6', {
    package: { name: 'LQFP48', kind: 'perimeter', pinCount: 48, sides: [12, 12, 12, 12] },
  });
  f103.pins = f103.pins.map((p) =>
    p.name === 'PA5'
      ? { ...p, signals: [{ peripheral: 'SPI1', signal: 'SCK', af: null }] }
      : p,
  );
  chips.set('STM32F103C8T6', f103);
  chips.set(
    'STM32H743VIT6',
    fakeChip('STM32H743VIT6', {
      package: { name: 'LQFP100', kind: 'perimeter', pinCount: 100, sides: [25, 25, 25, 25] },
    }),
  );
  chips.set(
    'STM32U575RIT6',
    fakeChip('STM32U575RIT6', {
      package: { name: 'LQFP64', kind: 'perimeter', pinCount: 64, sides: [16, 16, 16, 16] },
    }),
  );
  chips.set(
    'STM32H743XIH6',
    fakeChip('STM32H743XIH6', {
      package: {
        name: 'TFBGA240',
        kind: 'grid',
        pinCount: 265,
        rows: ['A', 'B', 'C'],
        cols: [1, 2, 3],
      },
    }),
  );
  return chips;
}

function gateCtx(chips: Map<string, ChipData>, overrides: Partial<GateContext> = {}): GateContext {
  return {
    paths: testPaths(),
    chips,
    index: [],
    totalVariants: 6,
    matchedVariants: 6,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    ...overrides,
  };
}

describe('STM32 golden output and reference parts', () => {
  let result: AdapterResult;

  describe.skipIf(!HAS_CACHE)('with pinned upstream sources', () => {
    it('matches the golden chip-shard and index hashes', () => {
      const sources: ResolvedSource[] = [
        ...stm32Adapter.sourceSpecs.map((spec) => ({ ...spec, commit: resolveRevision(spec.dir) })),
      ];
      result = generateStm32({ paths: testPaths(), sources, warnings: createWarningCollector() });
      expect(resolveRevision(OPEN_PIN_DIR)).toBe(golden.openPinDataCommit);
      expect(resolveRevision(EMBASSY_DIR)).toBe(golden.stm32DataCommit);
      expect(result.index.length).toBe(golden.chipCount);
      expect(aggregateChipHash(result.chips)).toBe(golden.chipsAggregateSha256);
      expect(indexHash(result.index)).toBe(golden.indexSha256);
      for (const [id, expectedHash] of Object.entries(golden.referenceChips)) {
        const chip = result.chips.get(id);
        expect(chip, `missing reference chip ${id}`).toBeDefined();
        expect(chipHash(chip!)).toBe(expectedHash);
      }
    }, 120_000);

    it('pins package, pin count, power pins, AF/SYS/DMA/BGA fields for six parts', () => {
      const sources: ResolvedSource[] = stm32Adapter.sourceSpecs.map((spec) => ({
        ...spec,
        commit: resolveRevision(spec.dir),
      }));
      const chips = (result ?? generateStm32({ paths: testPaths(), sources, warnings: createWarningCollector() })).chips;
      const expectations: Record<string, { pkg: string; pins: number; kind: 'perimeter' | 'grid' }> = {
        STM32F411CEU6: { pkg: 'UFQFPN48', pins: 48, kind: 'perimeter' },
        STM32G431CBU6: { pkg: 'UFQFPN48', pins: 48, kind: 'perimeter' },
        STM32F103C8T6: { pkg: 'LQFP48', pins: 48, kind: 'perimeter' },
        STM32H743VIT6: { pkg: 'LQFP100', pins: 100, kind: 'perimeter' },
        STM32U575RIT6: { pkg: 'LQFP64', pins: 64, kind: 'perimeter' },
        STM32H743XIH6: { pkg: 'TFBGA240', pins: 265, kind: 'grid' },
      };
      for (const [id, exp] of Object.entries(expectations)) {
        const chip = chips.get(id)!;
        expect(chip.package.name, id).toBe(exp.pkg);
        expect(chip.pins.length, id).toBe(exp.pins);
        expect(chip.package.kind, id).toBe(exp.kind);
        expect(chip.pins.some((p) => p.type === 'power'), id).toBe(true);
      }
      const sck = (id: string) =>
        chips.get(id)!.pins.find((p) => p.name === 'PA5')?.signals.find(
          (s) => s.peripheral === 'SPI1' && s.signal === 'SCK',
        );
      expect(sck('STM32F411CEU6')?.af).toBe(5);
      expect(sck('STM32G431CBU6')?.af).toBe(5);
      expect(sck('STM32F103C8T6')?.af).toBeNull();
      expect(chips.get('STM32G431CBU6')!.peripherals.SYS?.signals).toContain('SWDIO');
      expect(chips.get('STM32H743VIT6')!.peripherals.SPI1).toBeDefined();
      expect(chips.get('STM32H743VIT6')!.peripherals.TIM1).toBeDefined();
      const u575 = chips.get('STM32U575RIT6')!;
      expect(u575.peripherals.SPI1?.dma?.length || u575.peripherals.GPDMA1).toBeTruthy();
      const h743 = chips.get('STM32H743XIH6')!.package;
      expect(h743.rows?.length).toBeGreaterThan(0);
      expect(h743.cols?.length).toBeGreaterThan(0);
    }, 120_000);
  });

  it('reports a named STM32 gate error for a corrupted reference chip', () => {
    const chips = referenceChips();
    expect(stm32ReferenceGate.evaluate(gateCtx(chips)).errors).toEqual([]);
    const corrupted = chips.get('STM32G431CBU6')!;
    chips.set('STM32G431CBU6', {
      ...corrupted,
      package: { ...corrupted.package, name: 'LQFP64' },
    });
    const errors = stm32ReferenceGate.evaluate(gateCtx(chips)).errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('STM32G431CBU6'))).toBe(true);
  });

  it('fails STM32 thresholds by name', () => {
    const errors = stm32ThresholdGate.evaluate(
      gateCtx(referenceChips(), {
        index: Array.from({ length: 999 }, (_, i) => ({
          id: `X${i}`,
        })) as CatalogIndexEntry[],
        matchRate: 94,
        totalBytes: 151 * 1024 * 1024,
      }),
    ).errors;
    expect(errors.some((e) => e.includes('1,000+ MCUs'))).toBe(true);
    expect(errors.some((e) => e.includes('95%'))).toBe(true);
    expect(errors.some((e) => e.includes('150 MB'))).toBe(true);
  });
});

describe('metadata and warnings', () => {
  const sourceSpecs = stm32Adapter.sourceSpecs;
  const sources: ResolvedSource[] = [
    { ...sourceSpecs[0], commit: '45c0459', license: LICENSE_OPEN_PIN_DATA },
    { ...sourceSpecs[1], commit: '5de055b', license: LICENSE_EMBASSY_STM32 },
  ];
  const results: AdapterResult[] = [
    {
      vendor: 'stm32',
      chips: new Map(),
      index: [],
      families: [],
      totalVariants: 0,
      matchedVariants: 0,
    },
  ];

  it('emits per-vendor sources while retaining legacy meta fields', () => {
    const entries = buildVendorSourcesMeta([stm32Adapter], sources, results);
    expect(entries.stm32?.commit).toBe('5de055b');
    expect(entries.stm32?.openPinDataCommit).toBe('45c0459');
    expect(entries.stm32?.license).toContain(LICENSE_OPEN_PIN_DATA);
    expect(entries.stm32?.license).toContain(LICENSE_EMBASSY_STM32);
    expect(entries.stm32?.repositories?.map((r) => r.commit)).toEqual(['45c0459', '5de055b']);
    const meta = buildMetaDocument(
      '2026-01-01T00:00:00.000Z',
      {
        stm32DataCommit: '5de055b',
        openPinDataCommit: '45c0459',
        chipCount: 2699,
        matchRate: 97.9,
        families: ['STM32G4'],
      },
      entries,
    );
    expect(meta.stm32DataCommit).toBe('5de055b');
    expect(meta.openPinDataCommit).toBe('45c0459');
    expect(meta.chipCount).toBe(2699);
    expect(meta.matchRate).toBe(97.9);
    expect(meta.families).toEqual(['STM32G4']);
    expect(meta.sources?.stm32?.chipCount).toBe(0);
  });

  it('records unknown revisions without crashing', () => {
    const unresolved: ResolvedSource[] = sources.map((s) => ({ ...s, commit: 'unknown' }));
    const entries = buildVendorSourcesMeta([stm32Adapter], unresolved, results);
    expect(entries.stm32?.commit).toBe('unknown');
    expect(entries.stm32?.repositories?.every((r) => r.commit === 'unknown')).toBe(true);
  });

  it('always writes a warnings document, including the zero-warning case', () => {
    const empty = buildWarningsDocument('2026-01-01T00:00:00.000Z', [], {
      totalVariants: 1,
      matchedVariants: 1,
      matchRate: 100,
    });
    expect(empty.warningCount).toBe(0);
    expect(empty.warnings).toEqual([]);
    expect(empty.warningsByVendor).toEqual({});

    const collector = createWarningCollector();
    collector.add({
      vendor: 'stm32',
      file: 'STM32L485J(C-E)Yx.xml',
      refName: 'STM32L485JCYx',
      reason: 'No Embassy chip match for stem STM32L485JC (STM32L4 / WLCSP72).',
    });
    expect(collector.countFor('stm32')).toBe(1);
    expect(collector.countFor('ch32')).toBe(0);
    const withWarning = buildWarningsDocument('2026-01-01T00:00:00.000Z', collector.all(), {
      totalVariants: 2,
      matchedVariants: 1,
      matchRate: 50,
    });
    expect(withWarning.warningCount).toBe(1);
    expect(withWarning.warningsByVendor).toEqual({ stm32: 1 });
    expect(withWarning.warnings[0]).toMatchObject({
      vendor: 'stm32',
      refName: 'STM32L485JCYx',
    });
    expect(withWarning.warnings[0].reason).toContain('No Embassy chip match');
  });

  it('agrees with generated build-warnings.json after gen-data', () => {
    const warningsPath = path.join(ROOT, 'public', 'data', 'build-warnings.json');
    const metaPath = path.join(ROOT, 'public', 'data', 'meta.json');
    if (!fs.existsSync(warningsPath) || !fs.existsSync(metaPath)) return;
    const doc = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(doc.warningCount).toBe(doc.warnings.length);
    expect(doc.warnings.every((w: { vendor: string }) => typeof w.vendor === 'string')).toBe(true);
    expect(doc.warningsByVendor.stm32).toBe(doc.warningCount);
    expect(meta.sources.stm32.chipCount).toBe(meta.chipCount);
    expect(meta.sources.stm32.commit).toBe(meta.stm32DataCommit);
    expect(meta.sources.stm32.openPinDataCommit).toBe(meta.openPinDataCommit);
  });
});

describe('orchestrator with injected adapters', () => {
  function fakeAdapter(vendor: 'ch32' | 'stm32', strict: boolean): VendorAdapter {
    const tmpSource = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-adapter-'));
    const chip = fakeChip(vendor === 'ch32' ? 'TESTCHIP' : 'TESTSTM');
    return {
      vendor,
      sourceSpecs: [
        { id: `fake-${vendor}`, url: 'unused://local', dir: tmpSource, license: 'Test License' },
      ],
      generate: () => ({
        vendor,
        chips: new Map([[chip.id, chip]]),
        index: [
          {
            id: chip.id,
            family: 'TEST',
            core: 'Cortex-M0+',
            package: 'TSSOP20',
            pinCount: 20,
            flashKb: 16,
            ramKb: 2,
            peripherals: { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 },
          },
        ],
        families: ['TEST'],
        totalVariants: 1,
        matchedVariants: 1,
      }),
      gates: strict
        ? []
        : [
            createMinCountGate(vendor, 5),
            createReferencePartsGate(vendor, ['CH32V003F4P6']),
          ],
      strict,
    };
  }

  it('warns and continues for non-STM32 shortfalls, with consistent logs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-gen-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const summary = generateCatalog(root, [fakeAdapter('ch32', false)]);
      expect(summary.warnings.warningCount).toBe(2);
      expect(summary.warnings.warnings.every((w) => w.vendor === 'ch32')).toBe(true);
      expect(summary.meta.sources?.ch32?.chipCount).toBe(1);
      expect(summary.meta.sources?.ch32?.commit).toBe('unknown');
      const written = JSON.parse(
        fs.readFileSync(path.join(root, 'public', 'data', 'build-warnings.json'), 'utf8'),
      );
      expect(written.warningCount).toBe(2);
      expect(written.warningsByVendor).toEqual({ ch32: 2 });
      const logs = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logs).toContain('ch32: 1 chips, 100.00% match, 2 warnings');
      expect(logs).toContain('warnings by vendor: {"ch32":2}');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails a strict vendor whose gate returns an error', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-gen-strict-'));
    const adapter = fakeAdapter('stm32', true);
    adapter.gates = [
      {
        name: 'injected-corruption',
        evaluate: (ctx: GateContext) => ({
          vendor: 'stm32',
          name: 'injected-corruption',
          errors: ['STM32 gate failed: STM32G431CBU6 corrupted reference chip'],
          notes: [],
        }),
      },
    ];
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [adapter])).toThrow(/STM32G431CBU6 corrupted reference chip/);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('generated artifacts after gen-data', () => {
  it('emits at least 1,000 MCUs with expected artifacts', () => {
    const metaPath = path.join(ROOT, 'public', 'data', 'meta.json');
    const indexPath = path.join(ROOT, 'public', 'data', 'index.json');
    if (!fs.existsSync(metaPath) || !fs.existsSync(indexPath)) return;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(meta.chipCount).toBeGreaterThanOrEqual(1000);
    expect(index.length).toBe(meta.chipCount);
    expect(fs.existsSync(path.join(ROOT, 'public', 'data', 'build-warnings.json'))).toBe(true);
  });
});
