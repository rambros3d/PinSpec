import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_SOURCE_IDS,
  formatMuxLabel,
  getChipMuxModel,
  isFlexibleRoutingMux,
  type ChipData,
  type PinInfo,
} from '../src/core/types';
import { createNordicGates, nordicAdapter } from '../tools/data-gen/adapters/nordic';
import { gpioIdentity, parseKicadSymbol } from '../tools/data-gen/adapters/nordic/kicad';
import { buildPselFunctions, splitPselFunction } from '../tools/data-gen/adapters/nordic/pinctrl';
import {
  generateNordicParts,
  gpioPorts,
  NORDIC_PILOTS,
  peripheralKindForName,
  pinFromSymbol,
  pselSignals,
} from '../tools/data-gen/adapters/nordic/parts';
import { coreLabel, parseSvd } from '../tools/data-gen/adapters/nordic/svd';
import { indexGeometryFromPackage } from '../tools/data-gen/helpers';
import { parseDeviceTree } from '../tools/data-gen/adapters/nordic/zephyr';
import { canonicalSourceId } from '../tools/data-gen/artifacts';
import { DEFAULT_ADAPTERS, generateCatalog } from '../tools/data-gen/index';
import {
  KICAD_NORDIC_FILES,
  LICENSE_KICAD,
  LICENSE_NRF_PACS,
  LICENSE_ZEPHYR,
  NRF_PACS_SVD_FILES,
  nordicSourceSpecs,
} from '../tools/data-gen/sources';
import type { AdapterContext, GateContext } from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.cache');

const SVD_FIXTURE = `<?xml version="1.0"?>
<device><name>nrfTEST</name><series>nrf52</series><cpu><name>CM4</name></cpu>
<peripherals>
  <peripheral><name>UART0</name><interrupt><name>UART0</name></interrupt><addressBlock><size>0x1000</size></addressBlock></peripheral>
  <peripheral><name>SPIM0</name><interrupt><name>SPIM0</name></interrupt><addressBlock><size>0x1000</size></addressBlock></peripheral>
</peripherals></device>`;

const DTS_FIXTURE = `/ {
 soc {
  gpio0: gpio@50000000 { port = <0>; ngpios = <4>; };
  flash0: flash@0 { reg = <0x0 DT_SIZE_K(1024)>; };
  sram0: memory@20000000 { reg = <0x20000000 DT_SIZE_K(256)>; };
  uart0: uart@40001000 { compatible = "nordic,nrf-uarte"; interrupts = <3 1>; };
 };
};`;

const PINCTRL_HEADER_FIXTURE = `#define NRF_FUN_UART_TX 0U
#define NRF_FUN_UART_RX 1U
#define NRF_FUN_SPIM_SCK 4U
`;

const PINCTRL_BINDING_FIXTURE = `description: |
  psels = <NRF_PSEL(UART_TX, 0, 1)>;
compatible: "nordic,nrf-pinctrl"`;

const KICAD_FIXTURE = `(kicad_symbol_lib
 (symbol "nRFTEST"
  (property "Footprint" "Package_DFN_QFN:Nordic_AQFN-73-1EP_7x7mm_P0.5mm")
  (symbol "nRFTEST_0_1"
   (pin bidirectional line (name "AIN7/P0.02") (number "A8"))
   (pin bidirectional line (name "P0.03") (number "A9"))
   (pin input line (name "SWDIO") (number "C1"))
   (pin input line (name "NFC1/P0.09") (number "C2"))
   (pin input line (name "P0.18/~{RESET}") (number "D1"))
   (pin power_in line (name "VDD") (number "EP"))
  )
 )
)`;

function adapterContext(): AdapterContext {
  return {
    paths: { root: ROOT, cacheDir: CACHE, outDir: '', chipsOutDir: '' },
    sources: nordicSourceSpecs(CACHE).map((spec) => ({ ...spec, commit: 'abc1234' })),
    warnings: createWarningCollector(),
  };
}

function gateContext(chips: ChipData[]): GateContext {
  return {
    paths: { root: ROOT, cacheDir: CACHE, outDir: '', chipsOutDir: '' },
    chips: new Map(chips.map((chip) => [chip.id, chip])),
    index: chips.map((chip) => ({
      id: chip.id,
      vendor: chip.vendor ?? 'nordic',
      family: chip.family,
      core: chip.core,
      package: chip.package.name,
      pinCount: chip.package.pinCount,
      flashKb: chip.flashKb,
      ramKb: chip.ramKb,
      geometry: indexGeometryFromPackage(chip.package),
    })),
    totalVariants: chips.length,
    matchedVariants: chips.length,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    sources: nordicSourceSpecs(CACHE).map((spec) => ({ ...spec, commit: 'abc1234' })),
    serializedShards: new Map(chips.map((chip) => [chip.id, JSON.stringify(chip)])),
  };
}

describe('Nordic schema and source declarations', () => {
  it('adds psel as a flexible mux model with a named funcLabel', () => {
    const chip = { vendor: 'nordic' as const, muxModel: 'psel' as const };
    expect(getChipMuxModel(chip)).toBe('psel');
    expect(isFlexibleRoutingMux('psel')).toBe(true);
    expect(formatMuxLabel(
      { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'UART_TX' },
      'psel',
    )).toBe('UART_TX');
    expect(formatMuxLabel({ peripheral: 'UART0', signal: 'TX', af: null }, 'psel')).toBe('TX');
  });

  it('declares three sources with raw SVD files and the shared Zephyr source', () => {
    const specs = nordicSourceSpecs(CACHE);
    expect(specs.map((spec) => spec.id)).toEqual(['nrf-pacs', 'zephyr', 'kicad-mcu-nordic']);
    expect(specs.map((spec) => spec.license)).toEqual([LICENSE_NRF_PACS, LICENSE_ZEPHYR, LICENSE_KICAD]);
    expect(specs[0].branch).toBeUndefined();
    expect(specs[0].url).toContain('nrf-pacs');
    expect(specs[0].rawFiles?.map((file) => file.path)).toEqual(
      NRF_PACS_SVD_FILES.map((file) => `svds/${file}`),
    );
    expect(specs[1].rawFiles?.length).toBeGreaterThanOrEqual(5);
    expect(specs[2].rawFiles?.map((file) => file.path)).toEqual(
      KICAD_NORDIC_FILES.map((file) => `MCU_Nordic.kicad_symdir/${file}`),
    );
  });

  it('adds one canonical id while preserving the existing kicad and zephyr primaries', () => {
    expect(CATALOG_SOURCE_IDS).toHaveLength(13);
    expect(CATALOG_SOURCE_IDS).toContain('nrf-pacs');
    expect(canonicalSourceId('nrf-pacs')).toBe('nrf-pacs');
    expect(canonicalSourceId('zephyr-nordic')).toBe('zephyr');
    expect(canonicalSourceId('kicad-mcu-nordic')).toBe('kicad');
    expect(canonicalSourceId('kicad-symbols')).toBe('kicad');
    expect(canonicalSourceId('zephyr')).toBe('zephyr');
  });

  it('registers the strict adapter in the six-vendor default list', () => {
    expect(DEFAULT_ADAPTERS.map((adapter) => adapter.vendor)).toEqual([
      'stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic',
    ]);
    expect(DEFAULT_ADAPTERS[5]).toBe(nordicAdapter);
    expect(nordicAdapter.strict).toBe(true);
    expect(createNordicGates().map((gate) => gate.name)).toEqual([
      'nordic-reference-parts', 'nordic-shard-values', 'nordic-provenance',
    ]);
  });

  it('declares pilot selectors rather than hardcoded pin facts', () => {
    expect(NORDIC_PILOTS.map((pilot) => pilot.id)).toEqual([
      'nRF52840-QIAA', 'nRF5340-QKxx', 'nRF54L15',
    ]);
    expect(NORDIC_PILOTS[2].svds).toHaveLength(0);
  });
});

describe('Nordic source readers', () => {
  it('reads SVD peripherals, interrupts, and CPU without pin inference', () => {
    const svd = parseSvd(SVD_FIXTURE, 'nrfTEST.svd');
    expect(svd.name).toBe('nrfTEST');
    expect(svd.series).toBe('nrf52');
    expect(svd.cpuNames).toEqual(['CM4']);
    expect(svd.peripherals).toEqual(['UART0', 'SPIM0']);
    expect(svd.interrupts).toEqual(['SPIM0', 'UART0']);
    expect(svd.addressBlockBytes.UART0).toBe(4096);
    expect(coreLabel(svd.cpuNames)).toBe('Cortex-M4');
    expect(coreLabel(['CM33'])).toBe('Cortex-M33');
  });

  it('reads device-tree GPIO counts, flash, and SRAM sizes', () => {
    const dts = parseDeviceTree(DTS_FIXTURE, 'nrfTEST.dtsi');
    expect(dts.gpioPorts).toEqual([{ port: 0, ngpios: 4 }]);
    expect(dts.flashKb).toBe(1024);
    expect(dts.ramKb).toBe(256);
    expect(dts.peripherals).toContain('nrf-uarte');
    expect(dts.interrupts).toContain('3');
  });

  it('maps PSEL function constants to named funcLabels with no AF', () => {
    expect(splitPselFunction('UART_TX')).toEqual({ peripheral: 'UART0', signal: 'TX' });
    const functions = buildPselFunctions(PINCTRL_HEADER_FIXTURE, PINCTRL_BINDING_FIXTURE);
    expect(functions.map((func) => func.funcLabel)).toEqual(['SPIM_SCK', 'UART_RX', 'UART_TX']);
    expect(functions.find((func) => func.funcLabel === 'UART_TX')?.examples).toEqual(['UART_TX']);
  });

  it('reads KiCad pin numbers, multi-function names, and exposed pads', () => {
    const symbol = parseKicadSymbol(KICAD_FIXTURE, 'nRFTEST.kicad_sym');
    expect(symbol.name).toBe('nRFTEST');
    expect(symbol.pins).toHaveLength(6);
    expect(symbol.hasExposedPad).toBe(true);
    expect(gpioIdentity('AIN7/P0.02')).toEqual({ port: 0, pin: 2 });
    expect(gpioIdentity('VDD')).toBeNull();
    expect(pinFromSymbol(symbol.pins[2]).tags).toContain('debug-swd');
    expect(pinFromSymbol(symbol.pins[3]).tags).toContain('nfc');
    expect(pinFromSymbol(symbol.pins[4]).type).toBe('reset');
    expect(pinFromSymbol(symbol.pins[5]).type).toBe('power');
    expect(pinFromSymbol(symbol.pins[0]).tags).toBeUndefined();
  });

  it('joins PSEL functions to declared GPIOs and defers unmapped facts', () => {
    const symbol = parseKicadSymbol(KICAD_FIXTURE, 'nRFTEST.kicad_sym');
    const pins: PinInfo[] = symbol.pins.map((pin) => ({ ...pinFromSymbol(pin), signals: [] }));
    const deferred: string[] = [];
    const ports = gpioPorts(
      [{ gpioPorts: [{ port: 0, ngpios: 4 }] }],
      pins,
      (reason) => deferred.push(reason),
    );
    expect(ports).toEqual([{ port: 0, count: 4, derived: false }]);
    const functions = buildPselFunctions(PINCTRL_HEADER_FIXTURE, PINCTRL_BINDING_FIXTURE);
    const joined = pselSignals(functions, new Set(['UART0', 'SPIM0']), pins, ports);
    expect(joined.signals).toBe(6);
    expect(joined.peripherals.UART0.signals).toEqual(['RX', 'TX']);
    expect(joined.unmatched).toEqual([]);
    expect(
      pins.find((pin) => pin.name === 'AIN7/P0.02')?.signals.find((sig) => sig.funcLabel === 'UART_RX'),
    ).toMatchObject({ af: null, funcLabel: 'UART_RX', peripheral: 'UART0', signal: 'RX' });
    expect(peripheralKindForName('SPIM0')).toBe('spi');
    expect(peripheralKindForName('UARTE0')).toBe('usart');
    expect(pinFromSymbol(symbol.pins[0]).tags).toBeUndefined();
  });
});

describe('generated Nordic catalog and gates', () => {
  it('emits complete pilots and defers nRF54L15 with vendor attribution', () => {
    const context = adapterContext();
    const result = generateNordicParts(context);
    expect(result.index.map((entry) => entry.id)).toEqual(['nRF52840-QIAA', 'nRF5340-QKxx']);
    const chip = result.chips.get('nRF52840-QIAA')!;
    expect(chip.vendor).toBe('nordic');
    expect(chip.muxModel).toBe('psel');
    expect(chip.pins.length).toBeGreaterThan(40);
    expect(chip.flashKb).toBe(1024);
    expect(chip.ramKb).toBe(256);
    expect(chip.pins.some((pin) => pin.signals.some((sig) => sig.funcLabel && sig.af === null))).toBe(true);
    expect(context.warnings.all().some((w) => w.id === 'nRF54L15' && w.vendor === 'nordic')).toBe(true);
    expect(context.warnings.all().some((w) => w.id === 'nRF52840-QIAA' && w.reason.includes('strapping'))).toBe(true);
  });

  it('passes strict gates for the generated reference part', () => {
    const result = generateNordicParts(adapterContext());
    const chips = Array.from(result.chips.values());
    expect(createNordicGates().map((gate) => gate.evaluate(gateContext(chips)).errors)).toEqual([[], [], []]);
  });

  it('fails the reference gate on missing PSEL evidence and provenance', () => {
    const result = generateNordicParts(adapterContext());
    const chip = result.chips.get('nRF52840-QIAA')!;
    const stripped = { ...chip, pins: chip.pins.map((pin) => ({ ...pin, signals: [] })) };
    const errors = createNordicGates()[0].evaluate(gateContext([stripped])).errors;
    expect(errors.some((e) => e.includes('PSEL'))).toBe(true);
    const provenance = createNordicGates()[2].evaluate({ ...gateContext([chip]), sources: [] });
    expect(provenance.errors.some((e) => e.includes('nrf-pacs'))).toBe(true);
  });

  it('writes no partial catalog when a forced Nordic gate error occurs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-nordic-gate-'));
    const failing = {
      ...nordicAdapter,
      sourceSpecs: [],
      generate: () => ({
        vendor: 'nordic' as const,
        chips: new Map(),
        index: [],
        families: [],
        totalVariants: 3,
        matchedVariants: 0,
      }),
      gates: [{
        name: 'injected-nordic-failure',
        evaluate: () => ({
          vendor: 'nordic' as const,
          name: 'injected-nordic-failure',
          errors: ['nordic gate: injected assertion failure'],
          notes: [],
        }),
      }],
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [failing])).toThrow('injected assertion failure');
      expect(fs.existsSync(path.join(root, 'public', 'data', 'meta.json'))).toBe(false);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
