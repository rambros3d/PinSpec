import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceFromPins,
  canonicalizeIocPartId,
  expandPartId,
  mapIocMode,
  mapIocSignal,
  normalizeIocPinName,
  parseIoc,
  prepareIocImport,
  resolvePartIdCandidates,
} from '../src/core/importers/ioc';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import type { CatalogIndexEntry, ChipData } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const IOC_FIXTURE = [
  '#Copyright (c) 2020 STMicroelectronics. All rights reserved.',
  '#MicroXplorer Configuration settings - do not modify',
  '',
  'Mcu.Family=STM32F4',
  'Mcu.Name=STM32F411R(C-E)Tx',
  'Mcu.UserName=STM32F411RETx',
  'Mcu.Package=LQFP64',
  'Mcu.Pin0=PA13',
  'Mcu.PinsNb=7',
  'Mcu.IP0=NVIC',
  'Mcu.IP1=RCC',
  'Mcu.IP2=SYS',
  'Mcu.IP3=USART2',
  'Mcu.IPn=4',
  'PA13.GPIO_Label=TMS',
  'PA13.Locked=true',
  'PA13.Mode=Serial-Wire',
  'PA13.Signal=SYS_JTMS-SWDIO',
  'PA2.GPIO_Label=USART_TX',
  'PA2.Locked=true',
  'PA2.Mode=Asynchronous',
  'PA2.Signal=USART2_TX',
  'PA5.GPIO_Label=LD2 [Green Led]',
  'PA5.Signal=GPIO_Output',
  'PC13-ANTI_TAMP.Locked=true',
  'PC13-ANTI_TAMP.Signal=GPXTI13',
  'PC14-OSC32_IN.Mode=LSE-External-Oscillator',
  'PC14-OSC32_IN.Signal=RCC_OSC32_IN',
  'PH0\\ -\\ OSC_IN.Locked=true',
  'PH0\\ -\\ OSC_IN.Mode=HSE-External-Clock-Source',
  'PH0\\ -\\ OSC_IN.Signal=RCC_OSC_IN',
  'VP_SYS_VS_Systick.Mode=SysTick',
  'VP_SYS_VS_Systick.Signal=SYS_VS_Systick',
  'SH.GPXTI13.0=GPIO_EXTI13',
  'SH.GPXTI13.ConfNb=1',
  'board=NUCLEO-F411RE',
  'UNRECOGNIZED.Key=ignored',
  '',
].join('\n');

const index: CatalogIndexEntry[] = [
  {
    id: 'STM32F411RCT6',
    vendor: 'stm32',
    family: 'STM32F4',
    core: 'Cortex-M4',
    package: 'LQFP64',
    pinCount: 64,
    flashKb: 256,
    ramKb: 128,
    geometry: { kind: 'perimeter', sides: [16, 16, 16, 16] },
  },
  {
    id: 'STM32F411RET6',
    vendor: 'stm32',
    family: 'STM32F4',
    core: 'Cortex-M4',
    package: 'LQFP64',
    pinCount: 64,
    flashKb: 512,
    ramKb: 128,
    geometry: { kind: 'perimeter', sides: [16, 16, 16, 16] },
  },
  {
    id: 'STM32G431CBU6',
    vendor: 'stm32',
    family: 'STM32G4',
    core: 'Cortex-M4',
    package: 'UFQFPN48',
    pinCount: 48,
    flashKb: 128,
    ramKb: 32,
    geometry: { kind: 'perimeter', sides: [12, 12, 12, 12] },
  },
];

const chip: ChipData = {
  id: 'STM32F411RET6',
  family: 'STM32F4',
  core: 'Cortex-M4',
  flashKb: 512,
  ramKb: 128,
  package: { name: 'LQFP64', kind: 'perimeter', pinCount: 64, sides: [16, 16, 16, 16] },
  pins: [
    { pos: '46', name: 'PA13', type: 'io', signals: [{ peripheral: 'SYS', signal: 'SWDIO', af: null }] },
    { pos: '49', name: 'PA14', type: 'io', signals: [{ peripheral: 'SYS', signal: 'SWCLK', af: null }] },
    { pos: '9', name: 'PA2', type: 'io', signals: [{ peripheral: 'USART2', signal: 'TX', af: 7 }] },
    { pos: '10', name: 'PA3', type: 'io', signals: [{ peripheral: 'USART2', signal: 'RX', af: 7 }] },
    { pos: '15', name: 'PA5', type: 'io', signals: [] },
    { pos: '29', name: 'PB3', type: 'io', signals: [{ peripheral: 'SYS', signal: 'SWO', af: null }] },
    { pos: '2', name: 'PC13-ANTI_TAMP', type: 'io', signals: [] },
    { pos: '3', name: 'PC14-OSC32_IN', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC32_IN', af: null }] },
    { pos: '4', name: 'PC15-OSC32_OUT', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC32_OUT', af: null }] },
    { pos: '5', name: 'PH0 - OSC_IN', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_IN', af: null }] },
    { pos: '6', name: 'PH1 - OSC_OUT', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_OUT', af: null }] },
  ],
  peripherals: { SYS: { kind: 'sys', signals: ['SWDIO', 'SWCLK', 'SWO'] } },
};

describe('.ioc parser', () => {
  it('parses a synthetic board file and ignores comments and unknown keys', () => {
    const parsed = parseIoc(IOC_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const record = parsed.record;
    expect(record.mcuName).toBe('STM32F411R(C-E)Tx');
    expect(record.userName).toBe('STM32F411RETx');
    expect(record.packageName).toBe('LQFP64');
    expect(record.pinsNb).toBe(7);
    expect(record.ipCount).toBe(4);
    expect(record.ipNames).toEqual(['NVIC', 'RCC', 'SYS', 'USART2']);
    expect(record.board).toBe('NUCLEO-F411RE');
    expect(record.extiSignals['13']).toEqual(['GPIO_EXTI13']);
    expect(record.pins).toHaveLength(6);
    expect(record.pins.some((pin) => pin.pinName.startsWith('VP_'))).toBe(false);

    const oscIn = record.pins.find((pin) => pin.signal === 'RCC_OSC_IN');
    expect(oscIn?.pinName).toBe('PH0');
    expect(oscIn?.locked).toBe(true);
    expect(oscIn?.mode).toBe('HSE-External-Clock-Source');

    const exti = record.pins.find((pin) => pin.signal === 'GPXTI13');
    expect(exti?.pinName).toBe('PC13');
  });

  it('rejects a file without an MCU identifier', () => {
    const parsed = parseIoc('board=NUCLEO-F411RE\nPA5.Signal=GPIO_Output\n');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('Mcu.Name');
  });
});

describe('ST signal vocabulary mapping', () => {
  it('maps EXTI, debug, GPIO and peripheral signals to normalized pairs', () => {
    expect(mapIocSignal('GPIO_EXTI13').mapped).toEqual({
      peripheral: 'GPIO',
      signal: 'EXTI',
      resourceId: 'EXTI13',
    });
    expect(mapIocSignal('GPXTI13').mapped).toEqual({
      peripheral: 'GPIO',
      signal: 'EXTI',
      resourceId: 'EXTI13',
    });
    expect(mapIocSignal('SYS_JTMS-SWDIO').mapped).toEqual({
      peripheral: 'SYS',
      signal: 'SWDIO',
    });
    expect(mapIocSignal('DEBUG_JTCK-SWCLK').mapped).toEqual({
      peripheral: 'SYS',
      signal: 'SWCLK',
    });
    expect(mapIocSignal('GPIO_Output').mapped).toEqual({
      peripheral: 'GPIO',
      signal: 'Output',
    });
    expect(mapIocSignal('USART2_TX').mapped).toEqual({
      peripheral: 'USART2',
      signal: 'TX',
    });
    expect(mapIocSignal('USB_OTG_FS_DP').mapped).toEqual({
      peripheral: 'USB_OTG_FS',
      signal: 'DP',
    });
  });

  it('reports unmapped signals and ignores Cube virtual signals', () => {
    const unknown = mapIocSignal('WEIRDSIGNAL');
    expect(unknown.mapped).toBeNull();
    expect(unknown.warning).toContain('WEIRDSIGNAL');

    const virtual = mapIocSignal('SYS_VS_Systick');
    expect(virtual.mapped).toBeNull();
    expect(virtual.warning).toBeUndefined();
  });

  it('maps Cube mode labels only for a matching peripheral kind', () => {
    const usart = mapIocSignal('USART2_TX').mapped!;
    expect(mapIocMode(usart, 'Asynchronous')).toEqual({
      peripheral: 'USART2',
      mode: 'async',
    });
    const sys = mapIocSignal('SYS_JTMS-SWDIO').mapped!;
    expect(mapIocMode(sys, 'Serial-Wire')).toEqual({ peripheral: 'SYS', mode: 'swd' });
    expect(mapIocMode(usart, 'Serial-Wire')).toBeNull();
  });
});

describe('part-id resolution', () => {
  it('expands variants and canonicalizes the temperature wildcard', () => {
    expect(expandPartId('STM32F411R(C-E)Tx')).toEqual([
      'STM32F411RCTx',
      'STM32F411RETx',
    ]);
    expect(canonicalizeIocPartId('STM32F411RETx')).toBe('STM32F411RET6');
  });

  it('resolves against the catalog and reports ambiguous part IDs', () => {
    expect(resolvePartIdCandidates('STM32F411RETx', index)).toEqual(['STM32F411RET6']);
    expect(resolvePartIdCandidates('STM32F411R(C-E)Tx', index)).toEqual([
      'STM32F411RCT6',
      'STM32F411RET6',
    ]);
  });
});

describe('pin-name normalization', () => {
  it('reduces escaped spaces and suffix annotations to the base GPIO name', () => {
    expect(normalizeIocPinName('PH0\\ -\\ OSC_IN')).toBe('PH0');
    expect(normalizeIocPinName('PC14-OSC32_IN')).toBe('PC14');
    expect(normalizeIocPinName('PC13-ANTI_TAMP')).toBe('PC13');
    expect(normalizeIocPinName('VP_SYS_VS_Systick')).toBe('VP_SYS_VS_SYSTICK');
  });
});

describe('import preparation and workspace assembly', () => {
  it('prepares a ready import using the specific part number', () => {
    const prepared = prepareIocImport(IOC_FIXTURE, index);
    expect(prepared.kind).toBe('ready');
    if (prepared.kind !== 'ready') return;
    expect(prepared.mcuId).toBe('STM32F411RET6');
    expect(prepared.record.board).toBe('NUCLEO-F411RE');
  });

  it('waits for confirmation when the part ID is ambiguous', () => {
    const ambiguousText = IOC_FIXTURE.split('\n')
      .filter((line) => !line.startsWith('Mcu.UserName='))
      .join('\n');
    const prepared = prepareIocImport(ambiguousText, index);
    expect(prepared.kind).toBe('ambiguous');
    if (prepared.kind !== 'ambiguous') return;
    expect(prepared.candidates).toEqual(['STM32F411RCT6', 'STM32F411RET6']);
  });

  it('reports an error for a part ID absent from the catalog', () => {
    const bad = IOC_FIXTURE.replace('Mcu.Name=STM32F411R(C-E)Tx', 'Mcu.Name=STM32ZZZ999XXx')
      .replace('Mcu.UserName=STM32F411RETx', 'Mcu.UserName=STM32ZZZ999XXx');
    const prepared = prepareIocImport(bad, index);
    expect(prepared.kind).toBe('error');
    if (prepared.kind !== 'error') return;
    expect(prepared.error).toContain('No catalog part');
  });

  it('assembles a version-2 state keyed by physical position', () => {
    const parsed = parseIoc(IOC_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = buildWorkspaceFromPins(parsed.record.pins, {
      chip,
      mcuId: 'STM32F411RET6',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const state = result.state;
    expect(state.mcuId).toBe('STM32F411RET6');
    expect(state.assignments['9']).toEqual({ peripheral: 'USART2', signal: 'TX', af: 7 });
    expect(state.assignments['46']).toEqual({ peripheral: 'SYS', signal: 'SWDIO', af: null });
    expect(state.assignments['2']).toEqual({
      peripheral: 'GPIO',
      signal: 'EXTI',
      af: null,
      resourceId: 'EXTI13',
    });
    expect(state.labels['15']).toBe('LD2 [Green Led]');
    expect(state.locked['46']).toBe(true);
    expect(state.locked['5']).toBe(true);
    expect(state.peripheralModes.USART2).toBe('async');
    expect(state.peripheralModes.SYS).toBe('swd');
    expect(state.peripheralModes.RCC).toBe('hse_lse');
    expect(result.warnings).toEqual([]);
  });

  it('round-trips the imported state through URL and JSON codecs', () => {
    const parsed = parseIoc(IOC_FIXTURE);
    if (!parsed.ok) throw new Error(parsed.error);
    const built = buildWorkspaceFromPins(parsed.record.pins, {
      chip,
      mcuId: 'STM32F411RET6',
    });
    if (!built.ok) throw new Error(built.error);

    const decoded = decodeWorkspaceState(encodeWorkspaceState(built.state));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(built.state);

    const imported = parsePinoutJson(exportPinoutJson(built.state));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.state).toEqual(built.state);
  });

  it('reports a missing chip instead of producing a partial state', () => {
    const result = buildWorkspaceFromPins([], { chip, mcuId: '' });
    expect(result.ok).toBe(false);
  });
});
