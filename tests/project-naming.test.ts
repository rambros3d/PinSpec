import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceHistory, cloneWorkspaceState, statesEqual } from '../src/core/history';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import {
  generateProjectName,
  normalizeProjectName,
  PROJECT_NAME_WORDS,
} from '../src/core/project-name';
import { createEmptyWorkspace } from '../src/core/solver';
import type { ChipData, WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** RNG samples that select the first two curated words. */
function amberQuartzRng(): () => number {
  let index = 0;
  const samples = [0, 1 / PROJECT_NAME_WORDS.length];
  return () => samples[index++] ?? 0;
}

function makeChip(id: string, family?: string): ChipData {
  return {
    id,
    family: family ?? '',
    muxModel: 'af',
    core: 'Test core',
    flashKb: 128,
    ramKb: 32,
    package: { name: 'TSSOP20', kind: 'perimeter', pinCount: 2, sides: [1, 0, 1, 0] },
    pins: [],
    peripherals: {},
  };
}

function installStorage(records: Record<string, string> = {}): Map<string, string> {
  const storage = new Map(Object.entries(records));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  return storage;
}

/** Fresh store instances keep each test's history and recent sessions isolated. */
async function freshWorkspace() {
  vi.resetModules();
  const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
  const { catalogStore } = await import('../src/state/catalog.svelte.ts');
  return { workspaceStore, catalogStore };
}

describe('project title placement', () => {
  it('edits the shared name in the global bar title without persisting edit state', () => {
    const bar = fs.readFileSync(
      path.join(process.cwd(), 'src/components/shell/GlobalTopBar.svelte'),
      'utf8',
    );
    expect(bar).toContain("workspaceStore.state.projectName ?? 'Unnamed project'");
    expect(bar).toContain('aria-label="Rename project"');
    expect(bar).toContain('aria-label="Project name"');
    expect(bar).toContain('workspaceStore.renameProject(nameDraft)');
    expect(bar).toContain('onblur={commitName}');
    expect(bar).toContain('e.stopPropagation()');
    const store = fs.readFileSync(
      path.join(process.cwd(), 'src/state/workspace.svelte.ts'),
      'utf8',
    );
    expect(store).not.toContain('editingName');
    expect(store).not.toContain('nameDraft');
    const named: WorkspaceState = {
      ...createEmptyWorkspace('STM32G431CBU6'),
      projectName: 'amber-quartz-stm32h5',
    };
    const decoded = decodeWorkspaceState(encodeWorkspaceState(named));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.projectName).toBe('amber-quartz-stm32h5');
  });
});

describe('pure project-name generation', () => {
  it('composes exactly two curated words without a family suffix', () => {
    expect(generateProjectName(makeChip('STM32H503CBT6', 'STM32H5'), amberQuartzRng())).toBe(
      'amber-quartz',
    );
  });

  it('is deterministic for the same injected RNG sequence', () => {
    const chip = makeChip('STM32H503CBT6', 'STM32H5');
    expect(generateProjectName(chip, amberQuartzRng())).toBe(
      generateProjectName(chip, amberQuartzRng()),
    );
  });

  it('does not read the MCU identifier when no family is present', () => {
    expect(generateProjectName(makeChip('RP2040'), amberQuartzRng())).toBe('amber-quartz');
  });

  it('bounds characters and length for odd identifiers', () => {
    const chip = makeChip('WEIRD___PART/NAME!!', 'A Very Long Family Name With Spaces');
    const name = generateProjectName(chip, () => 0.5);
    expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(name.length).toBeLessThanOrEqual(48);
    expect(name).not.toContain('_');
    expect(name).not.toContain(' ');
  });

  it('ignores chip family and MCU identifiers for every vendor', () => {
    const chips = [
      makeChip('STM32G431CBU6', 'STM32G4'),
      makeChip('CH32V003F4P6', 'CH32V003'),
      makeChip('RP2040', ''),
      makeChip('ESP32-C3FH4', 'ESP32-C3'),
      makeChip('ATSAMD21G18A', 'SAM D21'),
      makeChip('nRF52840-QIAA', 'nRF52'),
    ];
    for (const chip of chips) {
      expect(generateProjectName(chip, amberQuartzRng())).toBe('amber-quartz');
    }
  });

  it('normalizes raw names without throwing', () => {
    expect(normalizeProjectName('  My New! Project__  ')).toBe('my-new-project');
    expect(normalizeProjectName('---')).toBeUndefined();
    expect(normalizeProjectName('')).toBeUndefined();
    expect(normalizeProjectName(null)).toBeUndefined();
    expect(normalizeProjectName(7)).toBeUndefined();
    expect(normalizeProjectName('a'.repeat(80))).toHaveLength(48);
  });
});

describe('shareable project-name state', () => {
  it('clones and compares the optional name so renames are undoable', () => {
    const original = createEmptyWorkspace('STM32G431CBU6');
    const renamed: WorkspaceState = { ...cloneWorkspaceState(original), projectName: 'new-name' };
    expect(cloneWorkspaceState(renamed).projectName).toBe('new-name');
    expect(statesEqual(original, renamed)).toBe(false);

    const history = createWorkspaceHistory(original);
    expect(history.push(renamed)).toBe(true);
    expect(history.undo()?.projectName).toBeUndefined();
    expect(history.redo()?.projectName).toBe('new-name');
  });

  it('round-trips through a version-2 share link and ignores malformed names', () => {
    const named: WorkspaceState = {
      ...createEmptyWorkspace('STM32G431CBU6'),
      projectName: 'amber-quartz-stm32h5',
    };
    const encoded = encodeWorkspaceState(named);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.projectName).toBe('amber-quartz-stm32h5');

    const plain = decodeWorkspaceState(encodeWorkspaceState(createEmptyWorkspace('STM32G431CBU6')));
    expect(plain.ok).toBe(true);
    if (plain.ok) expect(plain.state.projectName).toBeUndefined();
    expect(encodeWorkspaceState({ ...named, projectName: '   ' })).toBe(
      encodeWorkspaceState(createEmptyWorkspace('STM32G431CBU6')),
    );
  });

  it('round-trips through a version-2 project file without changing the schema version', () => {
    const named: WorkspaceState = {
      ...createEmptyWorkspace('STM32G431CBU6'),
      projectName: 'amber-quartz-stm32h5',
    };
    const file = exportPinoutJson(named, 'stm32');
    const parsed = JSON.parse(file) as Record<string, unknown>;
    expect(parsed.version).toBe(2);
    expect(parsed.projectName).toBe('amber-quartz-stm32h5');
    const imported = parsePinoutJson(file);
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.state.projectName).toBe('amber-quartz-stm32h5');

    const unnamed = exportPinoutJson(createEmptyWorkspace('STM32G431CBU6'));
    expect(unnamed).not.toContain('projectName');
    expect(parsePinoutJson(unnamed).ok).toBe(true);
  });
});

describe('workspace store naming', () => {
  const chip = makeChip('STM32G431CBU6', 'STM32G4');

  it('generates a name only for a fresh MCU session', async () => {
    installStorage();
    const { workspaceStore, catalogStore } = await freshWorkspace();
    catalogStore.primeChip(chip);
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0).mockReturnValueOnce(1 / PROJECT_NAME_WORDS.length);

    await workspaceStore.openMcu(chip.id);
    expect(workspaceStore.state.projectName).toBe('amber-quartz');
    expect(workspaceStore.canUndo).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('reuses stored names from recent sessions, handoffs, share links and files', async () => {
    installStorage();
    const { workspaceStore, catalogStore } = await freshWorkspace();
    catalogStore.primeChip(chip);
    const saved: WorkspaceState = {
      ...createEmptyWorkspace(chip.id),
      projectName: 'saved-quartz-stm32g4',
    };

    workspaceStore.setPendingHandoff(saved);
    await workspaceStore.openMcu(chip.id);
    expect(workspaceStore.state.projectName).toBe('saved-quartz-stm32g4');

    const storage = installStorage({
      'pincraft:recent_sessions_v1': JSON.stringify([
        {
          mcuId: chip.id,
          packageName: chip.package.name,
          pinCount: chip.package.pinCount,
          assignedCount: 0,
          updatedAt: 1,
          state: saved,
        },
      ]),
    });
    const reopened = await freshWorkspace();
    reopened.catalogStore.primeChip(chip);
    await reopened.workspaceStore.openMcu(chip.id);
    expect(reopened.workspaceStore.state.projectName).toBe('saved-quartz-stm32g4');

    const encoded = encodeWorkspaceState(saved);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      const shared = await freshWorkspace();
      shared.catalogStore.primeChip(chip);
      await shared.workspaceStore.openMcu(chip.id, decoded.state);
      expect(shared.workspaceStore.state.projectName).toBe('saved-quartz-stm32g4');
    }

    const imported = parsePinoutJson(exportPinoutJson(saved));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      const fromFile = await freshWorkspace();
      fromFile.catalogStore.primeChip(chip);
      await fromFile.workspaceStore.openMcu(chip.id, imported.state);
      expect(fromFile.workspaceStore.state.projectName).toBe('saved-quartz-stm32g4');
    }
    expect(storage.has('pincraft:recent_sessions_v1')).toBe(true);
  });

  it('commits active renames through history and sanitizes the value', async () => {
    installStorage();
    const { workspaceStore, catalogStore } = await freshWorkspace();
    catalogStore.primeChip(chip);
    await workspaceStore.openMcu(chip.id);
    const generatedName = workspaceStore.state.projectName;

    workspaceStore.renameProject('  My New! Project  ');
    expect(workspaceStore.state.projectName).toBe('my-new-project');
    expect(workspaceStore.canUndo).toBe(true);
    workspaceStore.undo();
    expect(workspaceStore.state.projectName).toBe(generatedName);
    workspaceStore.redo();
    expect(workspaceStore.state.projectName).toBe('my-new-project');

    const recent = JSON.parse(
      window.localStorage.getItem('pincraft:recent_sessions_v1') ?? '[]',
    ) as Array<{ state: WorkspaceState }>;
    expect(recent[0].state.projectName).toBe('my-new-project');
  });

  it('renames an inactive saved session without changing the active chip', async () => {
    installStorage();
    const { workspaceStore, catalogStore } = await freshWorkspace();
    const other = makeChip('OTHERMCU', 'OTHERFAMILY');
    catalogStore.primeChip(chip);
    catalogStore.primeChip(other);
    await workspaceStore.openMcu(chip.id);
    const originalName = workspaceStore.state.projectName;

    workspaceStore.setPendingHandoff({ ...createEmptyWorkspace(other.id), projectName: 'old-name' });
    await workspaceStore.openMcu(other.id);
    workspaceStore.renameProject('New Saved Name!', chip.id);

    expect(workspaceStore.state.projectName).toBe('old-name');
    const saved = workspaceStore.recentSessions.find((s) => s.mcuId === chip.id);
    expect(saved?.state.projectName).toBe('new-saved-name');

    workspaceStore.renameProject('', chip.id);
    expect(
      workspaceStore.recentSessions.find((s) => s.mcuId === chip.id)?.state.projectName,
    ).toBeUndefined();
    expect(originalName).not.toBe('old-name');
  });
});
