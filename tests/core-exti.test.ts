import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace, deriveExtiLineId, evaluateWorkspace } from '../src/core/solver';
import type { ChipData, DiagnosticItem, PinInfo, WorkspaceState } from '../src/core/types';

const ROOT = process.cwd();

function ioPin(pos: string, name: string): PinInfo {
  return { pos, name, type: 'io', signals: [] };
}

function makeExtiChip(): ChipData {
  return {
    id: 'STM32EXTI',
    family: 'STM32G4',
    core: 'Cortex-M4',
    flashKb: 128,
    ramKb: 32,
    package: { name: 'LQFP48', kind: 'perimeter', pinCount: 8, sides: [2, 2, 2, 2] },
    pins: [
      { pos: '1', name: 'VDD', type: 'power', signals: [] },
      ioPin('2', 'PA0'),
      ioPin('3', 'PB0'),
      ioPin('4', 'PC0'),
      ioPin('5', 'PA1'),
      ioPin('6', 'PB1'),
      ioPin('7', 'PA13'),
      ioPin('8', 'PF0'),
    ],
    peripherals: {},
  };
}

function extiState(chip: ChipData, positions: string[]): WorkspaceState {
  const state = createEmptyWorkspace(chip.id);
  for (const pos of positions) {
    state.assignments[pos] = { peripheral: 'GPIO', signal: 'EXTI', af: null };
  }
  return state;
}

function extiDiagnostics(report: ReturnType<typeof evaluateWorkspace>): DiagnosticItem[] {
  return report.diagnostics.filter((d) => d.code === 'EXTI_LINE_CONFLICT');
}

describe('EXTI line derivation', () => {
  it('derives one line id for the same GPIO index across ports', () => {
    expect(deriveExtiLineId('PA0')).toBe('EXTI0');
    expect(deriveExtiLineId('PB0')).toBe('EXTI0');
    expect(deriveExtiLineId('PC0')).toBe('EXTI0');
    expect(deriveExtiLineId('PA13')).toBe('EXTI13');
  });

  it('returns no line for non-GPIO pins and uses the first pad of bonded names', () => {
    expect(deriveExtiLineId('VDD')).toBeNull();
    expect(deriveExtiLineId('NRST')).toBeNull();
    expect(deriveExtiLineId('GPIO16')).toBeNull();
    expect(deriveExtiLineId('BOOT0')).toBeNull();
    expect(deriveExtiLineId('PA0 [PB0]')).toBe('EXTI0');
  });
});

describe('EXTI shared-line detection', () => {
  it('emits EXTI_LINE_CONFLICT naming and marking both pins', () => {
    const chip = makeExtiChip();
    const state = extiState(chip, ['2', '3']); // PA0, PB0 -> EXTI0
    const report = evaluateWorkspace(chip, state);

    const conflicts = extiDiagnostics(report);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].pins).toEqual(['2', '3']);
    expect(conflicts[0].message).toContain('EXTI0');
    expect(conflicts[0].message).toContain('PA0 (2)');
    expect(conflicts[0].message).toContain('PB0 (3)');
    expect(report.pinStatus['2']).toBe('conflict');
    expect(report.pinStatus['3']).toBe('conflict');
    expect(report.errorCount).toBe(1);
    expect(report.errorCount).toBe(report.diagnostics.filter((d) => d.severity === 'error').length);
  });

  it('allows distinct EXTI lines and reports all three pins on a shared line', () => {
    const chip = makeExtiChip();
    expect(extiDiagnostics(evaluateWorkspace(chip, extiState(chip, ['2', '5'])))).toEqual([]);
    expect(extiDiagnostics(evaluateWorkspace(chip, extiState(chip, ['2', '6'])))).toEqual([]);

    const report = evaluateWorkspace(chip, extiState(chip, ['2', '3', '4']));
    expect(extiDiagnostics(report)).toHaveLength(1);
    expect(extiDiagnostics(report)[0].pins).toEqual(['2', '3', '4']);
  });

  it('leaves the chip shard and stored state unchanged by evaluation', () => {
    const chip = makeExtiChip();
    const state = extiState(chip, ['2', '3']);
    const chipBefore = structuredClone(chip);
    const stateBefore = structuredClone(state);

    evaluateWorkspace(chip, state);

    expect(chip).toEqual(chipBefore);
    expect(state).toEqual(stateBefore);
    expect(state.assignments['2'].resourceId).toBeUndefined();
    expect(state.assignments['3'].resourceId).toBeUndefined();
  });

  it('does not derive lines for non-GPIO pins, non-EXTI assignments, or RP parts', () => {
    const chip = makeExtiChip();
    const invalid = createEmptyWorkspace(chip.id);
    invalid.assignments['1'] = { peripheral: 'GPIO', signal: 'EXTI', af: null };
    invalid.assignments['2'] = { peripheral: 'GPIO', signal: 'Output', af: null };
    const report = evaluateWorkspace(chip, invalid);
    expect(extiDiagnostics(report)).toEqual([]);
    expect(report.diagnostics.some((d) => d.code === 'INVALID_PIN_SIGNAL')).toBe(true);

    const rp: ChipData = { ...structuredClone(chip), id: 'RP2040', muxModel: 'funcsel-pio', vendor: 'rp' };
    const rpState = extiState(rp, ['2', '3']);
    expect(extiDiagnostics(evaluateWorkspace(rp, rpState))).toEqual([]);
  });

  it('keeps existing shared-resource diagnostics byte-equivalent', () => {
    const chip = makeExtiChip();
    const state = createEmptyWorkspace(chip.id);
    state.assignments['2'] = {
      peripheral: 'PWM',
      signal: 'PWM0A',
      af: 4,
      resourceId: 'PWM0A',
    };
    state.assignments['3'] = {
      peripheral: 'PWM',
      signal: 'PWM0A',
      af: 4,
      resourceId: 'PWM0A',
    };
    const report = evaluateWorkspace(chip, state);
    const conflicts = report.diagnostics.filter((d) => d.code === 'RESOURCE_CONFLICT');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].message).toBe(
      'Shared hardware resource PWM0A is activated by multiple pins: PA0 (2), PB0 (3).',
    );
    expect(extiDiagnostics(report)).toEqual([]);
  });

  it('does not re-derive an explicit resourceId on GPIO/EXTI assignments', () => {
    const chip = makeExtiChip();
    const state = extiState(chip, ['2', '3']);
    state.assignments['2'].resourceId = 'EXTI0';
    state.assignments['3'].resourceId = 'EXTI0';
    const report = evaluateWorkspace(chip, state);
    expect(extiDiagnostics(report)).toEqual([]);
    expect(report.diagnostics.filter((d) => d.code === 'RESOURCE_CONFLICT')).toHaveLength(1);
  });
});

describe('non-EXTI STM32 diagnostic regression', () => {
  it('leaves existing diagnostics unchanged when EXTI assignments are added', () => {
    const chip = makeExtiChip();
    chip.pins[6].signals.push({ peripheral: 'SYS', signal: 'SWDIO', af: 0 });
    chip.pins[7].signals.push({ peripheral: 'RCC', signal: 'OSC_IN', af: null });
    chip.peripherals.SYS = { kind: 'sys', signals: ['SWDIO'] };
    chip.peripherals.RCC = { kind: 'sys', signals: ['OSC_IN'] };

    const baselineState = createEmptyWorkspace(chip.id);
    baselineState.assignments['7'] = { peripheral: 'GPIO', signal: 'Output', af: null };
    baselineState.assignments['8'] = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
    const baseline = evaluateWorkspace(chip, baselineState).diagnostics;

    const withExti = structuredClone(baselineState);
    withExti.assignments['2'] = { peripheral: 'GPIO', signal: 'EXTI', af: null };
    withExti.assignments['5'] = { peripheral: 'GPIO', signal: 'EXTI', af: null }; // distinct lines
    const after = evaluateWorkspace(chip, withExti).diagnostics;

    expect(after.filter((d) => d.code !== 'EXTI_LINE_CONFLICT')).toEqual(baseline);
  });
});

describe('workspace EXTI line display', () => {
  it('uses the shared derivation helper in the owned display surfaces', () => {
    for (const site of [
      'src/components/workspace/PinPopover.svelte',
      'src/components/workspace/PinContextMenu.svelte',
      'src/components/workspace/SummaryDrawer.svelte',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, site), 'utf8');
      expect(source, site).toContain('deriveExtiLineId');
      expect(source, site).toContain('EXTI');
      expect(source, site).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});
