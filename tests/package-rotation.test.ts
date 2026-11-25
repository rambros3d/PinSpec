import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { cloneWorkspaceState, createWorkspaceHistory, statesEqual } from '../src/core/history';
import {
  PACKAGE_ROTATIONS,
  cycleRotationClockwise,
  displayedSide,
  isQuarterTurn,
  localLabelAngle,
  resolveTextAngle,
  type PackageSide,
} from '../src/core/package-rotation';
import { createEmptyWorkspace } from '../src/core/solver';
import {
  normalizePackageRotation,
  type ChipData,
  type PackageRotation,
  type WorkspaceState,
} from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';
import { stubCatalogChips } from './helpers/catalog-stub';

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

function rotatedState(rotation: PackageRotation): WorkspaceState {
  return { ...createEmptyWorkspace(chip.id), packageRotation: rotation };
}

const SIDES: readonly PackageSide[] = ['left', 'bottom', 'right', 'top'];

/** Expected displayed edge after k clockwise quarter turns from each source edge. */
const DISPLAYED_SIDE: Record<PackageRotation, Record<PackageSide, PackageSide>> = {
  0: { left: 'left', bottom: 'bottom', right: 'right', top: 'top' },
  90: { left: 'top', bottom: 'left', right: 'bottom', top: 'right' },
  180: { left: 'right', bottom: 'top', right: 'left', top: 'bottom' },
  270: { left: 'bottom', bottom: 'right', right: 'top', top: 'left' },
};

describe('package rotation normalization', () => {
  it('preserves all four clockwise values', () => {
    for (const value of PACKAGE_ROTATIONS) expect(normalizePackageRotation(value)).toBe(value);
  });

  it('rejects the former counter-clockwise value', () => {
    expect(normalizePackageRotation(-90)).toBe(0);
  });

  it('normalizes absent and untrusted values to zero', () => {
    for (const value of [
      undefined,
      null,
      -1,
      -90,
      -180,
      45,
      360,
      '-90',
      '90',
      'ccw',
      {},
      [],
      true,
      Number.NaN,
    ]) {
      expect(normalizePackageRotation(value)).toBe(0);
    }
  });
});

describe('pure package rotation geometry helpers', () => {
  it('cycles clockwise through four values and wraps to zero', () => {
    expect(cycleRotationClockwise(0)).toBe(90);
    expect(cycleRotationClockwise(90)).toBe(180);
    expect(cycleRotationClockwise(180)).toBe(270);
    expect(cycleRotationClockwise(270)).toBe(0);
    let value: PackageRotation = 0;
    const observed: PackageRotation[] = [];
    for (let i = 0; i < 4; i++) {
      value = cycleRotationClockwise(value);
      observed.push(value);
    }
    expect(observed).toEqual([90, 180, 270, 0]);
  });

  it('resolves the displayed edge for every source edge at every orientation', () => {
    for (const rotation of PACKAGE_ROTATIONS) {
      for (const side of SIDES) {
        expect(displayedSide(side, rotation), `${side} at ${rotation}`).toBe(
          DISPLAYED_SIDE[rotation][side],
        );
      }
    }
  });

  it('resolves horizontal text on side edges and vertical text on top and bottom edges', () => {
    expect(resolveTextAngle('left')).toBe(0);
    expect(resolveTextAngle('right')).toBe(0);
    expect(resolveTextAngle('top')).toBe(-90);
    expect(resolveTextAngle('bottom')).toBe(-90);
  });

  it('derives the local text angle from the displayed side without inverting text', () => {
    for (const rotation of PACKAGE_ROTATIONS) {
      for (const side of SIDES) {
        const shown = displayedSide(side, rotation);
        const resolvedAngle = resolveTextAngle(shown);
        expect(localLabelAngle(side, rotation), `${side} at ${rotation}`).toBe(
          resolvedAngle - rotation,
        );
        expect(rotation + localLabelAngle(side, rotation)).toBe(resolvedAngle);
        expect([0, -90]).toContain(rotation + localLabelAngle(side, rotation));
      }
    }
  });

  it('marks only quarter turns as extent-swapping', () => {
    expect(isQuarterTurn(0)).toBe(false);
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(180)).toBe(false);
    expect(isQuarterTurn(270)).toBe(true);
  });
});

describe('package rotation in pure persistence paths', () => {
  it('clones byte-identically when absent and preserves each clockwise value', () => {
    const absent = createEmptyWorkspace(chip.id);
    const clonedAbsent = cloneWorkspaceState(absent);
    expect(clonedAbsent).toEqual(absent);
    expect(JSON.stringify(clonedAbsent)).toBe(JSON.stringify(absent));
    expect(clonedAbsent.packageRotation).toBeUndefined();

    for (const rotation of [90, 180, 270] as const) {
      expect(cloneWorkspaceState(rotatedState(rotation)).packageRotation).toBe(rotation);
    }
    expect(cloneWorkspaceState(rotatedState(270)).packageRotation).toBe(270);
    expect(statesEqual(absent, { ...absent, packageRotation: 0 })).toBe(true);
    for (const rotation of [90, 180, 270] as const) {
      expect(statesEqual(absent, rotatedState(rotation))).toBe(false);
    }
  });

  it('round-trips every rotation through history', () => {
    for (const rotation of PACKAGE_ROTATIONS) {
      const history = createWorkspaceHistory(createEmptyWorkspace(chip.id));
      expect(history.push(rotatedState(rotation))).toBe(rotation !== 0);
      if (rotation !== 0) {
        expect(history.current.packageRotation).toBe(rotation);
        expect(history.undo()?.packageRotation).toBeUndefined();
        expect(history.redo()?.packageRotation).toBe(rotation);
      }
    }
    const legacy = createWorkspaceHistory(createEmptyWorkspace(chip.id));
    expect(legacy.push({ ...createEmptyWorkspace(chip.id), packageRotation: -90 as never })).toBe(
      false,
    );
    expect(legacy.current.packageRotation).toBeUndefined();
  });

  it('round-trips every rotation through a share link without changing absent payloads', () => {
    for (const rotation of PACKAGE_ROTATIONS) {
      const decoded = decodeWorkspaceState(encodeWorkspaceState(rotatedState(rotation)));
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        if (rotation === 0) expect(decoded.state.packageRotation).toBeUndefined();
        else expect(decoded.state.packageRotation).toBe(rotation);
      }
    }
    const legacy = decodeWorkspaceState(
      encodeWorkspaceState({ ...createEmptyWorkspace(chip.id), packageRotation: -90 as never }),
    );
    expect(legacy.ok).toBe(true);
    if (legacy.ok) expect(legacy.state.packageRotation).toBeUndefined();

    const absentDecoded = decodeWorkspaceState(encodeWorkspaceState(createEmptyWorkspace(chip.id)));
    expect(absentDecoded.ok).toBe(true);
    if (absentDecoded.ok) expect(absentDecoded.state.packageRotation).toBeUndefined();
  });

  it('round-trips every rotation through a version-2 project file', () => {
    for (const rotation of [90, 180, 270] as const) {
      const raw = exportPinoutJson(rotatedState(rotation));
      expect(raw).toContain(`"packageRotation": ${rotation}`);
      const parsed = parsePinoutJson(raw);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.state.packageRotation).toBe(rotation);
    }
    const legacyRaw = exportPinoutJson({
      ...createEmptyWorkspace(chip.id),
      packageRotation: -90 as never,
    });
    expect(legacyRaw).not.toContain('packageRotation');
    const legacyParsed = parsePinoutJson(legacyRaw);
    expect(legacyParsed.ok).toBe(true);
    if (legacyParsed.ok) expect(legacyParsed.state.packageRotation).toBeUndefined();

    const absentRaw = exportPinoutJson(createEmptyWorkspace(chip.id));
    expect(absentRaw).not.toContain('packageRotation');
    const absentParsed = parsePinoutJson(absentRaw);
    expect(absentParsed.ok).toBe(true);
    if (absentParsed.ok) expect(absentParsed.state.packageRotation).toBeUndefined();
  });

  it('normalizes untrusted project-file values to the default', () => {
    const raw = exportPinoutJson({ ...createEmptyWorkspace(chip.id), packageRotation: 45 as never });
    expect(raw).not.toContain('packageRotation');
    const parsed = parsePinoutJson(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.packageRotation).toBeUndefined();
  });
});

describe('module markings follow package rotation', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'workspace', 'PerimeterPackage.svelte'),
    'utf8',
  );

  it('keeps module marks inside the rotated geometry group', () => {
    const rotated = source.indexOf('<g transform={geometryTransform}>');
    const bodyEnd = source.indexOf('<!-- Perimeter Pins -->');
    const moduleBranch = source.indexOf('{#if isModule}');
    expect(rotated).toBeGreaterThan(-1);
    expect(moduleBranch).toBeGreaterThan(rotated);
    expect(moduleBranch).toBeLessThan(bodyEnd);
    expect(source).toContain('rotate(${centreLabelAngle}');
  });

  it('keeps the module name upright and leaves pin targets unchanged', () => {
    const nameMark = source.indexOf('{moduleName}');
    expect(nameMark).toBeGreaterThan(-1);
    const nameBlock = source.slice(nameMark - 700, nameMark);
    expect(nameBlock).toContain('centreLabelAngle');
    expect(nameBlock).toContain('pointer-events-none');
    expect(source).toContain('data-pin-pos={item.pin.pos}');
    expect(source).toContain('onPinHover?.(item.pin, e)');
  });
});

describe('workspace rotation control', () => {
  it('cycles four times clockwise as one undoable, pin-preserving change per step', async () => {
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
    stubCatalogChips(catalogStore, chip);
    await workspaceStore.openMcu(chip.id);

    expect(workspaceStore.rotation).toBe(0);
    workspaceStore.assignPin('15', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
    const before = cloneWorkspaceState(workspaceStore.state);

    const readSessions = (): Array<{ state: WorkspaceState }> =>
      JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
        state: WorkspaceState;
      }>;

    for (const expected of [90, 180, 270] as const) {
      workspaceStore.toggleRotation();
      expect(workspaceStore.rotation).toBe(expected);
      expect(workspaceStore.state.packageRotation).toBe(expected);
      const { packageRotation: _ignored, ...withoutRotation } = workspaceStore.state;
      expect(withoutRotation).toEqual(before);
      expect(readSessions()[0].state.packageRotation).toBe(expected);
    }

    workspaceStore.toggleRotation();
    expect(workspaceStore.rotation).toBe(0);
    expect(workspaceStore.state.packageRotation).toBeUndefined();
    expect(cloneWorkspaceState(workspaceStore.state)).toEqual(before);
    expect(readSessions()[0].state.packageRotation).toBeUndefined();

    workspaceStore.undo();
    expect(workspaceStore.rotation).toBe(270);
    workspaceStore.redo();
    expect(workspaceStore.rotation).toBe(0);
    expect(workspaceStore.state.assignments['15']).toEqual(before.assignments['15']);
    vi.unstubAllGlobals();
  });
});

describe('name pill keeps the workspace bar contract', () => {
  it('stays within the 48px overflow-scrolling bar with token-based icons', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/shell/GlobalTopBar.svelte'),
      'utf8',
    );
    expect(source).toContain('global-top-bar h-12 shrink-0');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('min-w-0');
    expect(source).toContain('aria-label="Project name"');
    expect(source).toContain('<Pencil class="size-3 shrink-0" />');
    expect(source).toContain("@solar-icons/svelte/bold-duotone/pen");
    expect(source).not.toContain('lucide-svelte');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    expect(source).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
