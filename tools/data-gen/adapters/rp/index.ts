/**
 * RP vendor adapter: joins KiCad physical pins, pico-sdk/picotool FUNCSEL
 * tables and Zephyr/documentation variant facts into `ChipData` shards.
 *
 * Every pin and mux fact is read from the declared CI sources. The only static
 * data in this module is the list of supported part identities and which
 * upstream file carries each one's symbol, footprint and metadata.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogIndexEntry,
  ChipData,
  ChipPioConfig,
  PackageInfo,
  PeripheralInfo,
  PinInfo,
  PinTag,
  PinType,
} from '../../../../src/core/types';
import { buildPackageInfo, classifyPeripheralKind, indexGeometryFromPackage } from '../../helpers';
import {
  LICENSE_KICAD,
  LICENSE_PICOTOOL,
  LICENSE_RPI_DOCS,
  LICENSE_ZEPHYR,
  RP_SYMBOL_NAMES,
  rpSourceSpecs,
} from '../../sources';
import type {
  AdapterContext,
  AdapterResult,
  Gate,
  GateContext,
  GateResult,
  VendorAdapter,
} from '../../types';
import {
  parseKiCadFootprint,
  parseKiCadSymbolFile,
  resolveKiCadSymbol,
  type FootprintGeometry,
  type KiCadSymbol,
} from './kicad';
import {
  funcselSignalsForGpio,
  pioInstanceCount,
  selectFuncTables,
  type FuncTable,
} from './funcsel';
import {
  gpioBaseOptions,
  parseDocumentationVariants,
  parseRp2040DocFacts,
  parseZephyrFacts,
  RP_STATE_MACHINES_PER_PIO,
  type DocVariant,
} from './variants';

export const RP_SOURCE_IDS = {
  symbols: 'kicad-symbols',
  footprints: 'kicad-footprints',
  picotool: 'picotool',
  picoSdk: 'pico-sdk',
  zephyr: 'zephyr',
  docs: 'raspberrypi-documentation',
} as const;

/** Upstream relative paths shared by all RP parts. */
export const RP_SHARED_PATHS = {
  picotool: 'main.cpp',
  picoSdk: 'src/rp2_common/hardware_gpio/include/hardware/gpio.h',
  zephyr2040: 'dts/arm/raspberrypi/rpi_pico/rp2040.dtsi',
  zephyr2350: 'dts/vendor/raspberrypi/rpi_pico/rp2350.dtsi',
  zephyr2350a: 'dts/vendor/raspberrypi/rpi_pico/rp2350a.dtsi',
  zephyr2350b: 'dts/vendor/raspberrypi/rpi_pico/rp2350b.dtsi',
} as const;

const DOC_DIR = 'documentation/asciidoc/microcontrollers/microcontroller-chips';
const SYMBOL_DIR = 'MCU_RaspberryPi.kicad_symdir';
const FOOTPRINT_DIR = 'Package_DFN_QFN.pretty';

export const RP_QFN56_FOOTPRINT = 'QFN-56-1EP_7x7mm_P0.4mm_EP3.2x3.2mm';
export const RP_QFN60_FOOTPRINT = 'QFN-60-1EP_7x7mm_P0.4mm_EP3.4x3.4mm';
export const RP_QFN80_FOOTPRINT = 'QFN-80-1EP_10x10mm_P0.4mm_EP3.4x3.4mm';

/** One supported RP part and the upstream files that describe it. */
export interface RpPartSpec {
  id: string;
  symbol: string;
  footprint: string;
  funcTable: 'rp2040' | 'rp2350';
  zephyrFiles: string[];
  docId: string;
}

/** Part identities covered by this adapter (not a pin table). */
export const RP_PART_SPECS: readonly RpPartSpec[] = [
  {
    id: 'RP2040',
    symbol: 'RP2040',
    footprint: RP_QFN56_FOOTPRINT,
    funcTable: 'rp2040',
    zephyrFiles: [RP_SHARED_PATHS.zephyr2040],
    docId: 'RP2040',
  },
  {
    id: 'RP2350A',
    symbol: 'RP2350A',
    footprint: RP_QFN60_FOOTPRINT,
    funcTable: 'rp2350',
    zephyrFiles: [RP_SHARED_PATHS.zephyr2350, RP_SHARED_PATHS.zephyr2350a],
    docId: 'RP2350A',
  },
  {
    id: 'RP2350B',
    symbol: 'RP2350B',
    footprint: RP_QFN80_FOOTPRINT,
    funcTable: 'rp2350',
    zephyrFiles: [RP_SHARED_PATHS.zephyr2350, RP_SHARED_PATHS.zephyr2350b],
    docId: 'RP2350B',
  },
  {
    id: 'RP2354A',
    symbol: 'RP2354A',
    footprint: RP_QFN60_FOOTPRINT,
    funcTable: 'rp2350',
    zephyrFiles: [RP_SHARED_PATHS.zephyr2350, RP_SHARED_PATHS.zephyr2350a],
    docId: 'RP2354A',
  },
  {
    id: 'RP2354B',
    symbol: 'RP2354B',
    footprint: RP_QFN80_FOOTPRINT,
    funcTable: 'rp2350',
    zephyrFiles: [RP_SHARED_PATHS.zephyr2350, RP_SHARED_PATHS.zephyr2350b],
    docId: 'RP2354B',
  },
];

function readSource(
  ctx: AdapterContext,
  sourceId: string,
  relPath: string,
  refName: string,
): string | undefined {
  const source = ctx.sources.find((s) => s.id === sourceId);
  if (!source) {
    ctx.warnings.add({
      vendor: 'rp',
      file: relPath,
      refName,
      reason: `RP source ${sourceId} is not configured.`,
    });
    return undefined;
  }
  const file = path.join(source.dir, relPath);
  try {
    if (!fs.existsSync(file)) {
      ctx.warnings.add({
        vendor: 'rp',
        file: relPath,
        refName,
        reason: `RP source file ${relPath} is unavailable (${sourceId}).`,
      });
      return undefined;
    }
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    ctx.warnings.add({
      vendor: 'rp',
      file: relPath,
      refName,
      reason: `RP source file ${relPath} could not be read: ${err instanceof Error ? err.message : String(err)}`,
    });
    return undefined;
  }
}

function packageNameFromFootprint(footprint: string): string {
  return footprint.replace(/-1EP.*$/, '');
}

/** Derives semantic tags from the KiCad pad name and joined FUNCSEL signals. */
export function deriveRpTags(
  padName: string,
  signals: ReadonlyArray<{ peripheral: string }>,
): PinTag[] {
  const tags = new Set<PinTag>();
  const name = padName.toUpperCase();
  if (/\/(?:ADC)\d+/.test(name)) tags.add('adc');
  if (/QSPI/.test(name)) tags.add('qspi');
  if (/^(SWCLK|SWDIO)$/.test(name)) tags.add('debug-swd');
  if (/USB/.test(name) || signals.some((s) => s.peripheral === 'USB')) tags.add('usb');
  if (signals.some((s) => s.peripheral === 'HSTX')) tags.add('hstx');
  if (/5\s*V/.test(name)) tags.add('5v-tolerant');
  if (/^RUN$/.test(name)) tags.add('boot');
  return Array.from(tags).sort();
}

/** Maps a FUNCSEL peripheral name onto the core's `PeripheralKind`. */
export function rpPeripheralKind(peripheral: string): PeripheralInfo['kind'] {
  if (/^PIO\d+$/.test(peripheral)) return 'pio';
  if (/^PWM$/.test(peripheral)) return 'pwm';
  if (/^JTAG$/.test(peripheral)) return 'sys';
  return classifyPeripheralKind(peripheral);
}

function rpPinType(name: string): PinType {
  const upper = name.toUpperCase();
  if (/^GPIO\d+/.test(upper)) return 'io';
  if (/(GND|VDD|VREG|AVDD|PGND|OTP_VDD)/.test(upper)) return 'power';
  if (/^RUN$/.test(upper)) return 'reset';
  if (/^NC$/.test(upper)) return 'nc';
  return 'io';
}

export interface RpBuildFacts {
  ramKb: number;
  flashKb: number;
  gpioCount: number;
  doc: DocVariant;
  docsText: string;
}

/** Builds one chip from already-resolved, manifest-free upstream records. */
export function buildRpChip(
  spec: RpPartSpec,
  symbol: KiCadSymbol,
  geometry: FootprintGeometry | undefined,
  table: FuncTable,
  facts: RpBuildFacts,
): ChipData {
  const packageName = packageNameFromFootprint(spec.footprint);
  const pinsSorted = symbol.pins
    .slice()
    .sort((a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10))
    .filter((pin) => /^\d+$/.test(pin.number));
  const maxNumber = pinsSorted.reduce((max, pin) => Math.max(max, Number.parseInt(pin.number, 10)), 0);
  const exposedPad = pinsSorted.find(
    (pin) => Number.parseInt(pin.number, 10) === maxNumber && /^(GND|VSS)$/i.test(pin.name),
  );
  const leads = pinsSorted.filter((pin) => pin !== exposedPad);
  const positions = leads.map((pin) => pin.number);

  const packageInfo: PackageInfo = buildPackageInfo(packageName, positions);
  if (geometry) packageInfo.sides = geometry.sides;
  if (exposedPad || geometry?.hasExposedPad) packageInfo.hasExposedPad = true;

  const pins: PinInfo[] = [];
  const peripherals: Record<string, PeripheralInfo> = {};

  for (const pin of leads) {
    const gpioMatch = /^GPIO(\d+)(?:\/|$)/.exec(pin.name);
    const gpio = gpioMatch ? Number.parseInt(gpioMatch[1], 10) : undefined;
    const joined = gpio === undefined ? [] : funcselSignalsForGpio(table, gpio);
    const signals = joined.map((sig) => ({
      peripheral: sig.peripheral,
      signal: sig.signal,
      af: sig.af,
      funcLabel: sig.funcLabel,
      ...(sig.resourceId ? { resourceId: sig.resourceId } : {}),
    }));
    const tags = deriveRpTags(pin.name, signals);

    pins.push({
      pos: pin.number,
      name: pin.name,
      type: rpPinType(pin.name),
      signals,
      ...(tags.length > 0 ? { tags } : {}),
    });

    for (const signal of signals) {
      let entry = peripherals[signal.peripheral];
      if (!entry) {
        entry = {
          kind: rpPeripheralKind(signal.peripheral),
          signals: [],
        };
        peripherals[signal.peripheral] = entry;
      }
      if (!entry.signals.includes(signal.signal)) entry.signals.push(signal.signal);
    }
  }

  for (const info of Object.values(peripherals)) {
    info.signals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  const pio: ChipPioConfig = {
    instances: Array.from({ length: pioInstanceCount(table) }, (_, i) => `PIO${i}`),
    stateMachinesPerInstance: RP_STATE_MACHINES_PER_PIO,
    gpioBaseOptions: gpioBaseOptions(facts.gpioCount),
  };

  return {
    id: spec.id,
    vendor: 'rp',
    muxModel: 'funcsel-pio',
    family: spec.id.startsWith('RP2040') ? 'RP2040' : 'RP2350',
    core: /Cortex-M33/.test(facts.docsText) ? 'Dual Cortex-M33' : 'Dual Cortex-M0+',
    flashKb: facts.flashKb,
    ramKb: facts.ramKb,
    package: packageInfo,
    pins,
    peripherals,
    pio,
  };
}

/** Compact index entry for one emitted RP chip. */
export function rpIndexEntry(chip: ChipData): CatalogIndexEntry {
  return {
    id: chip.id,
    vendor: 'rp',
    family: chip.family,
    core: chip.core,
    package: chip.package.name,
    pinCount: chip.package.pinCount,
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    geometry: indexGeometryFromPackage(chip.package),
  };
}

/** Generates every RP chip shard and index entry from the acquired sources. */
export function generateRp(ctx: AdapterContext): AdapterResult {
  const chips = new Map<string, ChipData>();
  const index = new Map<string, CatalogIndexEntry>();
  const families = new Set<string>();

  // Symbols: a missing or unparseable symbol file defers only its own parts.
  const symbols = new Map<string, KiCadSymbol>();
  for (const name of RP_SYMBOL_NAMES) {
    const relPath = `${SYMBOL_DIR}/${name}.kicad_sym`;
    const text = readSource(ctx, RP_SOURCE_IDS.symbols, relPath, name);
    if (!text) continue;
    try {
      const parsed = parseKiCadSymbolFile(text);
      if (parsed.size === 0) {
        ctx.warnings.add({ vendor: 'rp', file: relPath, refName: name, reason: 'No KiCad symbol definitions found.' });
        continue;
      }
      for (const [key, value] of parsed) symbols.set(key, value);
    } catch (err) {
      ctx.warnings.add({
        vendor: 'rp',
        file: relPath,
        refName: name,
        reason: `KiCad symbol parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Footprints only refine geometry; absence is a warning, not a part deferral.
  const geometries = new Map<string, FootprintGeometry>();
  const footprints = new Set(RP_PART_SPECS.map((spec) => spec.footprint));
  for (const footprint of footprints) {
    const relPath = `${FOOTPRINT_DIR}/${footprint}.kicad_mod`;
    const text = readSource(ctx, RP_SOURCE_IDS.footprints, relPath, footprint);
    if (!text) continue;
    try {
      const geometry = parseKiCadFootprint(text);
      if (geometry) geometries.set(footprint, geometry);
      else {
        ctx.warnings.add({
          vendor: 'rp',
          file: relPath,
          refName: footprint,
          reason: 'KiCad footprint has no parseable lead pads; package sides fall back to pin positions.',
        });
      }
    } catch (err) {
      ctx.warnings.add({
        vendor: 'rp',
        file: relPath,
        refName: footprint,
        reason: `KiCad footprint parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // FUNCSEL: picotool is primary, pico-sdk Doxygen tables are the fallback.
  const picotoolText = readSource(ctx, RP_SOURCE_IDS.picotool, RP_SHARED_PATHS.picotool, 'FUNCSEL');
  const picoSdkText = readSource(ctx, RP_SOURCE_IDS.picoSdk, RP_SHARED_PATHS.picoSdk, 'FUNCSEL');
  const funcTables = selectFuncTables(picotoolText, picoSdkText);
  if (funcTables.size === 0) {
    ctx.warnings.add({
      vendor: 'rp',
      reason: 'No FUNCSEL table could be parsed from picotool or pico-sdk; all RP parts deferred.',
    });
    return {
      vendor: 'rp',
      chips,
      index: [],
      families: [],
      totalVariants: RP_PART_SPECS.length,
      matchedVariants: 0,
    };
  }

  // Variant facts: Zephyr supplies SRAM and GPIO counts, docs supply flash.
  const zephyrTexts = new Map<string, string | undefined>();
  for (const relPath of new Set(RP_PART_SPECS.flatMap((spec) => spec.zephyrFiles))) {
    zephyrTexts.set(relPath, readSource(ctx, RP_SOURCE_IDS.zephyr, relPath, 'variant facts'));
  }
  // The documentation repo publishes one variant table file per chip family.
  const docFileFor = (spec: RpPartSpec): string => (spec.docId === 'RP2040' ? 'rp2040' : 'rp2350');
  const docTexts = new Map<string, string | undefined>();
  for (const docFile of new Set(RP_PART_SPECS.map(docFileFor))) {
    const relPath = `${DOC_DIR}/${docFile}.adoc`;
    docTexts.set(docFile, readSource(ctx, RP_SOURCE_IDS.docs, relPath, docFile));
  }
  const docVariants = new Map<string, DocVariant>();
  for (const text of docTexts.values()) {
    if (!text) continue;
    for (const [id, variant] of parseDocumentationVariants(text)) docVariants.set(id, variant);
    const rp2040 = parseRp2040DocFacts(text);
    if (rp2040) docVariants.set(rp2040.id, rp2040);
  }

  for (const spec of RP_PART_SPECS) {
    const symbol = resolveKiCadSymbol(symbols, spec.symbol);
    if (!symbol || symbol.pins.length === 0) {
      ctx.warnings.add({
        vendor: 'rp',
        refName: spec.id,
        reason: `KiCad symbol ${spec.symbol} is unresolved or has no pins; part deferred.`,
      });
      continue;
    }
    const table = funcTables.get(spec.funcTable);
    if (!table) {
      ctx.warnings.add({
        vendor: 'rp',
        refName: spec.id,
        reason: `FUNCSEL table ${spec.funcTable} is unavailable; part deferred.`,
      });
      continue;
    }
    const zephyr = parseZephyrFacts(
      spec.zephyrFiles.map((file) => zephyrTexts.get(file)).filter((t): t is string => Boolean(t)),
    );
    const doc = docVariants.get(spec.docId);
    const docsText = docTexts.get(docFileFor(spec)) ?? '';
    if (zephyr.ramKb === undefined || !doc) {
      ctx.warnings.add({
        vendor: 'rp',
        refName: spec.id,
        reason: `SRAM (Zephyr) or variant facts (documentation) are unavailable; part deferred.`,
      });
      continue;
    }

    const symbolGpioCount = symbol.pins.filter((p) => /^GPIO\d+/.test(p.name)).length;
    const gpioCount = zephyr.gpioCount ?? doc.gpioCount ?? symbolGpioCount;
    if (doc.gpioCount !== undefined && doc.gpioCount !== gpioCount) {
      ctx.warnings.add({
        vendor: 'rp',
        refName: spec.id,
        reason: `GPIO count conflict: Zephyr reports ${gpioCount}, documentation reports ${doc.gpioCount}.`,
      });
    }
    if (doc.package && doc.package !== packageNameFromFootprint(spec.footprint)) {
      ctx.warnings.add({
        vendor: 'rp',
        refName: spec.id,
        reason: `Package conflict: footprint ${spec.footprint} vs documentation ${doc.package}.`,
      });
    }

    const chip = buildRpChip(spec, symbol, geometries.get(spec.footprint), table, {
      ramKb: zephyr.ramKb,
      flashKb: doc.flashKb,
      gpioCount,
      doc,
      docsText,
    });
    chips.set(spec.id, chip);
    index.set(spec.id, rpIndexEntry(chip));
    families.add(chip.family);
  }

  console.log(
    `RP adapter: ${RP_PART_SPECS.length} parts covered, emitted ${chips.size} chips ` +
    `from KiCad symbols and ${funcTables.size} FUNCSEL tables.`,
  );

  return {
    vendor: 'rp',
    chips,
    index: Array.from(index.values()).sort((a, b) => a.id.localeCompare(b.id)),
    families: Array.from(families).sort(),
    totalVariants: RP_PART_SPECS.length,
    matchedVariants: chips.size,
  };
}

interface RpReference {
  id: string;
  pkg: string;
  pins: number;
  gpioCount: number;
  flashKb: number;
  pioInstances: number;
  gpioBaseOptions: number[];
  adcGpios: number[];
  hstx: boolean;
  slices8to11: boolean;
}

const RP2040_ADC_GPIOS = [26, 27, 28, 29];
const RP2350B_ADC_GPIOS = [40, 41, 42, 43, 44, 45, 46, 47];

/** Five RP reference parts from the RP gate contract. */
export const RP_REFERENCES: readonly RpReference[] = [
  { id: 'RP2040', pkg: 'QFN-56', pins: 56, gpioCount: 30, flashKb: 0, pioInstances: 2, gpioBaseOptions: [0], adcGpios: RP2040_ADC_GPIOS, hstx: false, slices8to11: false },
  { id: 'RP2350A', pkg: 'QFN-60', pins: 60, gpioCount: 30, flashKb: 0, pioInstances: 3, gpioBaseOptions: [0], adcGpios: RP2040_ADC_GPIOS, hstx: true, slices8to11: false },
  { id: 'RP2350B', pkg: 'QFN-80', pins: 80, gpioCount: 48, flashKb: 0, pioInstances: 3, gpioBaseOptions: [0, 16], adcGpios: RP2350B_ADC_GPIOS, hstx: true, slices8to11: true },
  { id: 'RP2354A', pkg: 'QFN-60', pins: 60, gpioCount: 30, flashKb: 2048, pioInstances: 3, gpioBaseOptions: [0], adcGpios: RP2040_ADC_GPIOS, hstx: true, slices8to11: false },
  { id: 'RP2354B', pkg: 'QFN-80', pins: 80, gpioCount: 48, flashKb: 2048, pioInstances: 3, gpioBaseOptions: [0, 16], adcGpios: RP2350B_ADC_GPIOS, hstx: true, slices8to11: true },
];

/** Package, pin count, GPIO, mux, tag and PIO assertions for RP parts. */
export const rpReferenceGate: Gate = {
  name: 'rp-reference-parts',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    const notes: string[] = [];
    let chipsWithPioSignals = 0;
    for (const ref of RP_REFERENCES) {
      const chip = ctx.chips.get(ref.id);
      if (!chip) {
        // An upstream source failure is warned and tolerated; silent loss is an error.
        const warned = ctx.warnings.some((w) => w.vendor === 'rp' && w.refName === ref.id);
        const message = `RP gate: expected reference chip ${ref.id} was not emitted.`;
        (warned ? notes : errors).push(message);
        continue;
      }
      const fail = (message: string): void => {
        errors.push(`RP gate: ${ref.id} ${message}`);
      };
      if (chip.vendor !== 'rp' || chip.muxModel !== 'funcsel-pio') {
        fail(`expected vendor rp and muxModel funcsel-pio, got ${chip.vendor}/${chip.muxModel}`);
      }
      if (chip.package.name !== ref.pkg) fail(`expected package ${ref.pkg}, got ${chip.package.name}`);
      if (chip.pins.length !== ref.pins || chip.package.pinCount !== ref.pins) {
        fail(`expected ${ref.pins} pins, got ${chip.pins.length} (pinCount ${chip.package.pinCount})`);
      }
      if (!chip.package.hasExposedPad) fail('missing exposed-pad GND flag');
      if (!chip.pins.some((p) => p.type === 'power')) fail('has no typed power/ground pins');
      const gpioPins = chip.pins.filter((p) => /^GPIO\d+/.test(p.name));
      if (gpioPins.length !== ref.gpioCount) {
        fail(`expected ${ref.gpioCount} GPIO pins, got ${gpioPins.length}`);
      }
      if (!chip.pins.some((p) => p.signals.some((s) => s.funcLabel === 'F1'))) {
        fail('has no F1 FUNCSEL signal');
      }
      const funcSlots = chip.pins
        .flatMap((p) => p.signals.map((s) => s.af))
        .filter((f): f is number => f !== null);
      const maxFunc = funcSlots.length > 0 ? Math.max(...funcSlots) : -1;
      if (ref.id === 'RP2040') {
        if (maxFunc > 9) fail(`RP2040 FUNCSEL slot ${maxFunc} exceeds F9`);
        if (funcSlots.some((f) => f === 10 || f === 11)) fail('RP2040 has RP2350-only FUNCSEL slots');
      } else if (maxFunc < 11) {
        fail(`expected F11 FUNCSEL support, max slot is F${maxFunc}`);
      }

      const sliceIds = new Set(
        chip.pins.flatMap((p) => p.signals.map((s) => s.resourceId ?? '')).filter((id) => /^PWM\d+[AB]$/.test(id)),
      );
      const maxSlice = Math.max(0, ...Array.from(sliceIds).map((id) => Number.parseInt(/^PWM(\d+)/.exec(id)![1], 10)));
      const invalidSlice = Array.from(sliceIds).find((id) => {
        const index = Number.parseInt(/^PWM(\d+)/.exec(id)![1], 10);
        return index < 0 || index > 11;
      });
      if (invalidSlice) fail(`invalid PWM slice resource ${invalidSlice}`);
      if (ref.slices8to11) {
        for (const id of ['PWM8A', 'PWM11B']) {
          if (!sliceIds.has(id)) fail(`missing RP2350B-exclusive resource ${id}`);
        }
      } else if (maxSlice > 7) {
        fail(`unexpected PWM slice ${maxSlice} outside RP2350B`);
      }
      if (maxSlice > 11) fail(`PWM slice ${maxSlice} exceeds PWM11`);

      const adcPins = chip.pins
        .filter((p) => p.tags?.includes('adc'))
        .map((p) => Number.parseInt(/^GPIO(\d+)/.exec(p.name)?.[1] ?? '-1', 10))
        .sort((a, b) => a - b);
      if (JSON.stringify(adcPins) !== JSON.stringify(ref.adcGpios.slice().sort((a, b) => a - b))) {
        fail(`ADC pins ${JSON.stringify(adcPins)} do not match expected ${JSON.stringify(ref.adcGpios)}`);
      }
      if (!chip.pins.some((p) => p.tags?.includes('qspi'))) {
        fail('no QSPI-tagged flash pins');
      }
      const swdPins = chip.pins.filter((p) => p.name === 'SWCLK' || p.name === 'SWDIO');
      if (swdPins.length < 2 || !swdPins.every((p) => p.tags?.includes('debug-swd'))) {
        fail('SWCLK/SWDIO pins are missing the debug-swd tag');
      }
      if (chip.pins.some((p) => p.signals.some((s) => /^PIO\d+$/.test(s.peripheral)))) {
        chipsWithPioSignals += 1;
      }
      if (ref.hstx) {
        const hstxPins = chip.pins.filter((p) => /^GPIO1[2-9]$/.test(p.name));
        if (hstxPins.length !== 8 || !hstxPins.every((p) => p.tags?.includes('hstx'))) {
          fail('HSTX tag missing on GPIO12-19');
        }
        if (!chip.pins.some((p) => p.signals.some((s) => s.peripheral === 'HSTX'))) {
          fail('no HSTX FUNCSEL signal emitted');
        }
      } else if (chip.pins.some((p) => p.tags?.includes('hstx'))) {
        fail('RP2040 must not carry HSTX tags');
      }
      if (chip.flashKb !== ref.flashKb) {
        fail(`expected ${ref.flashKb} KB flash, got ${chip.flashKb} KB`);
      }
      if (!chip.pio || chip.pio.instances.length !== ref.pioInstances) {
        fail(`expected ${ref.pioInstances} PIO instances`);
      }
      if (chip.pio && chip.pio.stateMachinesPerInstance !== RP_STATE_MACHINES_PER_PIO) {
        fail(`expected ${RP_STATE_MACHINES_PER_PIO} state machines per PIO`);
      }
      if (chip.pio && JSON.stringify(chip.pio.gpioBaseOptions) !== JSON.stringify(ref.gpioBaseOptions)) {
        fail(`expected GPIOBASE options ${JSON.stringify(ref.gpioBaseOptions)}`);
      }
    }
    if (chipsWithPioSignals === 0) {
      errors.push('RP gate: no reference chip carries PIO instance FUNCSEL signals.');
    }
    return { vendor: 'rp', name: 'rp-reference-parts', errors, notes };
  },
};

/** Requires all five covered RP parts and a complete match ratio. */
export const rpCountGate: Gate = {
  name: 'rp-part-count',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    const notes: string[] = [];
    // Source outages are warned and tolerated so STM32/CH32 catalog emission
    // continues; a silent shortfall with no source warning is a hard failure.
    const sourceOutage = ctx.warnings.some(
      (w) =>
        w.vendor === 'rp' &&
        /unavailable|not configured|could not be read|No FUNCSEL|parse error|unresolved|deferred/i.test(
          w.reason,
        ),
    );
    const record = (message: string): void => {
      (sourceOutage ? notes : errors).push(message);
    };
    if (ctx.index.length !== RP_PART_SPECS.length) {
      record(`RP gate: expected ${RP_PART_SPECS.length} covered parts, got ${ctx.index.length}.`);
    }
    if (ctx.totalVariants !== RP_PART_SPECS.length) {
      record(`RP gate: expected ${RP_PART_SPECS.length} variants, got ${ctx.totalVariants}.`);
    }
    if (ctx.matchedVariants !== ctx.index.length) {
      record(`RP gate: matched variants ${ctx.matchedVariants} differ from emitted chips ${ctx.index.length}.`);
    }
    console.log(`  rp parts: ${ctx.index.length} emitted`);
    return { vendor: 'rp', name: 'rp-part-count', errors, notes };
  },
};

/** Registered RP vendor adapter; license attribution is read from sources. */
export const rpAdapter: VendorAdapter = {
  vendor: 'rp',
  sourceSpecs: rpSourceSpecs(),
  primarySourceId: RP_SOURCE_IDS.symbols,
  generate: generateRp,
  gates: [rpReferenceGate, rpCountGate],
  strict: true,
};

export const RP_LICENSES = {
  kicad: LICENSE_KICAD,
  picotool: LICENSE_PICOTOOL,
  zephyr: LICENSE_ZEPHYR,
  docs: LICENSE_RPI_DOCS,
} as const;
