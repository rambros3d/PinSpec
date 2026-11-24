import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPackageInfo,
  canonicalizePartId,
  classifyPeripheralKind,
  compareGridRows,
  expandRefNameVariants,
  extractEmbassyStem,
  extractGpioNames,
  normalizeSysSignals,
  parseXmlSignalName,
} from '../tools/data-gen/helpers';
import {
  acquireSource,
  LICENSE_EMBASSY_STM32,
  LICENSE_KICAD,
  LICENSE_OPEN_PIN_DATA,
  LICENSE_PICOTOOL,
  LICENSE_RPI_DOCS,
  LICENSE_ZEPHYR,
  resolveRawRevision,
  resolveRevision,
  rpSourceSpecs,
  stm32SourceSpecs,
} from '../tools/data-gen/sources';
import {
  parseKiCadFootprint,
  parseKiCadSymbolFile,
  resolveKiCadSymbol,
} from '../tools/data-gen/adapters/rp/kicad';
import {
  parsePicotoolFuncsel,
  parsePicoSdkFuncsel,
  selectFuncTables,
} from '../tools/data-gen/adapters/rp/funcsel';

describe('data-gen helpers', () => {
  it('expands parenthesized RefName variants cleanly', () => {
    expect(expandRefNameVariants('STM32G431C(6-8-B)Ux')).toEqual([
      'STM32G431C6Ux',
      'STM32G431C8Ux',
      'STM32G431CBUx',
    ]);
    expect(expandRefNameVariants('STM32F411C(C-E)Ux')).toEqual([
      'STM32F411CCUx',
      'STM32F411CEUx',
    ]);
    expect(expandRefNameVariants('STM32H743VITx')).toEqual(['STM32H743VITx']);
  });

  it('canonicalizes part IDs preserving SMPS and variant suffixes', () => {
    expect(canonicalizePartId('STM32G431CBUx')).toBe('STM32G431CBU6');
    expect(canonicalizePartId('STM32U575RITxQ')).toBe('STM32U575RIT6Q');
    expect(canonicalizePartId('STM32C071C8TxN')).toBe('STM32C071C8T6N');
  });

  it('extracts Embassy chip stem accurately', () => {
    expect(extractEmbassyStem('STM32G431CBUx')).toBe('STM32G431CB');
    expect(extractEmbassyStem('STM32U575RITxQ')).toBe('STM32U575RI');
    expect(extractEmbassyStem('STM32F103C8T6')).toBe('STM32F103C8');
  });

  it('extracts GPIO names from dual-bonded and suffixed labels', () => {
    expect(extractGpioNames('PA0')).toEqual(['PA0']);
    expect(extractGpioNames('PA11 [PA9]')).toEqual(['PA11', 'PA9']);
    expect(extractGpioNames('PC14-OSC32_IN (PC14)')).toEqual(['PC14']);
    expect(extractGpioNames('VDD')).toEqual([]);
  });

  it('builds perimeter package side counts for 4-sided and 2-sided packages', () => {
    const pos48 = Array.from({ length: 48 }, (_, i) => String(i + 1));
    const ufqfpn48 = buildPackageInfo('UFQFPN48', pos48);
    expect(ufqfpn48.kind).toBe('perimeter');
    expect(ufqfpn48.sides).toEqual([12, 12, 12, 12]);

    const pos20 = Array.from({ length: 20 }, (_, i) => String(i + 1));
    const tssop20 = buildPackageInfo('TSSOP20', pos20);
    expect(tssop20.kind).toBe('perimeter');
    expect(tssop20.sides).toEqual([10, 0, 10, 0]);
  });

  it('builds JEDEC-ordered BGA grid rows and columns', () => {
    const bgaPositions = ['A1', 'A2', 'B1', 'H1', 'J1', 'AA1', 'T12', 'A12'];
    const bga = buildPackageInfo('UFBGA169', bgaPositions);
    expect(bga.kind).toBe('grid');
    expect(bga.rows).toEqual(['A', 'B', 'H', 'J', 'T', 'AA']);
    expect(bga.cols).toEqual([1, 2, 12]);
    expect(compareGridRows('T', 'AA')).toBeLessThan(0);
  });

  it('classifies peripherals and normalizes SYS/OTG signals', () => {
    expect(classifyPeripheralKind('SPI1', 'spi')).toBe('spi');
    expect(classifyPeripheralKind('FDCAN1')).toBe('can');
    expect(classifyPeripheralKind('LPUART1')).toBe('usart');
    expect(classifyPeripheralKind('USB_OTG_FS')).toBe('usb');
    expect(parseXmlSignalName('USB_OTG_FS_DM')).toEqual({
      peripheral: 'USB_OTG_FS',
      signal: 'DM',
    });
    expect(normalizeSysSignals('JTMS-SWDIO')).toEqual(['SWDIO', 'JTMS']);
  });
});

describe('data-gen source acquisition', () => {
  it('declares ST and Embassy sources with their licenses', () => {
    const specs = stm32SourceSpecs('/tmp/pincraft-cache');
    expect(specs.map((s) => s.id)).toEqual(['stm32-open-pin-data', 'embassy-stm32-data']);
    expect(specs[0].license).toBe(LICENSE_OPEN_PIN_DATA);
    expect(specs[1].license).toBe(LICENSE_EMBASSY_STM32);
    expect(specs[0].dir).toBe('/tmp/pincraft-cache/STM32_open_pin_data');
  });

  it('resolves a short SHA from a real git checkout', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-src-'));
    try {
      execSync('git init -q', { cwd: dir });
      fs.writeFileSync(path.join(dir, 'README.md'), 'fixture\n');
      execSync('git add README.md', { cwd: dir });
      execSync(
        'git -c user.name=Fixture -c user.email=fixture@example.invalid commit -q -m fixture',
        { cwd: dir },
      );
      const sha = resolveRevision(dir);
      expect(sha).toMatch(/^[0-9a-f]{7,}$/);
      expect(sha).not.toBe('unknown');
      const acquired = acquireSource({
        id: 'fixture',
        url: 'unused://local',
        dir,
        license: 'Test License',
      });
      expect(acquired.commit).toBe(sha);
      expect(acquired.license).toBe('Test License');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to the literal unknown when no revision exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-nogit-'));
    try {
      expect(resolveRevision(dir)).toBe('unknown');
      const acquired = acquireSource({
        id: 'fixture',
        url: 'unused://local',
        dir,
        license: 'Test License',
      });
      expect(acquired.commit).toBe('unknown');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('RP source declarations and synthetic parser fixtures', () => {
  const SYMBOL_FIXTURE = `
(kicad_symbol_lib
  (version 20251024)
  (symbol "RP2040"
    (property "Footprint" "Package_DFN_QFN:QFN-56-1EP_7x7mm_P0.4mm_EP3.2x3.2mm")
    (symbol "RP2040_1_1"
      (pin power_in line (at 0 1 270) (length 1) (name "IOVDD") (number "1"))
      (pin bidirectional line (at 1 0 180) (length 1) (name "GPIO0") (number "2"))
      (pin bidirectional line (at 1 0 180) (length 1) (name "GPIO26/ADC0") (number "3"))
      (pin power_in line (at 0 -1 90) (length 1) (name "GND") (number "4"))
    )
  )
  (symbol "RP2354A"
    (extends "RP2040")
    (property "Footprint" "Package_DFN_QFN:QFN-60-1EP_7x7mm_P0.4mm_EP3.4x3.4mm")
  )
)`;

  const FOOTPRINT_FIXTURE = `
(footprint "QFN-56"
  (pad "1" smd rect (at -1 0) (size 0.2 0.8))
  (pad "2" smd rect (at 1 0) (size 0.2 0.8))
  (pad "3" smd rect (at 0 -1) (size 0.8 0.2))
  (pad "4" smd rect (at 0 1) (size 0.8 0.2))
  (pad "5" smd rect (at 0 0) (size 2 2) (property pad_prop_heatsink))
)`;

  const PICOTOOL_FIXTURE = `
std::array<std::array<string, 2>, 3> pin_functions_rp2040{{
    {"", ""},
    {"SPI0 SCK", "SPI0 RX"},
    {"PWM7 B", "UART0 TX"},
}};
`;

  const PICO_SDK_FIXTURE = `
 * | GPIO | F0   | F1       | F2     |
 * |------|------|----------|--------|
 * | 0    | HSTX | SPI0 SCK | PWM7 B |
 * | 1    |      | UART0 TX | PWM0 A |
`;

  it('declares KiCad, FUNCSEL, Zephyr and documentation sources with SHAs', () => {
    const specs = rpSourceSpecs('/tmp/pincraft-rp-cache');
    expect(specs.map((s) => s.id)).toEqual([
      'kicad-symbols',
      'kicad-footprints',
      'picotool',
      'pico-sdk',
      'zephyr',
      'raspberrypi-documentation',
    ]);
    expect(specs.every((s) => (s.rawFiles?.length ?? 0) > 0)).toBe(true);
    expect(specs[0].license).toBe(LICENSE_KICAD);
    expect(specs[2].license).toBe(LICENSE_PICOTOOL);
    expect(specs[4].license).toBe(LICENSE_ZEPHYR);
    expect(specs[5].license).toBe(LICENSE_RPI_DOCS);
    expect(specs[0].dir).toBe('/tmp/pincraft-rp-cache/kicad-symbols');
  });

  it('resolves raw-file sources from content without modifying cached files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-raw-'));
    try {
      const spec = {
        id: 'fixture-raw',
        url: 'unused://local',
        dir,
        license: 'Test License',
        rawFiles: [{ url: 'unused://local/file', path: 'nested/file.txt' }],
      };
      fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'nested', 'file.txt'), 'fixture content\n');
      const acquired = acquireSource(spec);
      expect(acquired.commit).toMatch(/^[0-9a-f]{12}$/);
      expect(resolveRawRevision(spec)).toBe(acquired.commit);
      expect(fs.readFileSync(path.join(dir, 'nested', 'file.txt'), 'utf8')).toBe('fixture content\n');
      fs.writeFileSync(path.join(dir, 'nested', 'other.txt'), 'unrelated\n');
      expect(resolveRawRevision(spec)).toBe(acquired.commit);
      fs.rmSync(path.join(dir, 'nested', 'file.txt'));
      expect(resolveRawRevision(spec)).toBe('unknown');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses KiCad pad numbers, multi-name pads, electrical types and extends', () => {
    const symbols = parseKiCadSymbolFile(SYMBOL_FIXTURE);
    const rp2040 = symbols.get('RP2040')!;
    expect(symbols.size).toBe(2);
    expect(rp2040.pins.map((p) => p.number)).toEqual(['1', '2', '3', '4']);
    expect(rp2040.pins.find((p) => p.number === '3')?.name).toBe('GPIO26/ADC0');
    expect(rp2040.pins.find((p) => p.number === '1')?.electricalType).toBe('power_in');
    expect(rp2040.pins[4 - 1]?.name).toBe('GND');
    const inherited = resolveKiCadSymbol(symbols, 'RP2354A')!;
    expect(inherited.pins).toHaveLength(4);
    expect(inherited.footprint).toContain('QFN-60');
  });

  it('parses footprint pad geometry including the exposed pad', () => {
    const geometry = parseKiCadFootprint(FOOTPRINT_FIXTURE)!;
    expect(geometry.sides).toEqual([1, 1, 1, 1]);
    expect(geometry.hasExposedPad).toBe(true);
  });

  it('parses both picotool arrays and pico-sdk Doxygen FUNCSEL tables', () => {
    const fromPicotool = parsePicotoolFuncsel(PICOTOOL_FIXTURE).get('rp2040')!;
    expect(fromPicotool.gpioCount).toBe(2);
    expect(fromPicotool.functionCount).toBe(3);
    expect(fromPicotool.byGpio.get(0)?.get(1)).toBe('SPI0 SCK');
    expect(fromPicotool.byGpio.get(0)?.get(2)).toBe('PWM7 B');

    const fromSdk = parsePicoSdkFuncsel(PICO_SDK_FIXTURE).get('rp2350')!;
    expect(fromSdk.byGpio.get(0)?.get(0)).toBe('HSTX');
    expect(fromSdk.byGpio.get(0)?.get(2)).toBe('PWM7 B');
    expect(fromSdk.byGpio.get(1)?.get(1)).toBe('UART0 TX');

    const selected = selectFuncTables(PICOTOOL_FIXTURE, PICO_SDK_FIXTURE);
    expect(selected.get('rp2040')?.byGpio.get(0)?.get(1)).toBe('SPI0 SCK');
    expect(selected.get('rp2350')?.byGpio.get(0)?.get(0)).toBe('HSTX');
  });
});
