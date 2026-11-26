import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PERIPHERAL_STATUS_VIEW,
  basePinStatus,
  isPowerPin,
  pinStatusTokens,
} from '../src/core/pin-view';
import type { ChipData, PinInfo } from '../src/core/types';

function pin(pos: string, type: PinInfo['type']): PinInfo {
  return { pos, name: `P${pos}`, type, signals: [] };
}

function chip(pins: PinInfo[]): ChipData {
  return {
    id: 'TEST',
    family: 'TEST',
    core: 'Cortex-M4',
    flashKb: 64,
    ramKb: 16,
    package: { name: 'TEST', kind: 'perimeter', pinCount: pins.length },
    pins,
    peripherals: {},
  };
}

describe('pure pin view helpers', () => {
  it('detects power, reset, and boot pins only', () => {
    expect(isPowerPin(pin('1', 'power'))).toBe(true);
    expect(isPowerPin(pin('2', 'reset'))).toBe(true);
    expect(isPowerPin(pin('3', 'boot'))).toBe(true);
    for (const type of ['io', 'nc', 'mono'] as const) {
      expect(isPowerPin(pin('4', type))).toBe(false);
    }
  });

  it('maps baseline status from assignments and fixed pin types', () => {
    const data = chip([
      pin('1', 'io'),
      pin('2', 'io'),
      pin('3', 'power'),
      pin('4', 'reset'),
      pin('5', 'boot'),
      pin('6', 'nc'),
    ]);
    expect(basePinStatus(data, { '1': { peripheral: 'GPIO', signal: 'Output', af: null } })).toEqual({
      '1': 'assigned',
      '2': 'unused',
      '3': 'power',
      '4': 'power',
      '5': 'power',
      '6': 'unused',
    });
  });

  it('returns the exact CSS-variable tokens for every status', () => {
    expect(pinStatusTokens('power')).toEqual({
      fill: 'var(--pin-power-fill)',
      stroke: 'var(--pin-power)',
      text: 'var(--pin-text)',
      tagBg: 'var(--pin-power-tag)',
    });
    expect(pinStatusTokens('assigned')).toEqual({
      fill: 'var(--pin-assigned-fill)',
      stroke: 'var(--pin-assigned)',
      text: 'var(--pin-text)',
      tagBg: 'var(--pin-assigned-tag)',
    });
    expect(pinStatusTokens('partial')).toEqual({
      fill: 'var(--pin-partial-fill)',
      stroke: 'var(--pin-partial)',
      text: 'var(--pin-text)',
      tagBg: 'var(--pin-partial-tag)',
    });
    expect(pinStatusTokens('conflict')).toEqual({
      fill: 'var(--pin-conflict-fill)',
      stroke: 'var(--pin-conflict)',
      text: 'var(--pin-text)',
      tagBg: 'var(--pin-conflict-tag)',
    });
    expect(pinStatusTokens('unused')).toEqual({
      fill: 'var(--pin-unused-fill)',
      stroke: 'var(--pin-unused)',
      text: 'currentColor',
      tagBg: 'transparent',
    });
  });

  it('lets remap source outrank highlight and highlight outrank status', () => {
    expect(pinStatusTokens('conflict', { selected: true, highlighted: true, remapSource: true })).toEqual({
      fill: 'var(--pin-selected-fill)',
      stroke: 'var(--pin-remap)',
      text: 'var(--pin-selected-text)',
      tagBg: 'var(--pin-remap-tag)',
    });
    expect(pinStatusTokens('conflict', { highlighted: true })).toEqual({
      fill: 'var(--pin-remap-fill)',
      stroke: 'var(--pin-remap)',
      text: 'var(--pin-text)',
      tagBg: 'var(--pin-remap-tag)',
    });
    for (const status of ['assigned', 'partial', 'unused'] as const) {
      expect(pinStatusTokens(status, { selected: true }).stroke).toBe('var(--pin-remap)');
    }
    expect(pinStatusTokens('power', { selected: true }).stroke).toBe('var(--pin-power)');
    expect(pinStatusTokens('conflict', { selected: true }).stroke).toBe('var(--pin-conflict)');
  });

  it('keeps the peripheral status tokens keyed by solver status', () => {
    expect(PERIPHERAL_STATUS_VIEW).toEqual({
      none: { color: 'bg-base-300', border: 'border-base-content/50', badge: 'badge-ghost', label: 'Unused' },
      partial: { color: 'bg-warning', border: 'border-warning', badge: 'badge-warning', label: 'Partial' },
      active: { color: 'bg-success', border: 'border-success', badge: 'badge-success', label: 'Active' },
      error: { color: 'bg-error', border: 'border-error', badge: 'badge-error', label: 'Conflict' },
    });
  });

  it('stays pure with no Svelte or DOM import', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/core/pin-view.ts'), 'utf8');
    expect(source).not.toMatch(/from 'svelte'|from 'node:|document\.|window\./);
  });
});
