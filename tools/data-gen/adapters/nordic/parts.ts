/**
 * Pilot selectors and shard emission. Selectors name upstream files, not chip
 * facts; every emitted value is read from the three acquired sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogIndexEntry,
  ChipData,
  PackageInfo,
  PeripheralInfo,
  PeripheralKind,
  PinInfo,
} from '../../../../src/core/types';
import type { AdapterContext } from '../../types';
import { gpioIdentity, readKicadSymbol } from './kicad';
import { readPselFunctions } from './pinctrl';
import { coreLabel, readSvd } from './svd';
import type { PselFunction, SvdDevice } from './types';
import { readDeviceTree } from './zephyr';

/** Nordic pilot selectors: upstream file names used to locate evidence. */
export const NORDIC_PILOTS = [
  {
    id: 'nRF52840-QIAA',
    svds: ['nrf52840.svd'],
    dtss: ['dts/arm/nordic/nrf52840.dtsi'],
    symbol: 'nRF52840.kicad_sym',
  },
  {
    id: 'nRF5340-QKxx',
    svds: ['nrf5340-app.svd', 'nrf5340-net.svd'],
    dtss: [
      'dts/arm/nordic/nrf5340_cpuapp.dtsi',
      'dts/arm/nordic/nrf5340_cpuapp_peripherals.dtsi',
      'dts/arm/nordic/nrf5340_cpuapp_qkaa.dtsi',
      'dts/arm/nordic/nrf5340_cpunet.dtsi',
    ],
    symbol: 'nRF5340-QKxx.kicad_sym',
  },
  { id: 'nRF54L15', svds: [], dtss: [], symbol: '' },
] as const;

/** Generic kind normalization from upstream SVD peripheral names. */
export function peripheralKindForName(name: string): PeripheralKind {
  const upper = name.toUpperCase();
  if (/^(UART|UARTE)/.test(upper)) return 'usart';
  if (/^(SPI|SPIM|SPIS)/.test(upper)) return 'spi';
  if (/^(TWIM|TWIS|TWI)/.test(upper)) return 'i2c';
  if (/^PWM/.test(upper)) return 'pwm';
  if (/^ADC/.test(upper)) return 'adc';
  if (/^(USB|USBD)/.test(upper)) return 'usb';
  if (/^TIMER/.test(upper)) return 'tim';
  return 'other';
}

/** Pin type and tags derived only from the acquired symbol name. */
export function pinFromSymbol(pin: {
  number: string;
  name: string;
  electrical: string;
}): Omit<PinInfo, 'signals'> {
  const upper = pin.name.toUpperCase();
  const type = /RESET/.test(upper)
    ? 'reset'
    : /^(VDD|VSS|GND|DEC|DCC|DCCH)/.test(upper) || pin.electrical === 'power_in'
      ? 'power'
      : 'io';
  const tags: PinInfo['tags'] = [];
  if (/SWD(IO|CLK)|SWCLK|SWDIO/.test(upper)) tags.push('debug-swd');
  if (/NFC/.test(upper)) tags.push('nfc');
  if (/^(D\+|D-)$/.test(pin.name)) tags.push('usb');
  if (/QSPI/.test(upper)) tags.push('qspi');
  return { pos: pin.number, name: pin.name, type, ...(tags.length ? { tags } : {}) };
}

/** JEDEC row order for alphanumeric symbol pin numbers (I and O are omitted). */
function rowRank(row: string): number {
  let rank = 0;
  for (const char of row) {
    const code = char.charCodeAt(0) - 64;
    rank = rank * 26 + code - (code > 8 ? 1 : 0) - (code > 14 ? 1 : 0);
  }
  return rank;
}

/** Rows and columns of ball-style symbol pin numbers. */
function symbolGrid(pins: PinInfo[]): { rows: string[]; cols: number[] } {
  const rows = new Set<string>();
  const cols = new Set<number>();
  for (const pin of pins) {
    const match = pin.pos.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    rows.add(match[1]);
    cols.add(Number.parseInt(match[2], 10));
  }
  return {
    rows: Array.from(rows).sort((a, b) => rowRank(a) - rowRank(b)),
    cols: Array.from(cols).sort((a, b) => a - b),
  };
}

/** Package derived from the footprint family and symbol pin count. */
export function packageFromSymbol(
  footprint: string,
  pins: PinInfo[],
  hasExposedPad: boolean,
): PackageInfo {
  const family = footprint.match(/([A-Z]{2,})-\d+/)?.[1] ?? 'Package';
  const ballPins = pins.filter((pin) => /^[A-Z]+\d+$/.test(pin.pos));
  const grid = symbolGrid(ballPins);
  const gridLike = ballPins.length > pins.length / 2 && grid.rows.length > 0 && grid.cols.length > 0;
  const pinCount = pins.length;
  return {
    name: `${family}${hasExposedPad ? '-1EP' : ''}`,
    kind: gridLike ? 'grid' : 'perimeter',
    pinCount,
    ...(gridLike
      ? { rows: grid.rows, cols: grid.cols }
      : { sides: [Math.ceil(pinCount / 4), 0, Math.floor(pinCount / 4), 0] }),
  };
}

/** GPIO ports and counts from the device tree, filling gaps from symbol names. */
export function gpioPorts(
  trees: Array<{ gpioPorts: Array<{ port: number; ngpios: number | null }> }>,
  pins: PinInfo[],
  warn: (reason: string) => void,
): Array<{ port: number; count: number; derived: boolean }> {
  const declared = new Map<number, number | null>();
  for (const tree of trees) {
    for (const item of tree.gpioPorts) {
      const previous = declared.get(item.port);
      if (item.ngpios !== null || previous === undefined) declared.set(item.port, item.ngpios);
    }
  }
  const symbolMax = new Map<number, number>();
  for (const pin of pins) {
    const identity = gpioIdentity(pin.name);
    if (!identity) continue;
    symbolMax.set(identity.port, Math.max(symbolMax.get(identity.port) ?? 0, identity.pin + 1));
  }
  const ports: Array<{ port: number; count: number; derived: boolean }> = [];
  for (const [port, symbolCount] of symbolMax) {
    const declaredCount = declared.get(port);
    if (declaredCount !== null && declaredCount !== undefined) {
      ports.push({ port, count: declaredCount, derived: false });
    } else {
      warn(`Device tree declares no ngpios for GPIO port ${port}; count derived from symbol names.`);
      ports.push({ port, count: symbolCount, derived: true });
    }
  }
  return ports.sort((a, b) => a.port - b.port);
}

/** PSEL signals joined to every eligible GPIO from the device tree. */
export function pselSignals(
  functions: PselFunction[],
  inventory: Set<string>,
  pins: PinInfo[],
  ports: Array<{ port: number; count: number }>,
): { signals: number; peripherals: Record<string, PeripheralInfo>; unmatched: string[] } {
  const peripherals: Record<string, PeripheralInfo> = {};
  const unmatched: string[] = [];
  let signals = 0;
  for (const func of functions) {
    const bareName = func.peripheral.replace(/0$/, '');
    const peripheral = inventory.has(func.peripheral)
      ? func.peripheral
      : inventory.has(bareName)
        ? bareName
        : undefined;
    if (!peripheral) {
      unmatched.push(func.funcLabel);
      continue;
    }
    const signalNames = peripherals[peripheral]?.signals ?? [];
    if (!signalNames.includes(func.signal)) signalNames.push(func.signal);
    peripherals[peripheral] = {
      kind: peripheralKindForName(peripheral),
      signals: signalNames.sort(),
    };
    for (const pin of pins) {
      const identity = gpioIdentity(pin.name);
      if (!identity) continue;
      if (!ports.some((port) => port.port === identity.port && identity.pin < port.count)) continue;
      pin.signals.push({
        peripheral,
        signal: func.signal,
        af: null,
        funcLabel: func.funcLabel,
      });
      signals++;
    }
  }
  return { signals, peripherals, unmatched };
}

/** Index counts mirror the declarative peripheral kinds used by the solver. */
function indexEntry(chip: ChipData): CatalogIndexEntry {
  const counts = { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 };
  for (const info of Object.values(chip.peripherals)) {
    if (info.kind === 'spi') counts.spi++;
    else if (info.kind === 'i2c') counts.i2c++;
    else if (info.kind === 'usart') counts.usart++;
    else if (info.kind === 'can') counts.can++;
    else if (info.kind === 'usb') counts.usb++;
    else if (info.kind === 'tim' || info.kind === 'pwm') counts.tim++;
    else if (info.kind === 'adc') counts.adc++;
  }
  return {
    id: chip.id,
    vendor: 'nordic',
    family: 'Nordic',
    core: chip.core,
    package: chip.package.name,
    pinCount: chip.package.pinCount,
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    peripherals: counts,
  };
}

/** Emits every pilot with complete SVD, device-tree, and KiCad symbol evidence. */
export function generateNordicParts(ctx: AdapterContext): {
  chips: Map<string, ChipData>;
  index: CatalogIndexEntry[];
} {
  const chips = new Map<string, ChipData>();
  const index: CatalogIndexEntry[] = [];
  const functions = readPselFunctions(ctx.paths.cacheDir);

  for (const pilot of NORDIC_PILOTS) {
    const warn = (reason: string, source = 'nrf-pacs'): void => {
      ctx.warnings.add({ id: pilot.id, vendor: 'nordic', source, reason });
    };
    if (pilot.svds.length === 0 && pilot.symbol === '') {
      warn('nRF54L15 has no machine-readable SVD in nrf-pacs and no KiCad Nordic symbol; part deferred.');
      continue;
    }
    const svdFiles = pilot.svds.filter((file) =>
      fs.existsSync(path.join(ctx.paths.cacheDir, 'nrf-pacs', 'svds', file)),
    );
    if (svdFiles.length !== pilot.svds.length) {
      warn('One or more pilot SVD files are unavailable; part deferred.');
      continue;
    }
    const dtFiles = pilot.dtss.filter((file) =>
      fs.existsSync(path.join(ctx.paths.cacheDir, 'zephyr-nordic', file)),
    );
    if (dtFiles.length !== pilot.dtss.length) {
      warn('One or more pilot device-tree files are unavailable; part deferred.', 'zephyr-nordic');
      continue;
    }
    const symbolFile = path.join(
      ctx.paths.cacheDir,
      'kicad-nordic',
      'MCU_Nordic.kicad_symdir',
      pilot.symbol,
    );
    if (!fs.existsSync(symbolFile)) {
      warn('The pilot KiCad symbol is unavailable; part deferred.', 'kicad-mcu-nordic');
      continue;
    }

    const svds: SvdDevice[] = svdFiles.map((file) => readSvd(ctx.paths.cacheDir, file));
    const trees = dtFiles.map((file) => readDeviceTree(ctx.paths.cacheDir, file));
    const symbol = readKicadSymbol(ctx.paths.cacheDir, pilot.symbol);
    const pins: PinInfo[] = symbol.pins
      .map((pin) => ({ ...pinFromSymbol(pin), signals: [] }))
      .sort((a, b) => a.pos.localeCompare(b.pos, undefined, { numeric: true }));
    if (pins.length === 0) {
      warn('KiCad symbol declares no physical pins; part deferred.', 'kicad-mcu-nordic');
      continue;
    }
    const ports = gpioPorts(trees, pins, (reason) => warn(reason, 'zephyr-nordic'));
    if (ports.length === 0) {
      warn('No device-tree GPIO port maps to a symbol GPIO name; part deferred.', 'zephyr-nordic');
      continue;
    }
    const inventory = new Set(
      svds.flatMap((svd) =>
        svd.peripherals.flatMap((name) => [name, name.replace(/_(S|NS)$/, '')]),
      ),
    );
    for (const tree of trees) for (const peripheral of tree.peripherals) inventory.add(peripheral);
    const joined = pselSignals(functions, inventory, pins, ports);
    if (joined.signals === 0) {
      warn('No PSEL function could be joined to a device-tree GPIO; part deferred.', 'zephyr-nordic');
      continue;
    }
    if (joined.unmatched.length > 0) {
      warn(
        `${joined.unmatched.length} PSEL functions have no SVD or device-tree peripheral (${joined.unmatched.slice(0, 5).join(', ')}...); omitted.`,
        'zephyr-nordic',
      );
    }
    const flashKb = trees.find((tree) => tree.flashKb !== null)?.flashKb ?? null;
    const ramKb = trees.find((tree) => tree.ramKb !== null)?.ramKb ?? null;
    if (ramKb === null) {
      warn('No device-tree SRAM size is declared; part deferred.', 'zephyr-nordic');
      continue;
    }
    warn('No acquired source declares strapping state for this part; strapping tags omitted.', 'kicad-mcu-nordic');
    warn('No acquired source declares input-only pads for this part; input-only tags omitted.', 'kicad-mcu-nordic');
    warn('QSPI fixed-pin assignment is not declared in the symbol or device tree; PSEL functions retained.', 'kicad-mcu-nordic');

    const chip: ChipData = {
      id: pilot.id,
      vendor: 'nordic',
      muxModel: 'psel',
      family: 'Nordic',
      core: coreLabel(svds.flatMap((svd) => svd.cpuNames)),
      flashKb,
      ramKb,
      package: packageFromSymbol(symbol.footprint, pins, symbol.hasExposedPad),
      pins,
      peripherals: joined.peripherals,
      capabilityEvidence: {
        interrupts: Array.from(new Set(svds.flatMap((svd) => svd.interrupts))).sort(),
        params: Array.from(
          new Set([
            ...svds.flatMap((svd) => svd.peripherals),
            ...trees.flatMap((tree) => tree.peripherals),
          ]),
        ).sort(),
      },
    };
    if (chip.flashKb === null) {
      warn('No device-tree flash size is declared; flashKb omitted.', 'zephyr-nordic');
      continue;
    }
    chips.set(chip.id, chip);
    index.push(indexEntry(chip));
  }

  return { chips, index };
}
