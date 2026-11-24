import { describe, expect, it, vi } from 'vitest';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { cloneWorkspaceState, createWorkspaceHistory, statesEqual } from '../src/core/history';
import { createEmptyWorkspace } from '../src/core/solver';
import { normalizePackageRotation, type ChipData, type WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const chip: ChipData = {
  id: 'STM32G431CBU6',
  family: 'STM32G4',
  core: 'Cortex-M4',
  flashKb: 128,
  ramKb: 32,
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    { pos: '15', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
    { pos: '1', name: 'VBAT', type: 'power', signals: [] },
  ],
  peripherals: { SPI1: { kind: 'spi', signals: ['SCK'] } },
};

function rotatedState(): WorkspaceState {
  return { ...createEmptyWorkspace(chip.id), packageRotation: -90 };
}

describe('package rotation normalization', () => {
  it('accepts only -90 as a non-default value', () => {
    expect(normalizePackageRotation(-90)).toBe(-90);
    for (const value of [undefined, null, 0, 90, 180, 270, '-90', 'ccw', {}, []]) {
      expect(normalizePackageRotation(value)).toBe(0);
    }
  });
});

describe('package rotation in pure persistence paths', () => {
  it('clones byte-identically when absent and preserves -90', () => {
    const absent = createEmptyWorkspace(chip.id);
    const clonedAbsent = cloneWorkspaceState(absent);
    expect(clonedAbsent).toEqual(absent);
    expect(JSON.stringify(clonedAbsent)).toBe(JSON.stringify(absent));
    expect(clonedAbsent.packageRotation).toBeUndefined();

    const clonedRotated = cloneWorkspaceState(rotatedState());
    expect(clonedRotated.packageRotation).toBe(-90);
    expect(statesEqual(absent, { ...absent, packageRotation: 0 })).toBe(true);
    expect(statesEqual(absent, rotatedState())).toBe(false);
  });

  it('round-trips rotation through history', () => {
    const history = createWorkspaceHistory(createEmptyWorkspace(chip.id));
    expect(history.push(rotatedState())).toBe(true);
    expect(history.current.packageRotation).toBe(-90);
    expect(history.undo()?.packageRotation).toBeUndefined();
    expect(history.redo()?.packageRotation).toBe(-90);
  });

  it('round-trips rotation through a share link without changing absent payloads', () => {
    const decoded = decodeWorkspaceState(encodeWorkspaceState(rotatedState()));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.packageRotation).toBe(-90);

    const absentDecoded = decodeWorkspaceState(encodeWorkspaceState(createEmptyWorkspace(chip.id)));
    expect(absentDecoded.ok).toBe(true);
    if (absentDecoded.ok) expect(absentDecoded.state.packageRotation).toBeUndefined();
  });

  it('round-trips rotation through a version-2 project file without an absent field', () => {
    const raw = exportPinoutJson(rotatedState());
    expect(raw).toContain('"packageRotation": -90');
    const parsed = parsePinoutJson(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.packageRotation).toBe(-90);

    const absentRaw = exportPinoutJson(createEmptyWorkspace(chip.id));
    expect(absentRaw).not.toContain('packageRotation');
    const absentParsed = parsePinoutJson(absentRaw);
    expect(absentParsed.ok).toBe(true);
    if (absentParsed.ok) expect(absentParsed.state.packageRotation).toBeUndefined();
  });

  it('normalizes untrusted project-file values to the default', () => {
    const raw = exportPinoutJson({ ...createEmptyWorkspace(chip.id), packageRotation: 90 as never });
    const parsed = parsePinoutJson(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.packageRotation).toBeUndefined();
  });
});

describe('workspace rotation control', () => {
  it('toggles between two states as one undoable, pin-preserving change', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    catalogStore.primeChip(chip);
    await workspaceStore.openMcu(chip.id);

    expect(workspaceStore.rotation).toBe(0);
    workspaceStore.assignPin('15', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
    const before = cloneWorkspaceState(workspaceStore.state);

    workspaceStore.toggleRotation();
    expect(workspaceStore.rotation).toBe(-90);
    expect(workspaceStore.state.packageRotation).toBe(-90);
    const { packageRotation: _ignored, ...withoutRotation } = workspaceStore.state;
    expect(withoutRotation).toEqual(before);
    let sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.packageRotation).toBe(-90);

    workspaceStore.toggleRotation();
    expect(workspaceStore.rotation).toBe(0);
    expect(workspaceStore.state.packageRotation).toBeUndefined();
    workspaceStore.undo();
    expect(workspaceStore.rotation).toBe(-90);
    workspaceStore.redo();
    expect(workspaceStore.rotation).toBe(0);
    expect(workspaceStore.state.assignments['15']).toEqual(before.assignments['15']);

    sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.packageRotation).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
