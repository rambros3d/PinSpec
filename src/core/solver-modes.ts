/**
 * Declarative peripheral mode templates and signal canonicalization.
 * Shared with the common pin helpers and consumed by allocation and diagnostics.
 */

import type {
  ChipData,
  PeripheralInfo,
  PeripheralKind,
  PeripheralModeTemplate,
} from './types';

export const PERIPHERAL_MODE_TEMPLATES: Record<PeripheralKind, PeripheralModeTemplate[]> = {
  spi: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'full_duplex', label: 'Full-Duplex Master', required: ['SCK', 'MISO', 'MOSI'], optional: ['NSS'] },
    { id: 'half_duplex', label: 'Half-Duplex', required: ['SCK', 'MOSI'], optional: ['NSS'] },
    { id: 'rx_only', label: 'Receive Only', required: ['SCK', 'MISO'], optional: ['NSS'] },
  ],
  i2c: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'i2c', label: 'I2C', required: ['SCL', 'SDA'], optional: ['SMBA'] },
  ],
  usart: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'async', label: 'Asynchronous', required: ['TX', 'RX'] },
    { id: 'async_hw_flow', label: 'Async + HW Flow Control', required: ['TX', 'RX', 'CTS', 'RTS'] },
    { id: 'sync', label: 'Synchronous', required: ['TX', 'RX', 'CK'] },
    { id: 'half_duplex', label: 'Single-Wire Half-Duplex', required: ['TX'] },
  ],
  can: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'normal', label: 'Normal', required: ['RX', 'TX'] },
  ],
  usb: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'device_fs', label: 'Device (FS)', required: ['DM', 'DP'], optional: ['VBUS', 'ID', 'SOF'] },
  ],
  tim: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'pwm_1ch', label: 'PWM 1-Channel', required: ['CH1'] },
    { id: 'pwm_2ch', label: 'PWM 2-Channel', required: ['CH1', 'CH2'] },
    { id: 'pwm_3ch', label: 'PWM 3-Channel', required: ['CH1', 'CH2', 'CH3'] },
    { id: 'pwm_4ch', label: 'PWM 4-Channel', required: ['CH1', 'CH2', 'CH3', 'CH4'] },
    {
      id: 'pwm_3phase_comp',
      label: '3-Phase Complementary PWM',
      required: ['CH1', 'CH1N', 'CH2', 'CH2N', 'CH3', 'CH3N'],
      optional: ['BKIN', 'BKIN2'],
    },
    { id: 'encoder', label: 'Encoder Interface', required: ['CH1', 'CH2'] },
  ],
  adc: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  dac: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  sys: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'swd', label: 'Serial Wire Debug (SWD)', required: ['SWDIO', 'SWCLK'] },
    { id: 'jtag', label: 'JTAG (5-Pin)', required: ['JTMS', 'JTCK', 'JTDI', 'JTDO', 'NJTRST'] },
  ],
  // Forward-looking kinds scaffolded for multi-vendor data (RP PWM slices /
  // PIO). No current chip emits them, but the map must stay exhaustive so
  // PeripheralKind remains a closed, type-safe set.
  pwm: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  pio: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'custom', label: 'Manual Signals', required: [], isChannelBased: true },
  ],
  other: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'custom', label: 'Manual Signals', required: [], isChannelBased: true },
  ],
};

const RCC_MODES: PeripheralModeTemplate[] = [
  { id: 'disabled', label: 'Internal RC (HSI)', required: [] },
  { id: 'hse', label: 'High Speed Clock (HSE)', required: ['OSC_IN', 'OSC_OUT'] },
  { id: 'lse', label: 'Low Speed Clock (LSE)', required: ['OSC32_IN', 'OSC32_OUT'] },
  { id: 'hse_lse', label: 'HSE + LSE', required: ['OSC_IN', 'OSC_OUT', 'OSC32_IN', 'OSC32_OUT'] },
];

export const SIGNAL_ALIASES: Record<string, string[]> = {
  SWDIO: ['SWDIO', 'JTMS-SWDIO', 'JTMS'],
  SWCLK: ['SWCLK', 'JTCK-SWCLK', 'JTCK'],
  JTMS: ['JTMS', 'JTMS-SWDIO'],
  JTCK: ['JTCK', 'JTCK-SWCLK'],
  JTDO: ['JTDO', 'JTDO-SWO'],
  DM: ['DM', 'FS_DM', 'HS_DM', 'USB_DM'],
  DP: ['DP', 'FS_DP', 'HS_DP', 'USB_DP'],
  VBUS: ['VBUS', 'FS_VBUS', 'HS_VBUS'],
  ID: ['ID', 'FS_ID', 'HS_ID'],
  SOF: ['SOF', 'FS_SOF', 'HS_SOF'],
  RTS: ['RTS', 'DE', 'RTS_DE'],
};

export function getModesForPeripheral(
  chip: ChipData,
  peripheralName: string,
): PeripheralModeTemplate[] {
  const info = chip.peripherals[peripheralName];
  if (!info) return PERIPHERAL_MODE_TEMPLATES.other;

  if (peripheralName === 'RCC') {
    return RCC_MODES.filter((mode) => {
      if (mode.id === 'disabled') return true;
      return mode.required.every((sig) => resolveCanonicalSignal(info, sig) !== null);
    });
  }

  const baseTemplates = PERIPHERAL_MODE_TEMPLATES[info.kind] ?? PERIPHERAL_MODE_TEMPLATES.other;
  if (info.kind === 'adc' || info.kind === 'dac' || info.kind === 'other') {
    return baseTemplates;
  }

  return baseTemplates.filter((mode) => {
    if (mode.id === 'disabled') return true;
    return mode.required.every((req) => resolveCanonicalSignal(info, req) !== null);
  });
}

export function resolveCanonicalSignal(
  info: PeripheralInfo,
  requestedSignal: string,
): string | null {
  if (info.signals.includes(requestedSignal)) {
    return requestedSignal;
  }
  const aliases = SIGNAL_ALIASES[requestedSignal];
  if (aliases) {
    for (const alias of aliases) {
      if (info.signals.includes(alias)) return alias;
    }
  }
  // Check suffix match (e.g. "FS_DM" for "DM")
  const suffixMatch = info.signals.find((s) => s.endsWith(`_${requestedSignal}`));
  if (suffixMatch) return suffixMatch;
  return null;
}
