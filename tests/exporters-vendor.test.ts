import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { exportCHeader } from '../src/core/exporters/c-header';
import { exportCsv } from '../src/core/exporters/csv';
import { exportEmbassyRust } from '../src/core/exporters/embassy-rust';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { createEmptyWorkspace } from '../src/core/solver';
import { formatMuxLabel, type ChipData, type WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

function chip(overrides: Partial<ChipData> & { id: string }): ChipData {
  return {
    family: overrides.id,
    core: 'Cortex-M0+',
    flashKb: 256,
    ramKb: 64,
    package: { name: 'TEST', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
    pins: [],
    peripherals: {},
    ...overrides,
  };
}

const stm32 = chip({
  id: 'STM32G431CBU6',
  vendor: 'stm32',
  muxModel: 'af',
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    {
      pos: '15',
      name: 'PA5',
      type: 'io',
      signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 7 }],
    },
    { pos: '1', name: 'VBAT', type: 'power', signals: [] },
  ],
  peripherals: { SPI1: { kind: 'spi', signals: ['SCK'] } },
});

const rp = chip({
  id: 'RP2040',
  vendor: 'rp',
  muxModel: 'funcsel-pio',
  pio: { instances: ['PIO0', 'PIO1'], stateMachinesPerInstance: 4, gpioBaseOptions: [0] },
  package: { name: 'QFN-56', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    {
      pos: '2',
      name: 'GPIO0',
      type: 'io',
      signals: [{ peripheral: 'PWM', signal: 'PWM0A', af: 4, funcLabel: 'F4', resourceId: 'PWM0A' }],
    },
    {
      pos: '4',
      name: 'GPIO2',
      type: 'io',
      signals: [{ peripheral: 'SPI0', signal: 'SCK', af: 1, funcLabel: 'F1' }],
    },
  ],
  peripherals: {
    PWM: { kind: 'pwm', signals: ['PWM0A'] },
    SPI0: { kind: 'spi', signals: ['SCK'] },
    PIO0: { kind: 'pio', signals: ['PIO'] },
  },
});

const ch32 = chip({
  id: 'CH32V003F4P6',
  vendor: 'ch32',
  muxModel: 'remap-group',
  package: { name: 'TSSOP20', kind: 'perimeter', pinCount: 4, sides: [2, 0, 2, 0] },
  pins: [
    {
      pos: '2',
      name: 'PD5',
      type: 'io',
      signals: [{ peripheral: 'USART1', signal: 'TX', af: null, remapId: 1, funcLabel: 'RM1' }],
    },
    {
      pos: '5',
      name: 'PD1',
      type: 'io',
      tags: ['debug-sdi'],
      signals: [{ peripheral: 'SDI', signal: 'SWDIO', af: null, remapId: 0 }],
    },
  ],
  peripherals: {
    USART1: {
      kind: 'usart',
      signals: ['TX'],
      remaps: [
        { id: 0, name: 'Default (RM0)', signals: { TX: 'PD5' } },
        { id: 1, name: 'Remap 1 (RM1)', signals: { TX: 'PD0' }, registerNote: 'PCFR1[2] = 1' },
      ],
    },
    SDI: { kind: 'sys', signals: ['SWDIO'] },
  },
});

const esp32 = chip({
  id: 'ESP32-C3FH4',
  vendor: 'esp32',
  muxModel: 'gpio-matrix',
  package: { name: 'QFN-32', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    {
      pos: '4',
      name: 'GPIO2',
      type: 'io',
      tags: ['strapping'],
      signals: [
        {
          peripheral: 'UART0',
          signal: 'TX',
          af: null,
          funcLabel: 'U0TXD',
          direction: 'output',
        },
      ],
    },
    { pos: '5', name: 'GPIO3', type: 'io', signals: [] },
  ],
  peripherals: { UART0: { kind: 'usart', signals: ['TX'] } },
});

const stm32State: WorkspaceState = {
  ...createEmptyWorkspace('STM32G431CBU6'),
  assignments: { '15': { peripheral: 'SPI1', signal: 'SCK', af: 7 } },
};

const rpState: WorkspaceState = {
  ...createEmptyWorkspace('RP2040'),
  assignments: {
    '2': {
      peripheral: 'PWM',
      signal: 'PWM0A',
      af: 4,
      funcLabel: 'F4',
      resourceId: 'PWM0A',
    },
    '4': { peripheral: 'SPI0', signal: 'SCK', af: 1, funcLabel: 'F1' },
  },
  labels: { '4': 'Flash, CLK' },
  pioAssignments: { '2': { instance: 'PIO0', sm: 0, role: 'TX' } },
};

const ch32State: WorkspaceState = {
  ...createEmptyWorkspace('CH32V003F4P6'),
  assignments: { '2': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 1 } },
  activeRemaps: { USART1: 1 },
};

const esp32State: WorkspaceState = {
  ...createEmptyWorkspace('ESP32-C3FH4'),
  assignments: { '4': { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'U0TXD' } },
};

describe('shared mux label', () => {
  it('produces AF, F, RM and GPIO-mode labels', () => {
    expect(formatMuxLabel({ peripheral: 'SPI1', signal: 'SCK', af: 7 }, 'af')).toBe('AF7');
    expect(
      formatMuxLabel({ peripheral: 'PIO0', signal: 'PIO', af: 6, funcLabel: 'F6' }, 'funcsel-pio'),
    ).toBe('F6');
    expect(
      formatMuxLabel({ peripheral: 'USART1', signal: 'TX', af: null, remapId: 1 }, 'remap-group'),
    ).toBe('RM1');
    expect(formatMuxLabel({ peripheral: 'GPIO', signal: 'Output', af: null }, 'af')).toBe('Output');
    expect(
      formatMuxLabel(
        { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'U0TXD' },
        'gpio-matrix',
      ),
    ).toBe('U0TXD');
  });
});

describe('vendor-dispatched Rust exporter', () => {
  it('preserves the STM32 BoardPins shape', () => {
    const rs = exportEmbassyRust(stm32, stm32State);
    expect(rs).toContain('use embassy_stm32::peripherals;');
    expect(rs).toContain('pub spi1_sck: peripherals::PA5');
    expect(rs).toContain('p: embassy_stm32::Peripherals');
    expect(rs).toContain('[AF7]');
  });

  it('emits embassy-rp init, PIN_x pads, PWM/PIO groups and an interrupt skeleton', () => {
    const rs = exportEmbassyRust(rp, rpState);
    expect(rs).toContain('use embassy_rp::peripherals;');
    expect(rs).toContain('embassy_rp::init(Default::default())');
    expect(rs).toContain('p: embassy_rp::Peripherals');
    expect(rs).toContain('peripherals::PIN_2');
    expect(rs).toContain('p.PIN_2');
    expect(rs).toContain('PWM_SLICE0');
    expect(rs).toContain('PIO0');
    expect(rs).toContain('#[interrupt]');
    expect(rs).toContain('[F4]');
    expect(rs).not.toContain('embassy_stm32');
    expect(rs).not.toContain('[AF4]');
  });

  it('emits ch32-hal init, remap summary and debug-pin warning', () => {
    const state: WorkspaceState = {
      ...ch32State,
      assignments: {
        ...ch32State.assignments,
        '5': { peripheral: 'GPIO', signal: 'Output', af: null },
      },
    };
    const rs = exportEmbassyRust(ch32, state);
    expect(rs).toContain('use ch32_hal::peripherals;');
    expect(rs).toContain('ch32_hal::init()');
    expect(rs).toContain('p: ch32_hal::Peripherals');
    expect(rs).toContain('p.PD5');
    expect(rs).toContain('Remap 1 (RM1)');
    expect(rs).toContain('PCFR1[2] = 1');
    expect(rs).toContain('debug-sdi');
    expect(rs).toContain('[RM1]');
    expect(rs).not.toContain('embassy_stm32');
    expect(rs).not.toContain('[AF1]');
  });

  it('emits esp-hal init, GPIO-number pads and matrix route comments', () => {
    const rs = exportEmbassyRust(esp32, esp32State);
    expect(rs).toContain('use esp_hal::peripherals;');
    expect(rs).toContain('esp_hal::init(Default::default())');
    expect(rs).toContain('p: esp_hal::Peripherals');
    expect(rs).toContain('peripherals::GPIO2');
    expect(rs).toContain('p.GPIO2');
    expect(rs).toContain('Matrix routes in use:');
    expect(rs).toContain('[U0TXD]');
    expect(rs).not.toContain('embassy_stm32');
    expect(rs).not.toContain('embassy_rp');
    expect(rs).not.toContain('[AF');
  });

  it('emits a valid empty struct for every vendor', () => {
    for (const c of [stm32, rp, ch32, esp32]) {
      const rs = exportEmbassyRust(c, createEmptyWorkspace(c.id));
      expect(rs).toContain('pub struct BoardPins {}');
      expect(rs).toContain('pub fn from_peripherals(');
      expect(rs).toContain('Self {}');
    }
  });
});

describe('vendor-dispatched C header', () => {
  it('preserves STM32 PORT/PIN/AF macros', () => {
    const h = exportCHeader(stm32, stm32State);
    expect(h).toContain('#ifndef PINCRAFT_STM32G431CBU6_PINOUT_H');
    expect(h).toContain('#define SPI1_SCK_GPIO_PORT GPIOA');
    expect(h).toContain('#define SPI1_SCK_PIN 5U');
    expect(h).toContain('#define SPI1_SCK_AF 7U');
  });

  it('emits Pico SDK GPIO_FUNC and PWM slice/channel macros without _AF', () => {
    const h = exportCHeader(rp, rpState);
    expect(h).toContain('#define PWM_PWM0A_GPIO 0U');
    expect(h).toContain('#define PWM_PWM0A_GPIO_FUNC GPIO_FUNC_PWM');
    expect(h).toContain('#define PWM_PWM0A_PWM_SLICE 0U');
    expect(h).toContain('#define PWM_PWM0A_PWM_CHANNEL 0U');
    expect(h).toContain('#define FLASH_CLK_GPIO_FUNC GPIO_FUNC_SPI');
    expect(h).toContain('#define FLASH_CLK_GPIO 2U');
    expect(h).toContain('#define PWM_PWM0A_PIO_INSTANCE PIO0');
    expect(h).not.toContain('_AF ');
  });

  it('emits ch32v003fun macros and a remap summary', () => {
    const h = exportCHeader(ch32, ch32State);
    expect(h).toContain('#define USART1_TX_PORT GPIOD');
    expect(h).toContain('#define USART1_TX_PIN 5U');
    expect(h).toContain('Active remap groups (ch32v003fun)');
    expect(h).toContain('Remap 1 (RM1)');
    expect(h).not.toContain('_AF ');
  });

  it('emits ESP32 GPIO macros and matrix function comments without AF macros', () => {
    const h = exportCHeader(esp32, esp32State);
    expect(h).toContain('#ifndef PINCRAFT_ESP32_C3FH4_PINOUT_H');
    expect(h).toContain('#define UART0_TX_GPIO 2U');
    expect(h).toContain('Matrix function: U0TXD');
    expect(h).not.toContain('_AF ');
  });

  it('emits a guarded empty header for ESP32', () => {
    const h = exportCHeader(esp32, createEmptyWorkspace(esp32.id));
    expect(h).toContain('/* No pins assigned yet. */');
    expect(h).toContain('#endif /* PINCRAFT_ESP32_C3FH4_PINOUT_H */');
    expect(h).not.toContain('#define UART0_TX_GPIO');
  });
});

describe('vendor-neutral CSV', () => {
  it('uses the new header, vendor mux labels and escaped cells', () => {
    const csv = exportCsv(rp, rpState);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked,Level,Drive,Pull,Speed');
    expect(lines[1]).toBe('rp,2,GPIO0,io,PWM,PWM0A,F4,PWM0A,,false,,,,');
    expect(lines[2]).toBe('rp,4,GPIO2,io,SPI0,SCK,F1,,"Flash, CLK",false,,,,');
  });

  it('mixes CH32 remap and STM32 AF rows under the new header', () => {
    const csv = exportCsv(ch32, ch32State) + exportCsv(stm32, stm32State).split('\n').slice(1).join('\n');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked,Level,Drive,Pull,Speed');
    expect(lines[1]).toBe('ch32,2,PD5,io,USART1,TX,RM1,,,false,,,,');
    expect(lines[2]).toBe('stm32,15,PA5,io,SPI1,SCK,AF7,,,false,,,,');
  });
});

describe('single-version project-file codec', () => {
  it('round-trips remaps, PIO and per-assignment mux fields with sorted keys', () => {
    const text = exportPinoutJson(rpState, 'rp');
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(doc.version).toBe(2);
    expect(doc.vendor).toBe('rp');
    expect(doc.activeRemaps).toBeUndefined();
    expect(Object.keys(doc.pioAssignments as object)).toEqual(['2']);

    const parsed = parsePinoutJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.assignments['2']).toEqual(rpState.assignments['2']);
      expect(parsed.state.pioAssignments).toEqual(rpState.pioAssignments);
      expect(parsed.state).toEqual(rpState);
    }

    const ch32Parsed = parsePinoutJson(exportPinoutJson(ch32State, 'ch32'));
    expect(ch32Parsed.ok).toBe(true);
    if (ch32Parsed.ok) {
      expect(ch32Parsed.state.activeRemaps).toEqual({ USART1: 1 });
      expect(ch32Parsed.state.assignments['2'].remapId).toBe(1);
    }
  });

  it('rejects legacy and unknown versions without a compatibility shim', () => {
    const v1 = JSON.stringify({ ...JSON.parse(exportPinoutJson(stm32State)), version: 1 });
    const result = parsePinoutJson(v1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unsupported project file version');
    expect(parsePinoutJson(exportPinoutJson(stm32State).replace('"version": 2', '"version": 3')).ok).toBe(false);
  });
});

describe('version-2 share-link codec', () => {
  it('round-trips assignments, remaps and PIO bindings', () => {
    const encoded = encodeWorkspaceState(ch32State);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(ch32State);

    const rpDecoded = decodeWorkspaceState(encodeWorkspaceState(rpState));
    expect(rpDecoded.ok).toBe(true);
    if (rpDecoded.ok) expect(rpDecoded.state).toEqual(rpState);
  });

  it('omits empty remap and PIO keys from the payload', () => {
    const encoded = encodeWorkspaceState(stm32State);
    const bytes = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const payload = JSON.parse(strFromU8(inflateSync(new Uint8Array(bytes)))) as Record<string, unknown>;
    expect(payload.v).toBe(2);
    expect(payload).not.toHaveProperty('r');
    expect(payload).not.toHaveProperty('o');

    const encodedRemaps = encodeWorkspaceState(ch32State);
    const remapBytes = Buffer.from(encodedRemaps.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const remapPayload = JSON.parse(strFromU8(inflateSync(new Uint8Array(remapBytes)))) as Record<string, unknown>;
    expect(remapPayload).toHaveProperty('r');
    expect(remapPayload).not.toHaveProperty('o');
  });

  it('rejects outdated and malformed links with banner-friendly errors', () => {
    const v1Json = JSON.stringify({ v: 1, m: 'STM32G431CBU6' });
    const v1 = Buffer.from(deflateSync(strToU8(v1Json), { level: 9 })).toString('base64url');
    const outdated = decodeWorkspaceState(v1);
    expect(outdated.ok).toBe(false);
    if (!outdated.ok) expect(outdated.error).toContain('Unsupported share link version');

    const bad = decodeWorkspaceState('!!!not-base64!!!');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('Failed to decode shared pinout link');
    expect(decodeWorkspaceState('AAAAAAAA').ok).toBe(false);
  });
});
