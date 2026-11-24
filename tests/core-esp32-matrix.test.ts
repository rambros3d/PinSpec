import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeMatrixChip } from './fixtures/esp32-matrix-chip';
import {
  MATRIX_ALTERNATE_LIMIT,
  allocatePeripheralMode,
  computePinScarcityScore,
  createEmptyWorkspace,
  evaluateWorkspace,
  findAlternatePins,
  findOneHopFixForSignal,
  pinSupportsSignal,
} from '../src/core/solver';
import type { ChipData, WorkspaceState } from '../src/core/types';

const ROOT = path.resolve(import.meta.dirname, '..');

function withAssignments(
  chip: ChipData,
  assignments: WorkspaceState['assignments'],
): WorkspaceState {
  const state = createEmptyWorkspace(chip.id);
  state.assignments = assignments;
  return state;
}

function signalCounts(chip: ChipData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pin of chip.pins) {
    const seen = new Set<string>();
    for (const sig of pin.signals) {
      const key = `${sig.peripheral}:${sig.signal}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Small AF chip for the existing-vendor non-regression assertions. */
function makeStm32Chip(): ChipData {
  return {
    id: 'AFTEST',
    vendor: 'stm32',
    muxModel: 'af',
    family: 'STM32G4',
    core: 'Cortex-M4',
    flashKb: 128,
    ramKb: 32,
    package: { name: 'UFQFPN32', kind: 'perimeter', pinCount: 4, sides: [1, 0, 1, 0] },
    pins: [
      {
        pos: '1',
        name: 'PA5',
        type: 'io',
        signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }],
      },
      {
        pos: '2',
        name: 'PA6',
        type: 'io',
        signals: [
          { peripheral: 'SPI1', signal: 'MISO', af: 5 },
          { peripheral: 'SPI1', signal: 'SCK', af: 5 },
        ],
      },
      {
        pos: '3',
        name: 'PA7',
        type: 'io',
        signals: [{ peripheral: 'SPI1', signal: 'MOSI', af: 5 }],
      },
      { pos: '4', name: 'VBAT', type: 'power', signals: [] },
    ],
    peripherals: { SPI1: { kind: 'spi', signals: ['SCK', 'MISO', 'MOSI'] } },
  };
}

describe('synthetic matrix fixtures', () => {
  it('exposes directions, electrical tags, and a declared route capacity', () => {
    const chip = makeMatrixChip();
    expect(chip.vendor).toBe('esp32');
    expect(chip.muxModel).toBe('gpio-matrix');
    expect(chip.matrixRouteCapacity).toBe(8);
    expect(chip.pins.find((p) => p.pos === '1')?.signals[0].direction).toBe('output');
    expect(chip.pins.find((p) => p.pos === '4')?.tags).toContain('input-only');
    expect(chip.pins.find((p) => p.pos === '9')?.tags).toContain('cap-restricted');
  });
});

describe('matrix route cardinality', () => {
  it('allows a matrix peripheral output to fan out to several GPIOs', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'U0TXD' },
      '2': { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'U0TXD' },
      '3': { peripheral: 'UART0', signal: 'TX', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'DUPLICATE_SIGNAL')).toBe(false);
    expect(report.pinStatus['1']).toBe('assigned');
    expect(report.pinStatus['2']).toBe('assigned');
    expect(report.pinStatus['3']).toBe('assigned');
  });

  it('keeps a single source for matrix peripheral inputs', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '4': { peripheral: 'UART0', signal: 'RX', af: null },
      '5': { peripheral: 'UART0', signal: 'RX', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    const duplicate = report.diagnostics.find((d) => d.code === 'DUPLICATE_SIGNAL');
    expect(duplicate).toBeDefined();
    expect(duplicate?.pins).toEqual(expect.arrayContaining(['4', '5']));
    expect(report.pinStatus['4']).toBe('conflict');
  });

  it('does not treat a GPIO input feeding several inputs as a driver conflict', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '4': { peripheral: 'UART0', signal: 'RX', af: null },
      '1': { peripheral: 'ADC2', signal: 'CH0', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.some((d) => d.code === 'RESOURCE_CONFLICT')).toBe(false);
    expect(report.diagnostics.some((d) => d.code === 'DUPLICATE_SIGNAL')).toBe(false);
  });

  it('rejects an input-only pin driven as a GPIO output', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '4': { peripheral: 'GPIO', signal: 'Output', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    const error = report.diagnostics.find((d) => d.code === 'INPUT_ONLY_OUTPUT');
    expect(error?.severity).toBe('error');
    expect(error?.pins).toEqual(['4']);
    expect(report.pinStatus['4']).toBe('conflict');
  });

  it('keeps the non-matrix duplicate error unchanged', () => {
    const chip = makeStm32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      '2': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    });
    const report = evaluateWorkspace(chip, state);
    const duplicate = report.diagnostics.find((d) => d.code === 'DUPLICATE_SIGNAL');
    expect(duplicate?.severity).toBe('error');
    expect(duplicate?.pins).toEqual(expect.arrayContaining(['1', '2']));
  });
});

describe('input-only capability gating', () => {
  it('rejects output roles but accepts input roles on an input-only pin', () => {
    const chip = makeMatrixChip();
    const pin = chip.pins.find((p) => p.pos === '4')!;
    expect(pinSupportsSignal(pin, 'SPI2', 'MOSI')).toBeNull();
    expect(pinSupportsSignal(pin, 'GPIO', 'Output')).toBeNull();
    expect(pinSupportsSignal(pin, 'UART0', 'RX')).not.toBeNull();
    expect(pinSupportsSignal(pin, 'GPIO', 'Input')).not.toBeNull();
  });

  it('excludes input-only pins from allocation and alternate discovery', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {});
    const allocated = allocatePeripheralMode(chip, state, 'SPI2', 'full_duplex');
    expect(allocated.state.assignments['4']).toBeUndefined();

    const source = withAssignments(chip, {
      '9': { peripheral: 'SPI2', signal: 'MOSI', af: null, funcLabel: 'SPI2_MOSI' },
    });
    const alternates = findAlternatePins(chip, source, '9');
    expect(alternates.some((a) => a.pos === '4')).toBe(false);
    expect(alternates.some((a) => a.pos === '11')).toBe(true);
  });

  it('excludes input-only pins from one-hop fixes', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '9': { peripheral: 'UNIQUE9', signal: 'X', af: null },
      '11': { peripheral: 'UNIQUE11', signal: 'X', af: null },
    });
    expect(findOneHopFixForSignal(chip, state, 'SPI2', 'MOSI')).toBeNull();
  });
});

describe('matrix diagnostics', () => {
  it('warns when a strapping pin is repurposed as an output driver', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '3': { peripheral: 'GPIO', signal: 'Output', af: null },
    });
    const report = evaluateWorkspace(chip, state);
    const warning = report.diagnostics.find((d) => d.code === 'STRAPPING_REPURPOSED');
    expect(warning?.severity).toBe('warning');
    expect(warning?.pins).toEqual(['3']);
    expect(warning?.message).toContain('GPIO2');
  });

  it('warns when ADC2 is used while Wi-Fi is enabled', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '6': { peripheral: 'ADC2', signal: 'CH1', af: null },
    });
    expect(
      evaluateWorkspace(chip, state).diagnostics.some((d) => d.code === 'ADC2_WIFI_CONFLICT'),
    ).toBe(false);
    state.peripheralModes.WIFI = 'sta';
    const report = evaluateWorkspace(chip, state);
    const warning = report.diagnostics.find((d) => d.code === 'ADC2_WIFI_CONFLICT');
    expect(warning?.severity).toBe('warning');
    expect(warning?.pins).toEqual(['6']);

    state.peripheralModes.WIFI = 'disabled';
    expect(
      evaluateWorkspace(chip, state).diagnostics.some((d) => d.code === 'ADC2_WIFI_CONFLICT'),
    ).toBe(false);
  });

  it('warns when declared matrix route capacity is exceeded', () => {
    const chip = makeMatrixChip();
    const assignments: WorkspaceState['assignments'] = {};
    for (const pos of ['1', '2', '3', '4', '5', '6', '7', '8', '11']) {
      assignments[pos] = { peripheral: 'UART0', signal: 'TX', af: null };
    }
    const report = evaluateWorkspace(chip, withAssignments(chip, assignments));
    const warning = report.diagnostics.find((d) => d.code === 'MATRIX_ROUTE_LIMIT');
    expect(warning?.severity).toBe('warning');
    expect(warning?.pins).toContain('11');
  });

  it('leaves existing vendor diagnostics and severities unchanged', () => {
    const chip = makeStm32Chip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      '2': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    });
    const report = evaluateWorkspace(chip, state);
    expect(report.diagnostics.map((d) => d.code)).toEqual(['DUPLICATE_SIGNAL']);
    expect(report.errorCount).toBe(1);
    expect(report.warningCount).toBe(0);
  });
});

describe('matrix scoring and bounded alternates', () => {
  it('prefers a direct IO_MUX route for a speed-critical signal', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {});
    const counts = signalCounts(chip);
    const direct = chip.pins.find((p) => p.pos === '10')!;
    const routed = chip.pins.find((p) => p.pos === '2')!;
    const directScore = computePinScarcityScore(direct, chip, state, counts, 'UART0');
    const routedScore = computePinScarcityScore(routed, chip, state, counts, 'UART0');
    expect(directScore).toBeLessThan(routedScore);
  });

  it('penalizes constrained candidates relative to equivalent ones', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {});
    const counts = signalCounts(chip);
    const strapping = chip.pins.find((p) => p.pos === '3')!;
    const plain = chip.pins.find((p) => p.pos === '2')!;
    expect(
      computePinScarcityScore(strapping, chip, state, counts, 'UART0'),
    ).toBeGreaterThan(computePinScarcityScore(plain, chip, state, counts, 'UART0'));

    const inputOnly = chip.pins.find((p) => p.pos === '4')!;
    const unrestricted = chip.pins.find((p) => p.pos === '11')!;
    expect(
      computePinScarcityScore(inputOnly, chip, state, counts, 'SPI2'),
    ).toBeGreaterThan(computePinScarcityScore(unrestricted, chip, state, counts, 'SPI2'));
  });

  it('keeps non-matrix scores byte-identical to the shared scoring path', () => {
    const chip = makeStm32Chip();
    const state = withAssignments(chip, {});
    const counts = signalCounts(chip);
    const pin = chip.pins[0];
    // Debug + clock preservation = 0; a scarce signal with two alternatives = 8;
    // one alternate-function tie-breaker = 0.5.
    expect(computePinScarcityScore(pin, chip, state, counts, 'GPIO')).toBe(8.5);
    expect(computePinScarcityScore(pin, chip, state, counts, 'SPI1')).toBe(0.5);
  });

  it('bounds matrix alternates after deterministic status and name sorting', () => {
    const chip = makeMatrixChip();
    const state = withAssignments(chip, {
      '1': { peripheral: 'UART0', signal: 'TX', af: null, funcLabel: 'U0TXD' },
    });
    const alternates = findAlternatePins(chip, state, '1');
    expect(alternates.length).toBe(MATRIX_ALTERNATE_LIMIT);
    expect(alternates.map((a) => a.pinName)).toEqual(
      [...alternates.map((a) => a.pinName)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    );
    expect(alternates[0].pinName).toBe('GPIO1');

    const nonMatrix = makeStm32Chip();
    const empty = withAssignments(nonMatrix, {});
    expect(findAlternatePins(nonMatrix, empty, '1')).toEqual([]);
    const assigned = withAssignments(nonMatrix, {
      '1': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    });
    expect(findAlternatePins(nonMatrix, assigned, '1')).toHaveLength(1);
    expect(findAlternatePins(nonMatrix, assigned, '1')[0].pinName).toBe('PA6');
  });
});

describe('pure core and unchanged version-2 codecs', () => {
  it('does not add matrix fields to the version-2 codec sources', () => {
    for (const file of ['url-state.ts', 'history.ts', path.join('exporters', 'json.ts')]) {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8');
      expect(source, file).not.toContain('gpio-matrix');
      expect(source, file).not.toContain('matrixRoute');
      expect(source, file).not.toContain('direction');
    }
  });

  it('imports the core in a host process without Svelte or DOM APIs', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'core', 'solver.ts'), 'utf8');
    expect(source).not.toMatch(/from 'svelte/);
    expect(source).not.toMatch(/document\./);
    expect(makeMatrixChip().pins.length).toBeGreaterThan(10);
  });
});
