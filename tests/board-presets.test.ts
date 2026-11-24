import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BOARD_PRESETS,
  buildBoardPresetState,
  findBoardPresets,
  getBoardPreset,
  resolveBoardPreset,
} from '../src/data/boards';
import type { CatalogIndexEntry, ChipData, WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const index = JSON.parse(
  readFileSync(new URL('../public/data/index.json', import.meta.url), 'utf8'),
) as CatalogIndexEntry[];

function loadChip(mcuId: string): ChipData {
  return JSON.parse(
    readFileSync(new URL(`../public/data/chips/${mcuId}.json`, import.meta.url), 'utf8'),
  ) as ChipData;
}

describe('board presets', () => {
  it('loads every preset, validates its MCU against the index and builds a version-2 state', () => {
    expect(BOARD_PRESETS.length).toBeGreaterThan(0);
    for (const preset of BOARD_PRESETS) {
      const resolved = resolveBoardPreset(preset, index);
      expect(resolved.ok, `${preset.board} must be in the catalog`).toBe(true);
      if (!resolved.ok) continue;

      const chip = loadChip(resolved.mcuId);
      const built = buildBoardPresetState(preset, chip);
      expect(built.ok, `${preset.board} must build a state`).toBe(true);
      if (!built.ok) continue;

      expect(built.state.mcuId).toBe(resolved.mcuId);
      expect(Object.keys(built.state.assignments).length).toBeGreaterThan(0);
      for (const [pos, assignment] of Object.entries(built.state.assignments)) {
        expect(chip.pins.some((pin) => pin.pos === pos)).toBe(true);
        expect(assignment.peripheral.length).toBeGreaterThan(0);
        expect(assignment.signal.length).toBeGreaterThan(0);
      }
      const decoded = decodeWorkspaceState(encodeWorkspaceState(built.state));
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.state).toEqual(built.state);
    }
  });

  it('applies the F411RE preset assignments and labels', () => {
    const preset = getBoardPreset('nucleo-f411re');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(findBoardPresets('STM32F411RET6')).toContain(preset);

    const chip = loadChip('STM32F411RET6');
    const built = buildBoardPresetState(preset, chip);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const state: WorkspaceState = built.state;
    const usartTx = chip.pins.find((pin) => pin.name === 'PA2');
    const button = chip.pins.find((pin) => pin.name === 'PC13-ANTI_TAMP');
    const led = chip.pins.find((pin) => pin.name === 'PA5');
    expect(usartTx).toBeDefined();
    expect(button).toBeDefined();
    expect(led).toBeDefined();
    if (!usartTx || !button || !led) return;

    expect(state.assignments[usartTx.pos]).toEqual({
      peripheral: 'USART2',
      signal: 'TX',
      af: 7,
    });
    expect(state.assignments[button.pos]?.signal).toBe('EXTI');
    expect(state.assignments[button.pos]?.resourceId).toBe('EXTI13');
    expect(state.labels[led.pos]).toBe('LD2 [Green Led]');
    expect(state.locked[usartTx.pos]).toBe(true);
  });

  it('reports an unavailable preset MCU without producing a state', () => {
    const preset = getBoardPreset('nucleo-f411re');
    expect(preset).toBeDefined();
    if (!preset) return;
    const missing = { ...preset, mcuId: 'STM32ZZZ999XX6' };
    const resolved = resolveBoardPreset(missing, index);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toContain('not in the catalog');
  });
});
