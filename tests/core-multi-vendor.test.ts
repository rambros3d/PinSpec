import { describe, expect, it } from 'vitest';
import {
  applyOneHopFix,
  applyRemapGroup,
  createEmptyWorkspace,
  evaluateWorkspace,
  findAlternatePins,
  findOneHopFixForSignal,
  remapPinAssignment,
} from '../src/core/solver';
import type { ChipData, OneHopFix, WorkspaceState } from '../src/core/types';

/** Synthetic CH32 remap-group chip with one bonded debug-sdi pin. */
function makeCh32Chip(): ChipData {
  return {
    id: 'CH32V003TEST',
    vendor: 'ch32',
    muxModel: 'remap-group',
    family: 'CH32V003',
    core: 'QingKe V2A',
    flashKb: 16,
    ramKb: 2,
    package: { name: 'TSSOP20', kind: 'perimeter', pinCount: 6, sides: [3, 0, 3, 0] },
    pins: [
      {
        pos: '1',
        name: 'PA9',
        type: 'io',
        signals: [{ peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 }],
      },
      {
        pos: '2',
        name: 'PA10',
        type: 'io',
        signals: [{ peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 }],
      },
      {
        pos: '3',
        name: 'PB6',
        type: 'io',
        signals: [
          { peripheral: 'USART1', signal: 'TX', af: null, funcLabel: 'RM1', remapId: 1 },
        ],
      },
      {
        pos: '4',
        name: 'PB7',
        type: 'io',
        signals: [
          { peripheral: 'USART1', signal: 'RX', af: null, funcLabel: 'RM1', remapId: 1 },
        ],
      },
      {
        pos: '5',
        name: 'PD1',
        type: 'io',
        tags: ['debug-sdi'],
        signals: [{ peripheral: 'SDI', signal: 'SWDIO', af: null, remapId: 0 }],
      },
      {
        pos: '6',
        name: 'PA1 / PD6',
        type: 'io',
        tags: ['bonded', 'adc'],
        bondedNames: ['PA1', 'PD6'],
        signals: [{ peripheral: 'ADC1', signal: 'IN1', af: null, remapId: 0 }],
      },
    ],
    peripherals: {
      USART1: {
        kind: 'usart',
        signals: ['TX', 'RX'],
        remaps: [
          { id: 0, name: 'Default (RM0)', signals: { TX: 'PA9', RX: 'PA10' } },
          { id: 1, name: 'Partial Remap (RM1)', signals: { TX: 'PB6', RX: 'PB7' } },
        ],
      },
      SDI: { kind: 'sys', signals: ['SWDIO'] },
      ADC1: { kind: 'adc', signals: ['IN1'] },
    },
  };
}

/** Synthetic RP2350B funcsel-pio chip covering PWM wrap and GPIOBASE windows. */
function makeRpChip(): ChipData {
  return {
    id: 'RP2350BTEST',
    vendor: 'rp',
    muxModel: 'funcsel-pio',
    family: 'RP2350',
    core: 'Dual Cortex-M33',
    flashKb: 0,
    ramKb: 520,
    package: { name: 'QFN-80', kind: 'perimeter', pinCount: 9, sides: [3, 3, 3, 0] },
    pio: { instances: ['PIO0', 'PIO1', 'PIO2'], stateMachinesPerInstance: 4, gpioBaseOptions: [0, 16] },
    pins: [
      {
        pos: '1',
        name: 'GPIO0',
        type: 'io',
        signals: [
          { peripheral: 'PWM', signal: 'PWM0A', af: 4, funcLabel: 'F4', resourceId: 'PWM0A' },
          { peripheral: 'SPI0', signal: 'RX', af: 1, funcLabel: 'F1' },
        ],
      },
      {
        pos: '2',
        name: 'GPIO1',
        type: 'io',
        signals: [
          { peripheral: 'PWM', signal: 'PWM0B', af: 4, funcLabel: 'F4', resourceId: 'PWM0B' },
        ],
      },
      {
        pos: '3',
        name: 'GPIO16',
        type: 'io',
        signals: [
          { peripheral: 'PWM', signal: 'PWM0A', af: 4, funcLabel: 'F4', resourceId: 'PWM0A' },
        ],
      },
      {
        pos: '4',
        name: 'GPIO4',
        type: 'io',
        signals: [
          { peripheral: 'PWM', signal: 'PWM1A', af: 4, funcLabel: 'F4', resourceId: 'PWM1A' },
        ],
      },
      { pos: '5', name: 'GPIO12', type: 'io', tags: ['hstx'], signals: [] },
      { pos: '6', name: 'GPIO48', type: 'io', signals: [] },
      { pos: '7', name: 'GPIO20', type: 'io', signals: [] },
      { pos: '8', name: 'GPIO47', type: 'io', signals: [] },
      { pos: '9', name: 'GPIO31', type: 'io', signals: [] },
    ],
    peripherals: {
      PWM: { kind: 'pwm', signals: ['PWM0A', 'PWM0B', 'PWM1A'] },
      SPI0: { kind: 'spi', signals: ['RX', 'TX'] },
      PIO0: { kind: 'pio', signals: ['PIO'] },
    },
  };
}

function withAssignments(
  chip: ChipData,
  assignments: WorkspaceState['assignments'],
): WorkspaceState {
  const state = createEmptyWorkspace(chip.id);
  state.assignments = assignments;
  return state;
}

describe('CH32 coupled remap groups', () => {
  it('moves every signal of a remap group atomically', () => {
    const chip = makeCh32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 },
      '2': { peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 },
    });
    state.labels['1'] = 'DBG_TX';

    const result = applyRemapGroup(chip, state, 'USART1', 1);
    expect(result.applied).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.state.assignments['1']).toBeUndefined();
    expect(result.state.assignments['2']).toBeUndefined();
    expect(result.state.assignments['3']).toEqual({
      peripheral: 'USART1',
      signal: 'TX',
      af: null,
      funcLabel: 'RM1',
      remapId: 1,
    });
    expect(result.state.assignments['4']).toEqual({
      peripheral: 'USART1',
      signal: 'RX',
      af: null,
      funcLabel: 'RM1',
      remapId: 1,
    });
    expect(result.state.labels['3']).toBe('DBG_TX');
    expect(result.state.activeRemaps?.USART1).toBe(1);
  });

  it('blocks the whole move when a target pin is locked', () => {
    const chip = makeCh32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 },
      '2': { peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 },
    });
    state.locked['3'] = true;

    const before = structuredClone(state);
    const result = applyRemapGroup(chip, state, 'USART1', 1);
    expect(result.applied).toBe(false);
    expect(result.state).toEqual(before);
    const locked = result.diagnostics.find((d) => d.code === 'REMAP_LOCKED');
    expect(locked).toBeDefined();
    expect(locked?.pins).toContain('3');
    expect(locked?.message).toContain('PB6');
  });

  it('diagnoses an occupied remap target with both assignments named', () => {
    const chip = makeCh32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 },
      '2': { peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 },
      '3': { peripheral: 'GPIO', signal: 'Output', af: null },
    });

    const result = applyRemapGroup(chip, state, 'USART1', 1);
    expect(result.applied).toBe(false);
    const mismatch = result.diagnostics.find((d) => d.code === 'REMAP_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.pins).toEqual(expect.arrayContaining(['1', '3']));
    expect(mismatch?.message).toContain('GPIO_Output');

    state.activeRemaps = { USART1: 1 };
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'REMAP_MISMATCH')).toBe(true);
  });

  it('emits a group-move one-hop fix with all remap moves', () => {
    const chip = makeCh32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 },
      '2': { peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 },
    });
    // USART1 is incomplete, so the solver offers a one-hop fix for the missing signal.
    const fix: OneHopFix = {
      label: 'Switch USART1 (2 signals)',
      targetPeripheral: 'USART1',
      targetSignal: 'RX',
      targetAf: null,
      targetPos: '4',
      displacedFromPos: '2',
      displacedToPos: '4',
      displacedPeripheral: 'USART1',
      displacedSignal: 'RX',
      displacedAf: null,
      remapPeripheral: 'USART1',
      remapId: 1,
      remapMoves: [
        {
          signal: 'TX',
          fromPos: '1',
          toPos: '3',
          af: null,
          funcLabel: 'RM1',
          remapId: 1,
        },
        {
          signal: 'RX',
          fromPos: '2',
          toPos: '4',
          af: null,
          funcLabel: 'RM1',
          remapId: 1,
        },
      ],
    };
    const next = applyOneHopFix(state, fix);
    expect(next.assignments['1']).toBeUndefined();
    expect(next.assignments['2']).toBeUndefined();
    expect(next.assignments['3']?.funcLabel).toBe('RM1');
    expect(next.assignments['4']?.remapId).toBe(1);
    expect(next.activeRemaps?.USART1).toBe(1);
  });

  it('reports alternates with mux labels and preserves fields when moving them', () => {
    const chip = makeCh32Chip();
    const source: WorkspaceState['assignments'] = {
      '1': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 },
    };
    const state = withAssignments(chip, source);
    const alternates = findAlternatePins(chip, state, '1');
    expect(alternates.length).toBe(1);
    expect(alternates[0].pos).toBe('3');
    expect(alternates[0].funcLabel).toBe('RM1');
    expect(alternates[0].remapId).toBe(1);

    const moved = remapPinAssignment(chip, state, '1', '3');
    expect(moved.assignments['3']).toEqual({
      peripheral: 'USART1',
      signal: 'TX',
      af: null,
      remapId: 1,
      funcLabel: 'RM1',
    });
    expect(moved.activeRemaps?.USART1).toBe(1);
  });

  it('emits debug-sdi and bonded-pin diagnostics from tags', () => {
    const chip = makeCh32Chip();
    const state = withAssignments(chip, {
      '5': { peripheral: 'GPIO', signal: 'Output', af: null },
      '6': { peripheral: 'GPIO', signal: 'Output', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'DEBUG_PIN_REPURPOSED')).toBe(true);
    const bonded = report.diagnostics.find((d) => d.code === 'BONDED_PIN_NOTE');
    expect(bonded?.severity).toBe('info');
    expect(bonded?.message).toContain('PD6');
    expect(report.infoCount).toBeGreaterThanOrEqual(1);

    const debugUsed = withAssignments(chip, {
      '5': { peripheral: 'SDI', signal: 'SWDIO', af: null },
    });
    expect(
      evaluateWorkspace(chip, debugUsed).diagnostics.some(
        (d) => d.code === 'DEBUG_PIN_REPURPOSED',
      ),
    ).toBe(false);
  });
});

describe('RP shared resources, PIO and GPIOBASE windows', () => {
  it('flags PWM slice wrap as a resource conflict on both pins', () => {
    const chip = makeRpChip();
    const state = withAssignments(chip, {
      '1': {
        peripheral: 'PWM',
        signal: 'PWM0A',
        af: 4,
        funcLabel: 'F4',
        resourceId: 'PWM0A',
      },
      '3': {
        peripheral: 'PWM',
        signal: 'PWM0A',
        af: 4,
        funcLabel: 'F4',
        resourceId: 'PWM0A',
      },
    });
    const report = evaluateWorkspace(chip, state);
    const conflict = report.diagnostics.find((d) => d.code === 'RESOURCE_CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict?.pins).toEqual(expect.arrayContaining(['1', '3']));
    expect(conflict?.message).toContain('PWM0A');
    expect(report.pinStatus['1']).toBe('conflict');
    expect(report.pinStatus['3']).toBe('conflict');

    const distinct = withAssignments(chip, {
      '1': { peripheral: 'PWM', signal: 'PWM0A', af: 4, resourceId: 'PWM0A' },
      '4': { peripheral: 'PWM', signal: 'PWM1A', af: 4, resourceId: 'PWM1A' },
    });
    expect(
      evaluateWorkspace(chip, distinct).diagnostics.some((d) => d.code === 'RESOURCE_CONFLICT'),
    ).toBe(false);
  });

  it('accepts both GPIO0 and GPIO16 windows and rejects pins outside them', () => {
    const chip = makeRpChip();
    const state = withAssignments(chip, {});
    state.pioAssignments = {
      '1': { instance: 'PIO0', sm: 0 },
      '7': { instance: 'PIO0', sm: 1 },
      '8': { instance: 'PIO1', sm: 0 },
      '9': { instance: 'PIO1', sm: 1 },
    };
    expect(
      evaluateWorkspace(chip, state).diagnostics.some(
        (d) => d.code === 'PIO_GPIOBASE_CONFLICT',
      ),
    ).toBe(false);

    state.pioAssignments['6'] = { instance: 'PIO2', sm: 0 };
    const report = evaluateWorkspace(chip, state);
    const conflict = report.diagnostics.find((d) => d.code === 'PIO_GPIOBASE_CONFLICT');
    expect(conflict?.pins).toContain('6');
    expect(conflict?.message).toContain('GPIO48');
    expect(report.pinStatus['6']).toBe('conflict');
  });

  it('treats overlapping PIO state-machine reservations as a resource conflict', () => {
    const chip = makeRpChip();
    const state = withAssignments(chip, {});
    state.pioAssignments = {
      '1': { instance: 'PIO0', sm: 0 },
      '3': { instance: 'PIO0', sm: 0 },
    };
    const report = evaluateWorkspace(chip, state);
    const conflict = report.diagnostics.find(
      (d) => d.code === 'RESOURCE_CONFLICT' && d.message.includes('PIO0:SM0'),
    );
    expect(conflict?.pins).toEqual(expect.arrayContaining(['1', '3']));
    expect(report.pinStatus['1']).toBe('conflict');
    expect(report.pinStatus['3']).toBe('conflict');
  });

  it('reports HSTX hints as info and preserves RP mux fields on alternate moves', () => {
    const chip = makeRpChip();
    const state = withAssignments(chip, {
      '1': {
        peripheral: 'PWM',
        signal: 'PWM0A',
        af: 4,
        funcLabel: 'F4',
        resourceId: 'PWM0A',
      },
      '5': { peripheral: 'GPIO', signal: 'Output', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    const hint = report.diagnostics.find((d) => d.code === 'RP_HARDWARE_HINT');
    expect(hint?.severity).toBe('info');
    expect(hint?.message).toContain('HSTX');
    expect(report.infoCount).toBe(1);

    const alternates = findAlternatePins(chip, state, '1');
    expect(alternates.length).toBe(1);
    expect(alternates[0].pos).toBe('3');
    expect(alternates[0].funcLabel).toBe('F4');
    expect(alternates[0].resourceId).toBe('PWM0A');

    const moved = remapPinAssignment(chip, state, '1', '3');
    expect(moved.assignments['3']).toEqual({
      peripheral: 'PWM',
      signal: 'PWM0A',
      af: 4,
      funcLabel: 'F4',
      resourceId: 'PWM0A',
    });
  });

  it('carries mux metadata through a one-hop fix built from pin signals', () => {
    const chip = makeRpChip();
    const state = withAssignments(chip, {
      '1': {
        peripheral: 'PWM',
        signal: 'PWM0A',
        af: 4,
        funcLabel: 'F4',
        resourceId: 'PWM0A',
      },
    });
    const fix = findOneHopFixForSignal(chip, state, 'SPI0', 'RX');
    expect(fix).not.toBeNull();
    expect(fix?.targetMetadata).toEqual({ funcLabel: 'F1' });
    expect(fix?.displacedMetadata).toEqual({ funcLabel: 'F4', resourceId: 'PWM0A' });

    const fixed = applyOneHopFix(state, fix!);
    expect(fixed.assignments['1']).toMatchObject({
      peripheral: 'SPI0',
      signal: 'RX',
      af: 1,
      funcLabel: 'F1',
    });
    expect(fixed.assignments['3']).toMatchObject({
      peripheral: 'PWM',
      signal: 'PWM0A',
      funcLabel: 'F4',
      resourceId: 'PWM0A',
    });
  });
});
