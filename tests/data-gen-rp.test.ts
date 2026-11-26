/** Offline RP adapter tests: every fixture is written locally, no network. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChipData } from '../src/core/types';
import {
  DEFAULT_ADAPTERS,
  generateCatalog,
} from '../tools/data-gen/index';
import {
  deriveRpTags,
  generateRp,
  RP_PART_SPECS,
  rpAdapter,
  rpCountGate,
  rpIndexEntry,
  rpReferenceGate,
  RP_REFERENCES,
} from '../tools/data-gen/adapters/rp';
import {
  parsePicotoolFuncsel,
  parsePicoSdkFuncsel,
  funcselSignalsForGpio,
  pioInstanceCount,
} from '../tools/data-gen/adapters/rp/funcsel';
import {
  gpioBaseOptions,
  parseDocumentationVariants,
  parseRp2040DocFacts,
  parseZephyrFacts,
} from '../tools/data-gen/adapters/rp/variants';
import { rpSourceSpecs } from '../tools/data-gen/sources';
import type { GateContext, ResolvedSource, VendorAdapter } from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';

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

const SYMBOL_DIR = 'MCU_RaspberryPi.kicad_symdir';
const FOOTPRINT_DIR = 'Package_DFN_QFN.pretty';
const DOC_DIR = 'documentation/asciidoc/microcontrollers/microcontroller-chips';

function pin(name: string, number: number, electrical = 'bidirectional'): string {
  return `      (pin ${electrical} line (at 0 0 0) (length 1) (name "${name}") (number "${number}"))`;
}

/** Writes a synthetic KiCad symbol with `leads` numbered pads plus GND EP. */
function writeSymbol(root: string, name: string, leads: number, gpioCount: number, adcStart: number): void {
  const specials = [
    'IOVDD', 'SWCLK', 'SWDIO', 'RUN', 'XIN', 'XOUT', 'VREG_VIN', 'VREG_VOUT',
    'DVDD', 'ADC_AVDD', 'USB_DM', 'USB_DP', 'USB_VDD', 'QSPI_SD3',
    'QSPI_SCLK', 'QSPI_SD0', 'QSPI_SD2', 'QSPI_SD1', '~{QSPI_SS}',
  ];
  const pins: string[] = [];
  let pos = 1;
  for (const special of specials) {
    pins.push(pin(special, pos++, /VDD|VREG|AVDD/.test(special) ? 'power_in' : 'input'));
  }
  for (let gpio = 0; gpio < gpioCount; gpio++) {
    const adcIndex = gpio - adcStart;
    const label = adcIndex >= 0 ? `GPIO${gpio}/ADC${adcIndex}` : `GPIO${gpio}`;
    pins.push(pin(label, pos++));
  }
  while (pins.length < leads) pins.push(pin(`NC${pos}`, pos++));
  pins.push(pin('GND', leads + 1, 'power_in'));
  const text = `(kicad_symbol_lib (version 20251024)\n  (symbol "${name}"\n    (symbol "${name}_1_1"\n${pins.join('\n')}\n    )\n  )\n)\n`;
  const dir = path.join(root, '.cache', 'kicad-symbols', SYMBOL_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.kicad_sym`), text);
}

/** Writes a synthetic footprint with `leads` pads and one heat-sink pad. */
function writeFootprint(root: string, footprint: string, leads: number): void {
  const pads: string[] = [];
  for (let i = 1; i <= leads; i++) {
    const side = i % 4;
    const at = side === 0 ? '-1 0' : side === 1 ? '1 0' : side === 2 ? '0 -1' : '0 1';
    const size = side < 2 ? '0.2 0.8' : '0.8 0.2';
    pads.push(`  (pad "${i}" smd rect (at ${at}) (size ${size}))`);
  }
  pads.push('  (pad "" smd rect (at 0 0) (size 2 2) (layers "F.Paste"))');
  pads.push('  (pad "EP" smd rect (at 0 0) (size 3 3) (property pad_prop_heatsink))');
  const dir = path.join(root, '.cache', 'kicad-footprints', FOOTPRINT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${footprint}.kicad_mod`),
    `(footprint "${footprint}"\n${pads.join('\n')}\n)\n`,
  );
}

/** Builds a picotool-style C++ FUNCSEL table with explicit, non-formula cells. */
function writePicotool(root: string): void {
  const make = (id: string, gpioCount: number, functions: Array<Map<number, string>>): string => {
    const rows: string[] = [];
    for (const cells of functions) {
      const values = Array.from({ length: gpioCount }, (_, gpio) => `"${cells.get(gpio) ?? ''}"`);
      rows.push(`    {${values.join(', ')}}`);
    }
    return `std::array<std::array<string, ${gpioCount}>, ${functions.length}> pin_functions_${id}{{\n${rows.join('\n')}\n}};\n`;
  };
  const rp2040F1 = new Map([[2, 'SPI0 SCK']]);
  const rp2040F4 = new Map([[15, 'PWM7 B']]);
  const rp2040F5 = new Map([[0, 'SIO']]);
  const rp2350F0 = new Map(Array.from({ length: 8 }, (_, i) => [12 + i, `HSTX${i}`]));
  const rp2350F1 = new Map([[2, 'SPI0 SCK'], [40, 'SPI1 RX']]);
  const rp2350F4 = new Map([[15, 'PWM7 B'], [32, 'PWM8 A'], [47, 'PWM11 B']]);
  const rp2350F6 = new Map([[0, 'PIO0'], [1, 'PIO1'], [2, 'PIO2']]);
  const rp2350F11 = new Map([[2, 'UART0 TX']]);
  const text = [
    make('rp2040', 30, [new Map(), rp2040F1, new Map(), new Map(), rp2040F4, rp2040F5]),
    make('rp2350', 48, [
      rp2350F0, rp2350F1, new Map(), new Map(), rp2350F4, new Map(), rp2350F6,
      new Map(), new Map(), new Map(), new Map(), rp2350F11,
    ]),
  ].join('\n');
  const dir = path.join(root, '.cache', 'picotool');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'main.cpp'), text);
}

/** Minimal pico-sdk Doxygen fallback table for the same RP2040 facts. */
function writePicoSdk(root: string): void {
  const text = [
    ' * | GPIO | F1       | F4     |',
    ' * |------|----------|--------|',
    ' * | 2    | SPI0 SCK |        |',
    ' * | 15   |          | PWM7 B |',
    ' * | GPIO | F0   | F1       | F2 | F3 | F4     | F5 | F6   | F7 | F8 | F9 | F10 | F11      |',
    ' * |------|------|----------|----|----|--------|----|------|----|----|----|-----|----------|',
    ' * | 2    |      | SPI0 SCK |    |    |        |    | PIO2 |    |    |    |     | UART0 TX |',
    ' * | 12   | HSTX |          |    |    |        |    | PIO2 |    |    |    |     |          |',
    ' * | 15   |      |          |    |    | PWM7 B |    | PIO2 |    |    |    |     |          |',
  ].join('\n');
  const file = path.join(root, '.cache', 'pico-sdk', 'src/rp2_common/hardware_gpio/include/hardware/gpio.h');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function writeVariantSources(root: string): void {
  const zephyr = {
    'dts/arm/raspberrypi/rpi_pico/rp2040.dtsi':
      'sram0: memory@20000000 { reg = <0x20000000 DT_SIZE_K(264)>; };\nngpios = <30>;\n',
    'dts/vendor/raspberrypi/rpi_pico/rp2350.dtsi':
      'sram0: memory@20000000 { reg = <0x20000000 DT_SIZE_K(520)>; };\nngpios = <32>;\nngpios = <32>;\n',
    'dts/vendor/raspberrypi/rpi_pico/rp2350a.dtsi': 'ngpios = <30>;\n',
    'dts/vendor/raspberrypi/rpi_pico/rp2350b.dtsi': 'ngpios = <32>;\nngpios = <16>;\n',
  };
  for (const [relPath, text] of Object.entries(zephyr)) {
    const file = path.join(root, '.cache', 'zephyr', relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  const docs: Record<string, string> = {
    'rp2040.adoc': 'RP2040 comes in QFN-56 with 264 kB of on-chip SRAM and no built-in flash memory.\n',
    'rp2350.adoc': `|===\n|Variant |Package |Internal flash memory |GPIO pins |Analogue inputs|PWM channels\n\n` +
      `|*RP2350A* |QFN-60 |None |30 |4 |16\n` +
      `|*RP2350B* |QFN-80 |None |48 |8 |24\n` +
      `|*RP2354A* |QFN-60 |Stacked 2 MB flash |30 |4 |16\n` +
      `|*RP2354B* |QFN-80 |Stacked 2 MB flash |48 |8 |24\n|===\n`,
  };
  for (const [name, text] of Object.entries(docs)) {
    const file = path.join(root, '.cache', 'raspberrypi-documentation', DOC_DIR, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

/** Writes a complete offline RP source tree covering all five reference parts. */
function writeFixture(root: string): void {
  for (const spec of RP_PART_SPECS) {
    const qfn = Number.parseInt(/QFN-(\d+)/.exec(spec.footprint)![1], 10);
    const gpioCount = qfn === 80 ? 48 : 30;
    writeSymbol(root, spec.symbol, qfn, gpioCount, qfn === 80 ? 40 : 26);
  }
  for (const footprint of Array.from(new Set(RP_PART_SPECS.map((s) => s.footprint)))) {
    writeFootprint(root, footprint, Number.parseInt(/QFN-(\d+)/.exec(footprint)![1], 10));
  }
  writePicotool(root);
  writePicoSdk(root);
  writeVariantSources(root);
}

function sourceFor(root: string): ResolvedSource[] {
  return rpSourceSpecs(root).map((spec) => ({
    ...spec,
    dir: path.join(root, '.cache', path.basename(spec.dir)),
    commit: 'fixture',
  }));
}

function pathsFor(root: string) {
  const outDir = path.join(root, 'public', 'data');
  return { root, cacheDir: path.join(root, '.cache'), outDir, chipsOutDir: path.join(outDir, 'chips') };
}

function gateCtx(chips: Map<string, ChipData>, overrides: Partial<GateContext> = {}): GateContext {
  return {
    paths: pathsFor('/unused'),
    chips,
    index: [],
    totalVariants: 5,
    matchedVariants: chips.size,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    ...overrides,
  };
}

describe('RP source and variant normalization', () => {
  it('parses Zephyr SRAM/GPIO overrides and the documentation variant table', () => {
    expect(parseZephyrFacts([
      'sram0: memory@20000000 { DT_SIZE_K(520); };\nngpios = <32>;\nngpios = <32>;\n',
      'ngpios = <30>;\n',
    ])).toEqual({ ramKb: 520, gpioCount: 30 });
    expect(parseZephyrFacts(['DT_SIZE_K(264);\nngpios = <32>;\nngpios = <16>;']).gpioCount).toBe(48);

    const root = tempRoot('pinspec-rp-variants-');
    writeVariantSources(root);
    const rp2040 = fs.readFileSync(path.join(root, '.cache', 'raspberrypi-documentation', DOC_DIR, 'rp2040.adoc'), 'utf8');
    const rp2350 = fs.readFileSync(path.join(root, '.cache', 'raspberrypi-documentation', DOC_DIR, 'rp2350.adoc'), 'utf8');
    expect(parseRp2040DocFacts(rp2040)).toMatchObject({ id: 'RP2040', flashKb: 0, package: 'QFN-56' });
    const variants = parseDocumentationVariants(rp2350);
    expect(variants.get('RP2354A')).toMatchObject({ flashKb: 2048, gpioCount: 30, adcCount: 4 });
    expect(variants.get('RP2354B')).toMatchObject({ flashKb: 2048, gpioCount: 48, pwmChannels: 24 });
    expect(variants.get('RP2350B')?.flashKb).toBe(0);
    expect(gpioBaseOptions(30)).toEqual([0]);
    expect(gpioBaseOptions(48)).toEqual([0, 16]);
  });
});

describe('RP generation from synthetic upstream fixtures', () => {
  it('emits five vendor-tagged chips with correct package, memory and PIO facts', () => {
    const root = tempRoot('pinspec-rp-generate-');
    writeFixture(root);
    const result = generateRp({ paths: pathsFor(root), sources: sourceFor(root), warnings: createWarningCollector() });
    expect(Array.from(result.chips.keys())).toEqual(RP_PART_SPECS.map((s) => s.id));
    expect(result.index.every((e) => e.vendor === 'rp')).toBe(true);
    expect(result.families).toEqual(['RP2040', 'RP2350']);

    const expectations: Record<string, { pkg: string; pins: number; gpio: number; flash: number; ram: number; pio: number; bases: number[] }> = {
      RP2040: { pkg: 'QFN-56', pins: 56, gpio: 30, flash: 0, ram: 264, pio: 2, bases: [0] },
      RP2350A: { pkg: 'QFN-60', pins: 60, gpio: 30, flash: 0, ram: 520, pio: 3, bases: [0] },
      RP2350B: { pkg: 'QFN-80', pins: 80, gpio: 48, flash: 0, ram: 520, pio: 3, bases: [0, 16] },
      RP2354A: { pkg: 'QFN-60', pins: 60, gpio: 30, flash: 2048, ram: 520, pio: 3, bases: [0] },
      RP2354B: { pkg: 'QFN-80', pins: 80, gpio: 48, flash: 2048, ram: 520, pio: 3, bases: [0, 16] },
    };
    for (const [id, exp] of Object.entries(expectations)) {
      const chip = result.chips.get(id)!;
      expect(chip.vendor, id).toBe('rp');
      expect(chip.muxModel, id).toBe('funcsel-pio');
      expect(chip.package.name, id).toBe(exp.pkg);
      expect(chip.pins, id).toHaveLength(exp.pins);
      expect(chip.package.pinCount, id).toBe(exp.pins);
      expect(chip.package.hasExposedPad, id).toBe(true);
      expect(chip.pins.filter((p) => /^GPIO\d+/.test(p.name)), id).toHaveLength(exp.gpio);
      expect(chip.flashKb, id).toBe(exp.flash);
      expect(chip.ramKb, id).toBe(exp.ram);
      expect(chip.pio?.instances, id).toHaveLength(exp.pio);
      expect(chip.pio?.stateMachinesPerInstance, id).toBe(4);
      expect(chip.pio?.gpioBaseOptions, id).toEqual(exp.bases);
      expect(chip.pins.some((p) => p.type === 'power'), id).toBe(true);
      expect(chip.pins.find((p) => p.name === 'RUN')?.type, id).toBe('reset');
      const adcPad = id === 'RP2350B' || id === 'RP2354B' ? 'GPIO40/ADC0' : 'GPIO26/ADC0';
      expect(chip.pins.find((p) => p.name === adcPad)?.tags, id).toContain('adc');
      expect(chip.pins.find((p) => p.name === 'SWCLK')?.tags, id).toContain('debug-swd');
      expect(chip.pins.find((p) => p.name === 'QSPI_SCLK')?.tags, id).toContain('qspi');
      expect(chip.pins.find((p) => p.name === 'USB_DM')?.tags, id).toContain('usb');
    }
  });

  it('joins FUNCSEL by GPIO number and derives PWM resource IDs from table cells', () => {
    const root = tempRoot('pinspec-rp-funcsel-');
    writeFixture(root);
    const result = generateRp({ paths: pathsFor(root), sources: sourceFor(root), warnings: createWarningCollector() });
    const rp2040 = result.chips.get('RP2040')!;
    const sck = rp2040.pins.find((p) => p.name === 'GPIO2')!.signals.find((s) => s.peripheral === 'SPI0');
    expect(sck).toMatchObject({ signal: 'SCK', af: 1, funcLabel: 'F1' });
    const pwm7b = rp2040.pins.find((p) => p.name === 'GPIO15')!.signals.find((s) => s.resourceId);
    expect(pwm7b).toMatchObject({ peripheral: 'PWM', signal: 'PWM7B', af: 4, funcLabel: 'F4', resourceId: 'PWM7B' });
    expect(rp2040.pins.find((p) => p.name === 'GPIO0')!.signals.some((s) => s.peripheral === 'SIO')).toBe(false);
    const slots = rp2040.pins.flatMap((p) => p.signals.map((s) => s.af as number));
    expect(Math.max(...slots)).toBe(4); // fixture slots F0-F5; real data reaches F9

    const b = result.chips.get('RP2350B')!;
    expect(b.pins.find((p) => p.name === 'GPIO40/ADC0')!.signals.some((s) => s.af === 1)).toBe(true);
    expect(b.pins.find((p) => p.name === 'GPIO47/ADC7')!.signals.some((s) => s.resourceId === 'PWM11B')).toBe(true);
    expect(b.pins.find((p) => p.name === 'GPIO12')!.tags).toContain('hstx');
    expect(b.pins.find((p) => p.name === 'GPIO12')!.signals.some((s) => s.peripheral === 'HSTX')).toBe(true);
    expect(b.pins.find((p) => p.name === 'GPIO2')!.signals.some((s) => s.funcLabel === 'F11')).toBe(true);
    const bSlices = b.pins.flatMap((p) => p.signals.map((s) => s.resourceId ?? '')).filter((id) => /^PWM/.test(id));
    expect(bSlices).toContain('PWM8A');
    expect(bSlices).toContain('PWM11B');
    for (const id of ['RP2040', 'RP2350A', 'RP2354A']) {
      const slices = result.chips.get(id)!.pins.flatMap((p) => p.signals.map((s) => s.resourceId ?? ''));
      expect(slices.some((s) => /^PWM(8|9|10|11)[AB]$/.test(s))).toBe(false);
    }
  });

  it('normalizes both FUNCSEL source shapes and derives PIO counts from labels', () => {
    const picotool = parsePicotoolFuncsel(
      'std::array<std::array<string, 2>, 2> pin_functions_rp2040{{\n{"", ""},\n{"SPI0 SCK", "PWM7 B"},\n}};\n',
    ).get('rp2040')!;
    expect(funcselSignalsForGpio(picotool, 0)).toMatchObject([
      { peripheral: 'SPI0', signal: 'SCK', af: 1, funcLabel: 'F1' },
    ]);
    expect(funcselSignalsForGpio(picotool, 1)).toMatchObject([
      { peripheral: 'PWM', resourceId: 'PWM7B', af: 1, funcLabel: 'F1' },
    ]);
    const sdkTable = parsePicoSdkFuncsel(
      '| GPIO | F0 | F1 | F2 |\n|------|------|----|----|\n| 5 | HSTX | PIO2 | UART0 TX |\n',
    ).get('rp2350')!;
    expect(funcselSignalsForGpio(sdkTable, 5).map((s) => s.funcLabel)).toEqual(['F0', 'F1', 'F2']);
    expect(pioInstanceCount(sdkTable)).toBe(3);
    expect(deriveRpTags('GPIO26/ADC0 (5V)', [])).toEqual(['5v-tolerant', 'adc']);
  });

  it('falls back to pico-sdk tables when picotool is unavailable', () => {
    const root = tempRoot('pinspec-rp-sdk-fallback-');
    writeFixture(root);
    const mainCpp = path.join(root, '.cache', 'picotool', 'main.cpp');
    fs.writeFileSync(mainCpp, '// no FUNCSEL arrays here\n');
    const collector = createWarningCollector();
    const result = generateRp({ paths: pathsFor(root), sources: sourceFor(root), warnings: collector });
    expect(result.chips.size).toBe(5);
    const sck = result.chips.get('RP2040')!.pins.find((p) => p.name === 'GPIO2')!.signals;
    expect(sck.some((s) => s.peripheral === 'SPI0' && s.funcLabel === 'F1')).toBe(true);
    expect(result.chips.get('RP2350B')!.pio?.instances).toHaveLength(3); // PIO2 comes from the fallback table
  });
});

describe('RP tags, defers, gates, provenance and registration', () => {
  it('warns and continues when a symbol file cannot be parsed', () => {
    const root = tempRoot('pinspec-rp-defer-');
    writeFixture(root);
    fs.writeFileSync(
      path.join(root, '.cache', 'kicad-symbols', SYMBOL_DIR, 'RP2350B.kicad_sym'),
      '(kicad_symbol_lib\n',
    );
    const collector = createWarningCollector();
    const result = generateRp({ paths: pathsFor(root), sources: sourceFor(root), warnings: collector });
    expect(result.chips.has('RP2350B')).toBe(false);
    expect(result.chips.size).toBe(4);
    const warnings = collector.all().filter((w) => w.vendor === 'rp');
    expect(warnings.some((w) => w.refName === 'RP2350B' && /parse error/i.test(w.reason))).toBe(true);
    const gate = rpReferenceGate.evaluate(gateCtx(result.chips, { warnings: collector.all() }));
    expect(gate.errors).toEqual([]);
    expect(gate.notes.some((n) => n.includes('RP2350B'))).toBe(true);
    expect(rpCountGate.evaluate(gateCtx(result.chips, {
      warnings: collector.all(), index: result.index,
      totalVariants: result.totalVariants, matchedVariants: result.matchedVariants,
    })).errors).toEqual([]);
  });

  it('passes all five reference assertions and names corrupted chips', () => {
    const root = tempRoot('pinspec-rp-gates-');
    writeFixture(root);
    const result = generateRp({ paths: pathsFor(root), sources: sourceFor(root), warnings: createWarningCollector() });
    expect(rpReferenceGate.evaluate(gateCtx(result.chips)).errors).toEqual([]);
    expect(rpCountGate.evaluate(gateCtx(result.chips, { index: result.index })).errors).toEqual([]);
    expect(RP_REFERENCES).toHaveLength(5);

    const corrupted = new Map(result.chips);
    const bad = result.chips.get('RP2354B')!;
    corrupted.set('RP2354B', {
      ...bad,
      pins: bad.pins.slice(0, 79),
      package: { ...bad.package, hasExposedPad: false },
      flashKb: 0,
    });
    const errors = rpReferenceGate.evaluate(gateCtx(corrupted)).errors;
    expect(errors.some((e) => e.includes('RP2354B') && e.includes('79'))).toBe(true);
    expect(errors.some((e) => e.includes('exposed-pad'))).toBe(true);
    expect(errors.some((e) => e.includes('2048 KB'))).toBe(true);
  });

  it('writes RP shards, vendor-tagged index entries and provenance via the orchestrator', () => {
    const root = tempRoot('pinspec-rp-pipeline-');
    writeFixture(root);
    const adapter: VendorAdapter = {
      ...rpAdapter,
      sourceSpecs: rpAdapter.sourceSpecs.map((spec) => ({
        ...spec,
        dir: path.join(root, '.cache', path.basename(spec.dir)),
      })),
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const summary = generateCatalog(root, [adapter]);
      expect(summary.meta.sources?.rp?.chipCount).toBe(5);
      expect(summary.meta.sources?.rp?.license).toContain('CC-BY-SA-4.0');
      expect(summary.meta.sources?.rp?.license).toContain('BSD-3-Clause');
      expect(summary.meta.sources?.rp?.license).toContain('Apache-2.0');
      expect(summary.meta.sources?.rp?.commit).toBe(summary.meta.sources?.rp?.repositories?.[0].commit);
      const meta = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'meta.json'), 'utf8'));
      expect(meta.sources.rp.repositories).toHaveLength(6);
      const index = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'index.json'), 'utf8'));
      expect(index).toHaveLength(5);
      expect(index.every((e: { vendor: string }) => e.vendor === 'rp')).toBe(true);
      for (const id of RP_PART_SPECS.map((s) => s.id)) {
        const shard = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'chips', `${id}.json`), 'utf8'));
        expect(shard.vendor).toBe('rp');
        expect(shard.muxModel).toBe('funcsel-pio');
        expect(rpIndexEntry(shard as ChipData).id).toBe(id);
      }
    } finally {
      logSpy.mockRestore();
    }
  });

  it('keeps three adapters registered without changing STM32/CH32 contracts', () => {
    expect(DEFAULT_ADAPTERS.map((a) => a.vendor)).toEqual(['stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic']);
    expect(DEFAULT_ADAPTERS[2]).toBe(rpAdapter);
    expect(rpAdapter.sourceSpecs.map((s) => s.id)).toEqual(rpSourceSpecs().map((s) => s.id));
    expect(rpAdapter.primarySourceId).toBe('kicad-symbols');
    expect(rpAdapter.gates.map((g) => g.name)).toEqual(['rp-reference-parts', 'rp-part-count']);
    expect(rpAdapter.strict).toBe(true);
  });
});
