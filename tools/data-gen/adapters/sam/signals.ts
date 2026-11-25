/**
 * Joins ATDF module instance signals to physical pads and maps single-letter
 * functions to numeric AF slots. Non-letter functions keep their source label
 * and carry `af: null`; no protocol role is inferred from ATDF group names.
 */
import type {
  PeripheralInfo,
  PeripheralKind,
  PinInfo,
  PinSignal,
} from '../../../../src/core/types';
import type { AtdfInstance, AtdfSignal } from './types';

/**
 * Generic kind normalization from the ATDF module instance name. It classifies
 * only upstream names; no chip fact or signal role is inferred from it.
 */
export function peripheralKindForInstance(name: string): PeripheralKind {
  const upper = name.toUpperCase();
  if (/^(SPI|SERCOM_SPID)/.test(upper)) return 'spi';
  if (/^(TWI|I2C)/.test(upper)) return 'i2c';
  if (/^(USART|UART|LPUART)/.test(upper)) return 'usart';
  if (/^(ADC|AIN)/.test(upper)) return 'adc';
  if (/^DAC/.test(upper)) return 'dac';
  if (/^(TC|TCC|TIMER|TIM)/.test(upper)) return 'tim';
  if (/^(USB|USBFS|UD PHY)/.test(upper)) return 'usb';
  if (/^CAN/.test(upper)) return 'can';
  return 'other';
}

/** AF index of one single-letter ATDF function, or null for other values. */
export function afIndexForFunction(func: string): number | null {
  if (!/^[A-Z]$/.test(func)) return null;
  return func.charCodeAt(0) - 65;
}

/** Signal identity from the verbatim ATDF group and index labels. */
export function signalIdentity(signal: AtdfSignal): string {
  return signal.index === undefined ? signal.group : `${signal.group}${signal.index}`;
}

/** Converted signal record for one ATDF signal row. */
export function toPinSignal(instance: string, signal: AtdfSignal): PinSignal {
  const af = afIndexForFunction(signal.function);
  return {
    peripheral: instance,
    signal: signalIdentity(signal),
    af,
    ...(af === null && signal.function !== '' ? { funcLabel: signal.function } : {}),
  };
}

export interface SignalJoin {
  peripherals: Record<string, PeripheralInfo>;
  /** Pad names named by instance signals but absent from the selected pinout. */
  unmatchedPads: string[];
  /** Number of signals joined to at least one physical pin. */
  joinedSignals: number;
}

/** Joins every instance signal onto pins by exact pad name. */
export function joinSignals(
  pins: PinInfo[],
  instances: AtdfInstance[],
): SignalJoin {
  const pinByPad = new Map(pins.map((pin) => [pin.name, pin]));
  const unmatched = new Set<string>();
  const peripherals: Record<string, PeripheralInfo> = {};
  let joinedSignals = 0;

  for (const instance of instances) {
    const signalNames = new Set<string>();
    for (const signal of instance.signals) {
      const pin = pinByPad.get(signal.pad);
      if (!pin) {
        unmatched.add(signal.pad);
        continue;
      }
      const converted = toPinSignal(instance.name, signal);
      const duplicate = pin.signals.some(
        (existing) =>
          existing.peripheral === converted.peripheral &&
          existing.signal === converted.signal &&
          existing.af === converted.af &&
          existing.funcLabel === converted.funcLabel,
      );
      if (!duplicate) pin.signals.push(converted);
      signalNames.add(converted.signal);
      joinedSignals++;
    }
    if (signalNames.size > 0) {
      peripherals[instance.name] = {
        kind: peripheralKindForInstance(instance.name),
        signals: Array.from(signalNames).sort(),
      };
    }
  }

  return { peripherals, unmatchedPads: Array.from(unmatched).sort(), joinedSignals };
}
