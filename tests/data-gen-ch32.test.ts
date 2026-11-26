import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChipData } from '../src/core/types';
import {
  CH32_CONSUMED_FILES,
  buildRegisterNote,
  ch32Adapter,
  ch32CountGate,
  ch32ReferenceGate,
  derivePinTags,
  generateCh32,
  mapPinType,
  parseCh32Manifest,
  readCh32ToleranceEvidence,
  routeToRemapId,
  verifyCh32Sources,
} from '../tools/data-gen/adapters/ch32';
import { parseCsv } from '../tools/data-gen/csv';
import { sha256Hex } from '../tools/data-gen/hashes';
import { DEFAULT_ADAPTERS, generateCatalog } from '../tools/data-gen/index';
import { resolveRevision } from '../tools/data-gen/sources';
import type { GateContext, ResolvedSource, VendorAdapter } from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';
import { stm32Adapter } from '../tools/data-gen/adapters/stm32';
import { rpAdapter } from '../tools/data-gen/adapters/rp';

const TEMP_ROOTS: string[] = [];
function tempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_ROOTS.push(root);
  return root;
}
afterEach(() => {
  while (TEMP_ROOTS.length > 0) {
    fs.rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
  }
});

const PART_COLS = [
  'part_number', 'series', 'family', 'package', 'pins', 'flash_bytes', 'sram_bytes', 'gpio_count',
];
const PINOUT_COLS = [
  'part_number', 'series', 'family', 'pin', 'pad', 'port', 'gpio', 'kind', 'peripheral',
  'role', 'signal', 'route', 'selector', 'value', 'af', 'condition', 'confidence', 'basis',
];
const ROUTE_COLS = [
  'series', 'selector', 'controller', 'register', 'bits', 'value', 'peripheral', 'role',
  'signal', 'pad', 'port', 'gpio', 'confidence', 'basis',
];
const PACKAGE_COLS = ['package', 'pin_count', 'body_size', 'pin_pitch'];
const SERIES_COLS = ['series', 'family', 'core', 'isa'];
const EVIDENCE_COLS = [
  'part_number', 'pin', 'pad', 'kind', 'type', 'confidence', 'basis', 'table', 'datasheet',
];

type TableRow = Record<string, string | number>;

function csvTable(columns: string[], rows: TableRow[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => String(row[col] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function part(id: string, overrides: Partial<TableRow> = {}): TableRow {
  return {
    part_number: id,
    series: 'CH32V003',
    family: 'CH32V003',
    package: 'TSSOP20',
    pins: 20,
    flash_bytes: 16384,
    sram_bytes: 2048,
    gpio_count: 18,
    ...overrides,
  };
}

function pinout(id: string, pin: string | number, pad: string, overrides: Partial<TableRow> = {}): TableRow {
  return {
    part_number: id,
    series: 'CH32V003',
    family: 'CH32V003',
    pin,
    pad,
    port: pad.slice(1, 2),
    gpio: pad.slice(2),
    kind: 'gpio',
    peripheral: '',
    role: '',
    signal: '',
    route: 'default',
    selector: '',
    value: '',
    af: '',
    condition: '',
    confidence: 'confirmed',
    basis: 'fixture:test',
    ...overrides,
  };
}

interface Fixture {
  parts?: TableRow[];
  pinouts?: TableRow[];
  routes?: TableRow[];
  series?: TableRow[];
  packages?: TableRow[];
  evidence?: TableRow[];
}

/** Default electrical-kind rows: selected pads are upstream `I/O/FT`. */
function defaultEvidence(pinouts: TableRow[]): TableRow[] {
  const ftPads = new Set(['PC1', 'PC2', 'PC5', 'PC6']);
  return pinouts
    .filter((row) => row.kind === 'gpio')
    .map((row) => ({
      part_number: row.part_number,
      pin: row.pin,
      pad: row.pad,
      kind: row.kind,
      type: ftPads.has(String(row.pad)) ? 'I/O/FT' : 'I/O',
      confidence: 'confirmed',
      basis: 'fixture:test',
      table: '2-1',
      datasheet: 'fixture',
    }));
}

/** Writes a complete manifest-verified `index/` surface for one CH32 source. */
function writeFixture(root: string, fixture: Fixture): string {
  const sourceDir = path.join(root, '.cache', 'ch32-device-data');
  const indexDir = path.join(sourceDir, 'index');
  const evidenceDir = path.join(sourceDir, 'evidence');
  fs.mkdirSync(indexDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const pinoutRows = fixture.pinouts ?? [pinout('CH32V003F4P6', 1, 'PD4')];
  fs.writeFileSync(
    path.join(evidenceDir, 'pins.csv'),
    csvTable(EVIDENCE_COLS, fixture.evidence ?? defaultEvidence(pinoutRows)),
  );

  const tables: Record<string, string> = {
    'parts.csv': csvTable(PART_COLS, fixture.parts ?? [part('CH32V003F4P6')]),
    'pinout.csv': csvTable(PINOUT_COLS, pinoutRows),
    'routes.csv': csvTable(ROUTE_COLS, fixture.routes ?? []),
    'packages.csv': csvTable(PACKAGE_COLS, fixture.packages ?? [
      { package: 'TSSOP20', pin_count: 20 },
      { package: 'SOP8', pin_count: 8 },
      { package: 'LQFP48', pin_count: 48 },
      { package: 'QFN28', pin_count: 28 },
    ]),
    'series.csv': csvTable(SERIES_COLS, fixture.series ?? [
      { series: 'CH32V003', family: 'CH32V003', core: 'QingKe V2A', isa: 'RV32EC' },
      { series: 'CH32V203', family: 'CH32V20x', core: 'QingKe V4B', isa: 'RV32IMAC' },
      { series: 'CH32X035', family: 'CH32X035', core: 'QingKe V4C', isa: 'RV32IMAC' },
    ]),
  };
  const manifestRows = Object.entries(tables).map(([name, content]) => ({
    path: name,
    rows: parseCsv(content).rows.length,
    sha256: sha256Hex(content),
  }));
  tables['manifest.csv'] = csvTable(['path', 'rows', 'sha256'], manifestRows);
  for (const [name, content] of Object.entries(tables)) {
    fs.writeFileSync(path.join(indexDir, name), content);
  }
  return sourceDir;
}

function adapterWithFixtureSource(sourceDir: string): VendorAdapter {
  const spec = ch32Adapter.sourceSpecs[0];
  return { ...ch32Adapter, sourceSpecs: [{ ...spec, dir: sourceDir }] };
}

function sourceFor(root: string): ResolvedSource[] {
  return [{ ...ch32Adapter.sourceSpecs[0], dir: path.join(root, '.cache', 'ch32-device-data'), commit: resolveRevision(path.join(root, '.cache', 'ch32-device-data')) }];
}

function leads(id: string, count: number, padFor: (i: number) => string = (i) => `PA${i}`): TableRow[] {
  return Array.from({ length: count }, (_, i) => pinout(id, i + 1, padFor(i)));
}

function referenceRows(): TableRow[] {
  return [
    ...leads('CH32V003F4P6', 20, (i) => (i === 10 ? 'PC1' : `PA${i}`)),
    ...leads('CH32V003J4M6', 8, (i) => ['PD1', 'VDD', 'PA2', 'VSS', 'PC4', 'PC1', 'PD6', 'PD4'][i]),
    pinout('CH32V003J4M6', 1, 'PD6', { peripheral: 'SDI', role: 'SWDIO', signal: 'SWIO' }),
    ...leads('CH32V203C8T6', 48, (i) => (i === 10 ? 'PC2' : `PA${i}`)),
    ...leads('CH32X035G8U6', 28, (i) => (i === 10 ? 'PC5' : `PA${i}`)),
    pinout('CH32V203C8T6', 'EP', 'VSS', { kind: 'power' }),
    pinout('CH32X035G8U6', 'EP', 'GND', { kind: 'power' }),
  ];
}

function referenceParts(): TableRow[] {
  return [
    part('CH32V003F4P6'),
    part('CH32V003J4M6', { package: 'SOP8', pins: 8, gpio_count: 6 }),
    part('CH32V203C8T6', {
      series: 'CH32V203', family: 'CH32V20x', package: 'LQFP48', pins: 48,
      flash_bytes: 65536, sram_bytes: 20480,
    }),
    part('CH32X035G8U6', {
      series: 'CH32X035', family: 'CH32X035', package: 'QFN28', pins: 28,
      flash_bytes: 63488, sram_bytes: 20480,
    }),
  ];
}

function gateCtx(chips: Map<string, ChipData>, overrides: Partial<GateContext> = {}): GateContext {
  return {
    paths: {
      root: '/unused',
      cacheDir: '/unused/.cache',
      outDir: '/unused/public/data',
      chipsOutDir: '/unused/public/data/chips',
    },
    chips,
    index: [],
    totalVariants: chips.size,
    matchedVariants: chips.size,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    ...overrides,
  };
}

describe('CH32 CSV and manifest helpers', () => {
  it('parses quoted fields, CRLF endings, and named columns', () => {
    const parsed = parseCsv('a,b,c\r\n1,"two, three","say ""hi"""\r\n');
    expect(parsed.columns).toEqual(['a', 'b', 'c']);
    expect(parsed.rows).toEqual([{ a: '1', b: 'two, three', c: 'say "hi"' }]);
  });

  it('accepts matching digests and rejects a corrupted fixture by filename', () => {
    const root = tempRoot('pinspec-ch32-manifest-');
    const sourceDir = writeFixture(root, {});
    const entries = verifyCh32Sources(path.join(sourceDir, 'index'));
    expect(entries.size).toBe(CH32_CONSUMED_FILES.length);

    const pinoutPath = path.join(sourceDir, 'index', 'pinout.csv');
    fs.writeFileSync(pinoutPath, `${fs.readFileSync(pinoutPath, 'utf8')}CH32V003F4P6,CH32V003,CH32V003,99,PD7,D,7,gpio,,,,,default,,,,,confirmed,fixture:bad\n`);
    expect(() => verifyCh32Sources(path.join(sourceDir, 'index'))).toThrow(
      /CH32 manifest verification failed: SHA-256 mismatch for index\/pinout\.csv/,
    );
    expect(parseCh32Manifest(fs.readFileSync(path.join(sourceDir, 'index', 'manifest.csv'), 'utf8')).size)
      .toBeGreaterThan(0);
  });

  it('reads declared tolerance evidence with its digest and rejects missing or malformed files', () => {
    const root = tempRoot('pinspec-ch32-evidence-');
    const sourceDir = writeFixture(root, {});
    const evidencePath = path.join(sourceDir, 'evidence', 'pins.csv');
    const evidence = readCh32ToleranceEvidence(sourceDir);
    expect(evidence.rows.length).toBeGreaterThan(0);
    expect(evidence.sha256).toBe(sha256Hex(fs.readFileSync(evidencePath)));
    expect(evidence.declared.path).toBe('evidence/pins.csv');
    expect(evidence.declared.columns).toEqual(['part_number', 'pin', 'pad', 'type']);

    fs.writeFileSync(evidencePath, 'part_number,pin\nCH32V003F4P6,11\n');
    expect(() => readCh32ToleranceEvidence(sourceDir)).toThrow(
      /CH32 source evidence\/pins\.csv is missing required column/,
    );
    fs.rmSync(evidencePath);
    expect(() => readCh32ToleranceEvidence(sourceDir)).toThrow(
      /CH32 evidence verification failed: missing evidence\/pins\.csv/,
    );
  });

  it('aborts generation when the declared tolerance evidence is absent', () => {
    const root = tempRoot('pinspec-ch32-evidence-abort-');
    const sourceDir = writeFixture(root, {});
    fs.rmSync(path.join(sourceDir, 'evidence', 'pins.csv'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [adapterWithFixtureSource(sourceDir)])).toThrow(
        /missing evidence\/pins\.csv/,
      );
      expect(fs.readdirSync(path.join(root, 'public', 'data', 'chips'))).toEqual([]);
      expect(fs.existsSync(path.join(root, 'public', 'data', 'meta.json'))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('aborts generation with a named error and writes no CH32 shards on digest mismatch', () => {
    const root = tempRoot('pinspec-ch32-abort-');
    const sourceDir = writeFixture(root, {});
    const indexDir = path.join(sourceDir, 'index');
    const partsPath = path.join(indexDir, 'parts.csv');
    fs.writeFileSync(partsPath, fs.readFileSync(partsPath, 'utf8').replace('16384', '16385'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [adapterWithFixtureSource(sourceDir)])).toThrow(
        /SHA-256 mismatch for index\/parts\.csv/,
      );
      const chipsDir = path.join(root, 'public', 'data', 'chips');
      expect(fs.existsSync(chipsDir)).toBe(true);
      expect(fs.readdirSync(chipsDir)).toEqual([]);
      expect(fs.existsSync(path.join(root, 'public', 'data', 'meta.json'))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('maps routes, pin types, and register notes without fabricating evidence', () => {
    expect(routeToRemapId('main')).toBe(0);
    expect(routeToRemapId('default')).toBe(0);
    expect(routeToRemapId('af-7')).toBe(0);
    expect(routeToRemapId('remap-3')).toBe(3);
    expect(mapPinType('power', 'VDD')).toBe('power');
    expect(mapPinType('other', 'NRST')).toBe('reset');
    expect(mapPinType('other', 'BOOT0')).toBe('boot');
    expect(mapPinType('analog', 'PA0')).toBe('io');
    expect(mapPinType('nc', 'NC')).toBe('nc');

    const routeIndex = new Map([['CH32V003|afio-usart1-remap|1', { register: 'PCFR1', bits: 'PCFR1:2;PCFR1:3' }]]);
    expect(buildRegisterNote('CH32V003', 'afio-usart1-remap', '1', routeIndex)).toBe('PCFR1[2] = 1');
    expect(buildRegisterNote('CH32V003', 'afio-usart1-remap', '2', routeIndex)).toBeUndefined();
    expect(buildRegisterNote('CH32V003', '', '', routeIndex)).toBeUndefined();
  });
});

describe('CH32 parts, packages, and physical pins', () => {
  it('emits exactly 105 covered parts with vendor tags and non-zero memory', () => {
    const root = tempRoot('pinspec-ch32-parts-');
    const allParts = Array.from({ length: 105 }, (_, i) =>
      part(`CH32V003X${String(i).padStart(3, '0')}6`, { flash_bytes: 16384 + i, sram_bytes: 2048 }),
    );
    const sourceDir = writeFixture(root, {
      parts: allParts,
      pinouts: allParts.map((p) => pinout(String(p.part_number), 1, 'PD4')),
    });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });
    expect(result.index).toHaveLength(105);
    expect(result.chips.size).toBe(105);
    expect(result.index.every((entry) => entry.vendor === 'ch32')).toBe(true);
    expect(Array.from(result.chips.values()).every((chip) =>
      chip.vendor === 'ch32' && chip.muxModel === 'remap-group' && (chip.flashKb ?? 0) > 0 && chip.ramKb > 0,
    )).toBe(true);
    expect(result.families).toEqual(['CH32V003']);
  });

  it('keeps one position per physical lead and folds EP into hasExposedPad', () => {
    const root = tempRoot('pinspec-ch32-geometry-');
    const parts = referenceParts();
    const mixedLeads = leads('CH32V003F4P6', 20, (i) =>
      i === 6 ? 'VDD' : i === 8 ? 'VSS' : i === 9 ? 'NRST' :
      i === 10 ? 'BOOT0' : i === 11 ? 'NC' : `PA${i}`,
    );
    const mixedKinds = new Map<number, string>([[7, 'power'], [9, 'power'], [10, 'other'], [11, 'other'], [12, 'nc']]);
    for (const row of mixedLeads) {
      const kind = mixedKinds.get(Number(row.pin));
      if (kind) row.kind = kind;
    }
    const pinouts = [
      ...mixedLeads,
      ...leads('CH32V203C8T6', 48),
      ...leads('CH32X035G8U6', 28),
      pinout('CH32V203C8T6', 'EP', 'VSS', { kind: 'power' }),
      pinout('CH32X035G8U6', 'EP', 'GND', { kind: 'power' }),
    ];
    writeFixture(root, { parts, pinouts });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });

    const f4 = result.chips.get('CH32V003F4P6')!;
    const c8 = result.chips.get('CH32V203C8T6')!;
    const g8 = result.chips.get('CH32X035G8U6')!;
    expect(f4.pins).toHaveLength(20);
    expect(f4.package.pinCount).toBe(20);
    expect(f4.package.hasExposedPad).toBeUndefined();
    expect(c8.pins).toHaveLength(48);
    expect(c8.package.pinCount).toBe(48);
    expect(c8.package.hasExposedPad).toBe(true);
    expect(g8.pins).toHaveLength(28);
    expect(g8.package.pinCount).toBe(28);
    expect(g8.package.hasExposedPad).toBe(true);
    for (const chip of [f4, c8, g8]) {
      expect(new Set(chip.pins.map((p) => p.pos)).size).toBe(chip.pins.length);
      expect(chip.pins.some((p) => p.pos.toUpperCase() === 'EP')).toBe(false);
    }
    expect(f4.pins.find((p) => p.pos === '7')?.type).toBe('power');
    expect(f4.pins.find((p) => p.pos === '10')?.type).toBe('reset');
    expect(f4.pins.find((p) => p.pos === '11')?.type).toBe('boot');
    expect(f4.pins.find((p) => p.pos === '12')?.type).toBe('nc');
    expect(f4.package.sides).toEqual([10, 0, 10, 0]);
  });
});

describe('CH32 bonded pads, signals, remaps, and tags', () => {
  it('merges bonded pads, deduplicates signals, and keeps eight SOP8 leads', () => {
    const root = tempRoot('pinspec-ch32-bonded-');
    const pinouts = leads('CH32V003J4M6', 8, (i) => ['PD1', 'VDD', 'PA2', 'VSS', 'PC4', 'PC1', 'PD6', 'PD4'][i]);
    pinouts.push(
      pinout('CH32V003J4M6', 1, 'PD1', { peripheral: 'SDI', role: 'SWDIO', signal: 'SWIO' }),
      pinout('CH32V003J4M6', 1, 'PD6', { peripheral: 'SDI', role: 'SWDIO', signal: 'SWIO' }),
      pinout('CH32V003J4M6', 1, 'PD1', { peripheral: 'USART1', role: 'TX', signal: 'UTX', route: 'remap-2', selector: 'afio-usart1-remap', value: 2 }),
      pinout('CH32V003J4M6', 1, 'PD6', { peripheral: 'USART1', role: 'TX', signal: 'UTX', route: 'remap-2', selector: 'afio-usart1-remap', value: 2 }),
    );
    writeFixture(root, { parts: [part('CH32V003J4M6', { package: 'SOP8', pins: 8 })], pinouts });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });
    const chip = result.chips.get('CH32V003J4M6')!;
    expect(chip.pins).toHaveLength(8);
    const bonded = chip.pins.find((p) => p.bondedNames)!;
    expect(bonded.bondedNames).toEqual(['PD1', 'PD6']);
    expect(bonded.tags).toContain('bonded');
    const debugSignals = bonded.signals.filter((s) => s.peripheral === 'SDI' && s.signal === 'SWDIO');
    expect(debugSignals).toHaveLength(1);
    const remapTx = bonded.signals.filter((s) => s.peripheral === 'USART1' && s.signal === 'TX' && s.remapId === 2);
    expect(remapTx).toHaveLength(1);
    expect(chip.peripherals.USART1.remaps?.map((r) => r.id)).toEqual([2]);
    expect(chip.peripherals.USART1.remaps?.[0].signals.TX).toBe('PD1');
  });

  it('groups default and remap routes with evidence-backed register notes only', () => {
    const root = tempRoot('pinspec-ch32-remaps-');
    const id = 'CH32V003F4P6';
    const pinouts = [
      ...leads(id, 20),
      pinout(id, 2, 'PD5', { peripheral: 'USART1', role: 'TX', signal: 'UTX', route: 'default' }),
      pinout(id, 3, 'PD6', { peripheral: 'USART1', role: 'RX', signal: 'URX', route: 'remap-1', selector: 'afio-usart1-remap', value: 1 }),
      pinout(id, 4, 'PD7', { peripheral: 'USART1', role: 'TX', signal: 'UTX', route: 'remap-2', selector: 'afio-usart1-remap', value: 2 }),
      pinout(id, 5, 'PA1', { peripheral: 'I2C1', role: 'SCL', signal: 'SCL' }),
    ];
    const routes = [
      { series: 'CH32V003', selector: 'afio-usart1-remap', controller: 'afio', register: 'PCFR1', bits: 'PCFR1:2;PCFR1:3', value: 1, peripheral: 'USART1', role: 'RX', signal: 'URX', pad: 'PD6', confidence: 'confirmed', basis: 'fixture' },
    ];
    writeFixture(root, { parts: [part(id)], pinouts, routes });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });
    const chip = result.chips.get(id)!;
    const usart = chip.peripherals.USART1;
    expect(usart.remaps?.map((r) => r.id)).toEqual([0, 1, 2]);
    expect(usart.remaps?.[0].registerNote).toBeUndefined();
    expect(usart.remaps?.[1].registerNote).toBe('PCFR1[2] = 1');
    expect(usart.remaps?.[2].registerNote).toBeUndefined();
    expect(usart.remaps?.[1].signals.RX).toBe('PD6');
    expect(chip.peripherals.I2C1.remaps?.map((r) => r.id)).toEqual([0]);
    expect(chip.peripherals.I2C1.remaps?.[0].registerNote).toBeUndefined();
    const sig = chip.pins.find((p) => p.pos === '3')!.signals.find((s) => s.peripheral === 'USART1')!;
    expect(sig.af).toBeNull();
    expect(sig.funcLabel).toBe('RM1');
    expect(sig.remapId).toBe(1);
  });

  it('tags FT pins by part, position, and pad while leaving plain I/O untagged', () => {
    const root = tempRoot('pinspec-ch32-ft-');
    const id = 'CH32V003F4P6';
    const pinouts = [
      pinout(id, 11, 'PC1'),
      pinout(id, 12, 'PC2'),
      pinout(id, 13, 'PD4'),
      pinout(id, 14, 'PC5'),
      pinout(id, 15, 'PC5'),
      pinout(id, 15, 'PC6'),
      pinout(id, 15, 'PC7'),
    ];
    const evidence = [
      { part_number: id, pin: 11, pad: 'PC1', kind: 'gpio', type: 'i/o/ft' },
      { part_number: id, pin: 12, pad: 'PC2', kind: 'gpio', type: 'I/O' },
      { part_number: id, pin: 13, pad: 'PD4', kind: 'gpio', type: 'I/O' },
      { part_number: id, pin: 13, pad: 'PD4', kind: 'gpio', type: 'I/O/FT' },
      { part_number: id.toLowerCase(), pin: ' 15 ', pad: ' pc5 ', kind: 'gpio', type: ' I/O/FT ' },
      { part_number: id, pin: 15, pad: 'PC6', kind: 'gpio', type: 'I/O/FT' },
      { part_number: id, pin: 15, pad: 'PC7', kind: 'gpio', type: 'I/O/FT' },
      { part_number: 'CH32V003OTHER6', pin: 12, pad: 'PC2', kind: 'gpio', type: 'I/O/FT' },
    ];
    writeFixture(root, { parts: [part(id)], pinouts, evidence });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });
    const chip = result.chips.get(id)!;
    expect(chip.pins.find((p) => p.pos === '11')?.tags).toContain('5v-tolerant');
    expect(chip.pins.find((p) => p.pos === '12')?.tags ?? []).not.toContain('5v-tolerant');
    expect(chip.pins.find((p) => p.pos === '13')?.tags).toContain('5v-tolerant');
    const bonded = chip.pins.find((p) => p.pos === '15')!;
    expect(bonded.bondedNames).toEqual(['PC5', 'PC6', 'PC7']);
    expect(bonded.tags?.filter((tag) => tag === '5v-tolerant')).toHaveLength(1);
    expect(bonded.tags).toContain('bonded');
  });

  it('applies semantic tags only where source evidence supports them', () => {
    expect(derivePinTags([
      { peripheral: 'SDI', role: 'SWDIO', signal: 'SWIO' },
      { peripheral: 'SDI', role: 'SWDIO', signal: 'SWDIO' },
    ])).toEqual(['debug-sdi', 'debug-swd']);
    expect(derivePinTags([{ peripheral: 'USBPD', role: 'CC1', signal: 'CC1' }])).toEqual(['usb']);
    expect(derivePinTags([{ peripheral: 'ADC1', role: 'IN0', signal: 'A0' }])).toEqual(['adc']);
    expect(derivePinTags([{ peripheral: 'ADC1', role: 'IETR', signal: 'AETR2' }])).toEqual([]);
    expect(derivePinTags([{ peripheral: 'SYS', role: 'BOOT0', signal: 'BOOT0' }])).toEqual(['boot']);
    expect(derivePinTags([
      { peripheral: 'GPIO', role: 'OUT', signal: 'OUT', condition: '5V tolerant when VDD=3.3V' },
    ])).toEqual(['5v-tolerant']);
    expect(derivePinTags([{ peripheral: 'GPIO', role: 'OUT', signal: 'OUT' }])).toEqual([]);
  });
});

describe('CH32 deferral, gates, provenance, and registration', () => {
  it('defers low-confidence, uncovered, and pinout-only parts without failing', () => {
    const root = tempRoot('pinspec-ch32-defer-');
    const good = part('CH32V003GOOD6');
    const low = part('CH32V003LOW6');
    const noPinout = part('CH32V003NONE6');
    const pinouts = [
      pinout('CH32V003GOOD6', 1, 'PD4'),
      pinout('CH32V003LOW6', 1, 'PD4', { confidence: 'conflict', basis: 'ds:en+!ds:zh' }),
      pinout('CH32V003ORPHAN6', 1, 'PD4'),
    ];
    writeFixture(root, { parts: [good, low, noPinout], pinouts });
    const warnings = createWarningCollector();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = generateCh32({ paths: {
        root, cacheDir: path.join(root, '.cache'),
        outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
      }, sources: sourceFor(root), warnings });
      expect(Array.from(result.chips.keys())).toEqual(['CH32V003GOOD6']);
      const all = warnings.all();
      expect(all).toHaveLength(3);
      expect(all.every((w) => w.vendor === 'ch32')).toBe(true);
      expect(all.map((w) => w.refName).sort()).toEqual([
        'CH32V003LOW6', 'CH32V003NONE6', 'CH32V003ORPHAN6',
      ]);
      expect(all.find((w) => w.refName === 'CH32V003LOW6')?.reason).toContain('confidence');
      expect(result.totalVariants).toBe(4);
      expect(result.matchedVariants).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('passes the four reference assertions and names malformed parts', () => {
    const root = tempRoot('pinspec-ch32-gate-');
    writeFixture(root, { parts: referenceParts(), pinouts: referenceRows() });
    const result = generateCh32({ paths: {
      root, cacheDir: path.join(root, '.cache'),
      outDir: path.join(root, 'public', 'data'), chipsOutDir: path.join(root, 'public', 'data', 'chips'),
    }, sources: sourceFor(root), warnings: createWarningCollector() });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(ch32ReferenceGate.evaluate(gateCtx(result.chips)).errors).toEqual([]);
      const logs = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      for (const id of ['CH32V003F4P6', 'CH32V003J4M6', 'CH32V203C8T6', 'CH32X035G8U6']) {
        expect(logs).toContain(`ch32 reference: ${id}`);
      }
      const withoutFt = new Map(
        Array.from(result.chips, ([id, chip]) => [
          id,
          {
            ...chip,
            pins: chip.pins.map((p) => ({
              ...p,
              tags: p.tags?.filter((tag) => tag !== '5v-tolerant'),
            })),
          },
        ]),
      );
      const ftErrors = ch32ReferenceGate.evaluate(gateCtx(withoutFt)).errors;
      expect(ftErrors.some((e) => e.includes('CH32V003F4P6') && e.includes('5v-tolerant'))).toBe(true);

      const j4 = result.chips.get('CH32V003J4M6')!;
      j4.pins = j4.pins.slice(0, 7);
      const errors = ch32ReferenceGate.evaluate(gateCtx(result.chips)).errors;
      expect(errors.some((e) => e.includes('CH32V003J4M6') && e.includes('got 7'))).toBe(true);
      expect(ch32CountGate.evaluate(gateCtx(result.chips, { index: result.index })).errors[0])
        .toContain('expected 105 covered parts, got 4');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('records CH32 revision and chip count in meta.json with vendor-tagged shards', () => {
    const root = tempRoot('pinspec-ch32-meta-');
    const sourceDir = writeFixture(root, { parts: referenceParts(), pinouts: referenceRows() });
    execSync('git init -q', { cwd: sourceDir });
    fs.writeFileSync(path.join(sourceDir, 'fixture.txt'), 'verified fixture\n');
    execSync('git add .', { cwd: sourceDir });
    execSync(
      'git -c user.name=Fixture -c user.email=fixture@example.invalid commit -q -m fixture',
      { cwd: sourceDir },
    );
    const expectedCommit = resolveRevision(sourceDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const adapter = { ...adapterWithFixtureSource(sourceDir), gates: [] };
      const summary = generateCatalog(root, [adapter]);
      const metaPath = path.join(root, 'public', 'data', 'meta.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      expect(summary.meta.sources?.ch32?.commit).toBe(expectedCommit);
      expect(meta.sources.ch32.commit).toBe(expectedCommit);
      expect(meta.sources.ch32.chipCount).toBe(4);
      expect(meta.sources.ch32.license).toBe('MIT');
      expect(meta.sources.ch32.evidenceFiles).toHaveLength(1);
      expect(meta.sources.ch32.evidenceFiles[0]).toMatchObject({
        path: 'evidence/pins.csv',
        sha256: sha256Hex(fs.readFileSync(path.join(sourceDir, 'evidence', 'pins.csv'))),
        license: 'MIT',
      });
      const index = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'index.json'), 'utf8'));
      expect(index).toHaveLength(4);
      expect(index.every((e: { vendor: string }) => e.vendor === 'ch32')).toBe(true);
      const shard = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'chips', 'CH32V003J4M6.json'), 'utf8'));
      expect(shard.vendor).toBe('ch32');
      expect(shard.muxModel).toBe('remap-group');
      expect(shard.pins.every((p: { signals: Array<{ af: number | null }> }) => p.signals.every((s) => s.af === null))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('registers all three adapters without changing the STM32 adapter contract', () => {
    expect(DEFAULT_ADAPTERS.map((a) => a.vendor)).toEqual(['stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic']);
    expect(DEFAULT_ADAPTERS[0]).toBe(stm32Adapter);
    expect(DEFAULT_ADAPTERS[1]).toBe(ch32Adapter);
    expect(DEFAULT_ADAPTERS[2]).toBe(rpAdapter);
    expect(stm32Adapter.gates).toHaveLength(2);
    expect(stm32Adapter.sourceSpecs.map((s) => s.id)).toEqual([
      'stm32-open-pin-data', 'embassy-stm32-data',
    ]);
  });
});
