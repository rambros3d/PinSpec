import { describe, expect, it } from 'vitest';
import {
  allocatePeripheralMode,
  applyOneHopFix,
  createEmptyWorkspace,
  evaluateWorkspace,
  findAlternatePins,
  remapPinAssignment,
} from '../src/core/solver';
import type { ChipData } from '../src/core/types';

function makeFixtureChip(): ChipData {
  return {
    id: 'STM32TEST48',
    family: 'STM32G4',
    core: 'Cortex-M4',
    flashKb: 128,
    ramKb: 32,
    package: {
      name: 'UFQFPN48',
      kind: 'perimeter',
      pinCount: 12,
      sides: [3, 3, 3, 3],
    },
    pins: [
      { pos: '1', name: 'VDD', type: 'power', signals: [] },
      { pos: '2', name: 'PF0', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_IN', af: null }] },
      { pos: '3', name: 'PF1', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_OUT', af: null }] },
      {
        pos: '4',
        name: 'PA5',
        type: 'io',
        signals: [
          { peripheral: 'SPI1', signal: 'SCK', af: 5 },
          { peripheral: 'TIM2', signal: 'CH1', af: 1 },
        ],
      },
      {
        pos: '5',
        name: 'PA6',
        type: 'io',
        signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }],
      },
      {
        pos: '6',
        name: 'PA7',
        type: 'io',
        signals: [{ peripheral: 'SPI1', signal: 'MOSI', af: 5 }],
      },
      {
        pos: '7',
        name: 'PB3',
        type: 'io',
        signals: [
          { peripheral: 'SPI1', signal: 'SCK', af: 5 },
          { peripheral: 'USART2', signal: 'TX', af: 7 },
        ],
      },
      {
        pos: '8',
        name: 'PA2',
        type: 'io',
        signals: [{ peripheral: 'USART2', signal: 'TX', af: 7 }],
      },
      {
        pos: '9',
        name: 'PA3',
        type: 'io',
        signals: [{ peripheral: 'USART2', signal: 'RX', af: 7 }],
      },
      {
        pos: '10',
        name: 'PA11',
        type: 'io',
        signals: [
          { peripheral: 'USB', signal: 'DM', af: 10 },
          { peripheral: 'SPI1', signal: 'MOSI', af: 5 },
        ],
      },
      {
        pos: '11',
        name: 'PA12',
        type: 'io',
        signals: [{ peripheral: 'USB', signal: 'DP', af: 10 }],
      },
      {
        pos: '12',
        name: 'PA13',
        type: 'io',
        signals: [
          { peripheral: 'SYS', signal: 'SWDIO', af: 0 },
          { peripheral: 'USART2', signal: 'TX', af: 7 },
        ],
      },
    ],
    peripherals: {
      SPI1: {
        kind: 'spi',
        signals: ['SCK', 'MISO', 'MOSI'],
        dma: [
          { signal: 'RX', channels: ['DMA1_CH2'] },
          { signal: 'TX', channels: ['DMA1_CH3'] },
        ],
      },
      USART2: {
        kind: 'usart',
        signals: ['TX', 'RX'],
        dma: [
          { signal: 'TX', channels: ['DMA1_CH2'] }, // Intentionally shares fixed DMA1_CH2 with SPI1_RX
          { signal: 'RX', channels: ['DMA1_CH6'] },
        ],
      },
      TIM2: {
        kind: 'tim',
        signals: ['CH1'],
      },
      USB: {
        kind: 'usb',
        signals: ['DM', 'DP'],
      },
      SYS: {
        kind: 'sys',
        signals: ['SWDIO'],
      },
      RCC: {
        kind: 'sys',
        signals: ['OSC_IN', 'OSC_OUT'],
      },
    },
  };
}

describe('core constraint solver and auto-allocator', () => {
  it('avoids scarce USB and SWD pins during scarcity-aware auto-allocation', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    const res = allocatePeripheralMode(chip, state, 'SPI1', 'full_duplex');

    expect(res.unallocated).toEqual([]);
    // MOSI should prefer PA7 (pos 6) over scarce USB DM pin PA11 (pos 10)
    expect(res.state.assignments['6']).toEqual({ peripheral: 'SPI1', signal: 'MOSI', af: 5 });
    expect(res.state.assignments['10']).toBeUndefined();
    // SCK should be placed on PA5 or PB3
    const sckPos = Object.entries(res.state.assignments).find(([, a]) => a.signal === 'SCK')?.[0];
    expect(['4', '7']).toContain(sckPos);
  });

  it('detects duplicate signal conflicts as errors', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    state.assignments['4'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
    state.assignments['7'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };

    const report = evaluateWorkspace(chip, state);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(report.diagnostics.some((d) => d.code === 'DUPLICATE_SIGNAL')).toBe(true);
    expect(report.pinStatus['4']).toBe('conflict');
    expect(report.pinStatus['7']).toBe('conflict');
    expect(report.peripheralStatus.SPI1).toBe('error');
  });

  it('flags SWD repurposing and fixed-channel DMA contention as warnings', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    state.assignments['12'] = { peripheral: 'USART2', signal: 'TX', af: 7 };
    state.assignments['9'] = { peripheral: 'USART2', signal: 'RX', af: 7 };
    state.assignments['4'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
    state.assignments['5'] = { peripheral: 'SPI1', signal: 'MISO', af: 5 };
    state.assignments['6'] = { peripheral: 'SPI1', signal: 'MOSI', af: 5 };

    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'SWD_REPURPOSED')).toBe(true);
    expect(report.diagnostics.some((d) => d.code === 'DMA_CONTENTION')).toBe(true);
  });

  it('computes 1-hop remap suggestion when a required signal is blocked by an unlocked assignment', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    // Block PA5 (pos 4) with SPI1_SCK (unlocked), while TIM2_CH1 only exists on PA5!
    state.assignments['4'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
    state.peripheralModes.SPI1 = 'full_duplex';
    state.assignments['5'] = { peripheral: 'SPI1', signal: 'MISO', af: 5 };
    state.assignments['6'] = { peripheral: 'SPI1', signal: 'MOSI', af: 5 };

    const res = allocatePeripheralMode(chip, state, 'TIM2', 'pwm_1ch');
    expect(res.unallocated).toEqual(['CH1']);
    expect(res.suggestions.length).toBe(1);
    const fix = res.suggestions[0];
    expect(fix.targetPeripheral).toBe('TIM2');
    expect(fix.targetPos).toBe('4');
    expect(fix.displacedPeripheral).toBe('SPI1');
    expect(fix.displacedToPos).toBe('7'); // PB3 is free alternate for SPI1_SCK

    const fixed = applyOneHopFix(res.state, fix);
    expect(fixed.assignments['4']).toEqual({ peripheral: 'TIM2', signal: 'CH1', af: 1 });
    expect(fixed.assignments['7']).toEqual({ peripheral: 'SPI1', signal: 'SCK', af: 5 });

    const report = evaluateWorkspace(chip, fixed);
    expect(report.peripheralStatus.TIM2).toBe('active');
    expect(report.peripheralStatus.SPI1).toBe('active');
  });

  it('respects locked pins during mode disable and discovers alternate pins preserving labels on remap', () => {
    const chip = makeFixtureChip();
    let state = createEmptyWorkspace(chip.id);
    state.assignments['4'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
    state.labels['4'] = 'IMU_CLK';
    state.locked['4'] = true;

    const afterDisable = allocatePeripheralMode(chip, state, 'SPI1', 'disabled').state;
    // Locked pin remains intact
    expect(afterDisable.assignments['4']).toEqual({ peripheral: 'SPI1', signal: 'SCK', af: 5 });

    const alts = findAlternatePins(chip, state, '4');
    expect(alts.length).toBe(1);
    expect(alts[0].pos).toBe('7');
    expect(alts[0].status).toBe('free');

    state = remapPinAssignment(chip, state, '4', '7');
    expect(state.assignments['4']).toBeUndefined();
    expect(state.assignments['7']).toEqual({ peripheral: 'SPI1', signal: 'SCK', af: 5 });
    expect(state.labels['7']).toBe('IMU_CLK');
    expect(state.labels['4']).toBeUndefined();
  });

  it('flags incomplete peripheral modes with missing signals list', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    state.peripheralModes.SPI1 = 'full_duplex';
    state.assignments['4'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };

    const report = evaluateWorkspace(chip, state);
    const inc = report.diagnostics.find((d) => d.code === 'INCOMPLETE_MODE');
    expect(inc).toBeDefined();
    expect(inc?.missingSignals).toEqual(['MISO', 'MOSI']);
    expect(report.peripheralStatus.SPI1).toBe('partial');
    expect(report.pinStatus['4']).toBe('partial');
  });

  it('preserves funcLabel, remapId and resourceId through solver operations', () => {
    const chip = makeFixtureChip();
    chip.pins[6].signals.push({
      peripheral: 'SPI1',
      signal: 'SCK',
      af: 5,
      funcLabel: 'AF5',
      resourceId: 'EXTI3',
    });
    const state = createEmptyWorkspace(chip.id);
    state.assignments['4'] = {
      peripheral: 'SPI1',
      signal: 'SCK',
      af: 5,
      funcLabel: 'AF5',
      remapId: 2,
      resourceId: 'EXTI3',
    };

    const remapped = remapPinAssignment(chip, state, '4', '7');
    expect(remapped.assignments['7']).toEqual({
      peripheral: 'SPI1',
      signal: 'SCK',
      af: 5,
      funcLabel: 'AF5',
      remapId: 2,
      resourceId: 'EXTI3',
    });

    const fix = applyOneHopFix(state, {
      label: 'test',
      targetPeripheral: 'TIM2',
      targetSignal: 'CH1',
      targetAf: 1,
      targetPos: '4',
      displacedFromPos: '4',
      displacedToPos: '7',
      displacedPeripheral: 'SPI1',
      displacedSignal: 'SCK',
      displacedAf: 5,
      displacedMetadata: { funcLabel: 'AF5', remapId: 2, resourceId: 'EXTI3' },
    });
    expect(fix.assignments['7']).toEqual({
      peripheral: 'SPI1',
      signal: 'SCK',
      af: 5,
      funcLabel: 'AF5',
      remapId: 2,
      resourceId: 'EXTI3',
    });
  });

  it('keeps STM32 SWD and HSE diagnostic outcomes tag-free', () => {
    const chip = makeFixtureChip();
    const state = createEmptyWorkspace(chip.id);
    state.assignments['12'] = { peripheral: 'USART2', signal: 'TX', af: 7 };
    state.assignments['2'] = { peripheral: 'GPIO', signal: 'Output', af: null };
    state.peripheralModes.RCC = 'hse';
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'SWD_REPURPOSED')).toBe(true);
    expect(report.diagnostics.some((d) => d.code === 'HSE_CONFLICT')).toBe(true);
    expect(report.diagnostics.some((d) => d.code === 'DEBUG_PIN_REPURPOSED')).toBe(false);
  });
});
