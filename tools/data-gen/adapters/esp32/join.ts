/**
 * Join first-party ESP32 records by GPIO number and map them to KiCad pads.
 * Every emitted fact comes from one of the acquired upstream files; missing
 * evidence is reported as a deferral, never invented.
 */
import type {
  ChipData,
  PackageInfo,
  PeripheralInfo,
  PeripheralKind,
  PinInfo,
  PinSignal,
} from '../../../../src/core/types';
import type {
  EspModule,
  GpioToolSoc,
  GpioToolTarget,
  KicadFootprint,
  KicadSymbol,
  MetadataDevice,
} from './types';
import { displayFamily } from './gpio-tool';

/** Map an upstream function name to the declarative peripheral kind. */
function kindFor(functionName: string): PeripheralKind {
  if (/^ADC|^DAC/.test(functionName)) return /^DAC/.test(functionName) ? 'dac' : 'adc';
  if (/^I2C|^I2S/.test(functionName)) return 'i2c';
  if (/^U\d|^UART/.test(functionName)) return 'usart';
  if (/^SPI|^FSPI|^HSPI|^VSPI|^FSPIC/.test(functionName)) return 'spi';
  if (/^LEDC|^PWM/.test(functionName)) return 'pwm';
  if (/^USB/.test(functionName)) return 'usb';
  if (/^TWAI|^CAN/.test(functionName)) return 'can';
  return 'other';
}

/** Strip a peripheral prefix from a first-party function label. */
function signalFor(functionName: string): string {
  return functionName;
}

/** Inputs and outputs shared by every chip built from one family. */
interface JoinInput {
  target?: GpioToolTarget;
  device: MetadataDevice;
  symbol?: KicadSymbol;
  footprint?: KicadFootprint;
  module?: EspModule;
  soc?: GpioToolSoc;
}

/** Build one chip shard from the joined first-party records. */
export function buildEspChip(
  chipId: string,
  family: string,
  input: JoinInput,
): { chip: ChipData; deferred: string[] } {
  const { target, device, symbol, footprint, module, soc } = input;
  const deferred: string[] = [];
  const display = displayFamily(family);
  const gpios = device.gpios;
  const signalById = new Map<string, 'input' | 'output'>();
  for (const signal of device.inputSignals) {
    if (signal.id !== null) signalById.set(`IN${signal.id}`, 'input');
  }
  for (const signal of device.outputSignals) {
    if (signal.id !== null) signalById.set(`OUT${signal.id}`, 'output');
  }

  const pins: PinInfo[] = [];
  // The footprint declares the exposed thermal pad as its highest-numbered
  // copper pad; the symbol's matching pin is the ground connection for it and
  // is not a distinct perimeter pad.
  const exposedPadNumber = footprint?.hasExposedPad
    ? String(Math.max(...footprint.numberedPads.map(Number)))
    : null;
  const sourcePins = symbol?.pins ?? Array.from(gpios.values()).map((gpio) => ({
    number: `${gpio.pin}`,
    name: `GPIO${gpio.pin}`,
    electrical: 'bidirectional',
  }));

  for (const source of sourcePins) {
    if (exposedPadNumber !== null && source.number === exposedPadNumber) continue;
    const gpioMatch = /GPIO(\d+)/.exec(source.name);
    const gpioNumber = gpioMatch ? Number(gpioMatch[1]) : null;
    const gpio = gpioNumber === null ? undefined : target?.gpios.get(gpioNumber);
    const meta = gpioNumber === null ? undefined : gpios.get(gpioNumber);

    if (gpioNumber !== null && !gpio) deferred.push(`${chipId}: GPIO${gpioNumber} absent from ${family} gpio-tool target`);
    if (gpioNumber !== null && !meta) deferred.push(`${chipId}: GPIO${gpioNumber} absent from ${family} esp-metadata`);
    if (soc?.notConnected.includes(gpioNumber ?? -1)) continue;

    const tags: PinInfo['tags'] = [];
    if (gpio?.strappingNote) tags.push('strapping');
    if (gpio?.isOutput === false) tags.push('input-only');
    if (gpio?.rtc) tags.push('rtc');
    if (meta?.lp.length) tags.push('lp');
    if (meta?.limitations.includes('input_only')) tags.push('input-only');
    if (meta?.limitations.includes('strapping')) tags.push('strapping');
    if (meta?.limitations.includes('usb_jtag') || meta?.limitations.includes('jtag')) tags.push('jtag');
    if (soc?.reservedPins.includes(gpioNumber ?? -1)) tags.push('flash');
    if (soc?.psram && soc.reservedPins.includes(gpioNumber ?? -1)) tags.push('psram');
    const hasAdc = Boolean(
      meta?.analog.some((name) => /^ADC/.test(name)) ||
        gpio?.functions.some((name) => /^ADC/.test(name)),
    );
    if (hasAdc) tags.push('adc');

    const signals: PinSignal[] = [];
    const functions = Array.from(
      new Set([...(gpio?.functions ?? []), ...(meta?.analog ?? []), ...(meta?.lp ?? [])]),
    );
    for (const functionName of functions) {
      let direction: 'input' | 'output' | undefined;
      let resourceId: string | undefined;
      const inputSignal = device.inputSignals.find((s) => s.name === functionName);
      const outputSignal = device.outputSignals.find((s) => s.name === functionName);
      const offset = family === 'esp32p4' ? device.funcInSelOffset : 0;
      if (inputSignal) {
        direction = 'input';
        if (inputSignal.id !== null) resourceId = `IN${inputSignal.id + offset}`;
      } else if (outputSignal) {
        direction = 'output';
        if (outputSignal.id !== null) resourceId = `OUT${outputSignal.id}`;
      }
      const peripheral = functionName.replace(/_.*$/, '');
      signals.push({
        peripheral,
        signal: signalFor(functionName),
        af: null,
        funcLabel: functionName,
        ...(direction ? { direction } : {}),
        ...(resourceId ? { resourceId } : {}),
      });
    }

    const name = source.name || `GPIO${gpioNumber ?? source.number}`;
    const type: PinInfo['type'] =
      source.electrical === 'power_in' || /^(VDD|GND|3V3|VCC)/.test(name)
        ? 'power'
        : /EN\/|CHIP_PU|RESET/.test(name)
          ? 'reset'
          : /BOOT/.test(name)
            ? 'boot'
            : gpioNumber !== null
              ? 'io'
              : 'nc';
    const notes: string[] = [];
    if (gpio?.powerDomain) notes.push(`Power domain ${gpio.powerDomain}`);
    if (gpio?.strappingNote) notes.push(`Strapping: ${gpio.strappingNote}`);
    if (gpio?.atReset) notes.push(`At reset ${gpio.atReset}`);
    if (target?.adc2WifiConflict && /^ADC2/.test(name)) {
      notes.push('SAR ADC2 is unavailable while Wi-Fi is active');
    }
    pins.push({
      pos: source.number,
      name,
      type,
      signals,
      ...(tags.length > 0 ? { tags } : {}),
      ...(notes.length > 0 ? { note: notes.join('; ') } : {}),
    });
  }

  // In-package flash and PSRAM reserves are first-party facts even when the
  // KiCad symbol omits the pad. Emit them as unavailable pins keyed by GPIO.
  for (const gpio of new Set(soc?.reservedPins ?? [])) {
    if (pins.some((pin) => pin.name.includes(`GPIO${gpio}`))) continue;
    const reservedTags: PinInfo['tags'] = ['flash'];
    if (soc?.psram) reservedTags.push('psram');
    pins.push({
      pos: `GPIO${gpio}`,
      name: `GPIO${gpio}`,
      type: 'nc',
      signals: [],
      tags: reservedTags,
      note: 'Reserved by the in-package flash or PSRAM declared upstream.',
    });
  }

  for (const pin of pins) {
    if (pin.tags) pin.tags = Array.from(new Set(pin.tags));
  }

  const padCount = footprint?.numberedPads.length ?? pins.length;
  const packageInfo: PackageInfo = {
    name: footprint?.name.replace(/-1EP.*$/, '') ?? `${display}-QFN`,
    kind: 'perimeter',
    pinCount: pins.length,
    sides: [Math.ceil(padCount / 4), Math.floor(padCount / 4), Math.ceil(padCount / 4), Math.floor(padCount / 4)],
    ...(footprint?.hasExposedPad ? { hasExposedPad: true } : {}),
  };

  const peripherals: Record<string, PeripheralInfo> = {};
  for (const pin of pins) {
    for (const signal of pin.signals) {
      const info = peripherals[signal.peripheral] ?? {
        kind: kindFor(signal.peripheral),
        signals: [],
      };
      if (!info.signals.includes(signal.signal)) info.signals.push(signal.signal);
      peripherals[signal.peripheral] = info;
    }
  }
  if (target?.wifi) peripherals.WIFI = { kind: 'other', signals: ['STA'] };

  const chip: ChipData = {
    id: chipId,
    vendor: 'esp32',
    muxModel: 'gpio-matrix',
    // Emit identity only when buildEspModules() supplied acquired evidence;
    // bare dies and MPN-only parts receive no module field at all.
    ...(module
      ? {
          module: {
            kind: 'module' as const,
            name: module.id,
            baseFamily: module.baseFamily,
            symbol: module.symbol,
          },
        }
      : {}),
    family: display,
    core: device.arch || (device.cores === 1 ? 'Synthetic' : 'Espressif'),
    flashKb: module?.flashKb ?? soc?.flashKb ?? null,
    ramKb: target?.sramKb ?? 0,
    package: packageInfo,
    pins,
    peripherals,
  };
  return { chip, deferred };
}
