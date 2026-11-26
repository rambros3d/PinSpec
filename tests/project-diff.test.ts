import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { assignmentsEqual, diffProjects, type ProjectSnapshot } from '../src/core/project-diff';
import type { WorkspaceState } from '../src/core/types';

const baseState: WorkspaceState = {
  mcuId: 'STM32G431CBU6',
  assignments: {
    '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    '16': { peripheral: 'SPI1', signal: 'MISO', af: 5 },
  },
  labels: { '16': 'DATA' },
  locked: { '15': true },
  peripheralModes: { SPI1: 'rx_only' },
};

const names: Record<string, string> = { '15': 'PA5', '16': 'PA6' };

function snapshot(state: WorkspaceState, mcuId = state.mcuId, pinNames = names): ProjectSnapshot {
  return { mcuId, state, pinNames };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('project diff core', () => {
  it('reports additions and removals for a same-chip comparison', () => {
    const next = clone(baseState);
    delete next.assignments['16'];
    delete next.labels['16'];
    next.assignments['17'] = { peripheral: 'SPI1', signal: 'MOSI', af: 5 };
    const diff = diffProjects(
      snapshot(baseState),
      snapshot(next, next.mcuId, { ...names, '17': 'PA7' }),
    );
    expect(diff.changes.map((change) => [change.kind, change.pinName])).toEqual([
      ['removed', 'PA6'],
      ['added', 'PA7'],
    ]);
    expect(diff.markers.after['17']).toBe('added');
    expect(diff.markers.before['16']).toBe('removed');
  });

  it('matches cross-chip pins by name and reports a move', () => {
    const other = clone(baseState);
    other.mcuId = 'STM32F103C8T6';
    other.labels = {};
    other.assignments = {
      '33': { peripheral: 'SPI1', signal: 'SCK', af: 0 },
      '34': { peripheral: 'SPI1', signal: 'MISO', af: 0 },
    };
    const diff = diffProjects(
      snapshot(baseState),
      snapshot(other, other.mcuId, { '33': 'PA5', '34': 'PA6' }),
    );
    expect(diff.changes.map((change) => change.kind)).toEqual(['moved', 'moved']);
    expect(diff.changes[0]).toMatchObject({
      pinName: 'PA5',
      fromPos: '15',
      toPos: '33',
    });
    expect(diff.markers.before['15']).toBe('moved');
    expect(diff.markers.after['33']).toBe('moved');
  });

  it('classifies reassignment and relabeling at the same position', () => {
    const reassigned = clone(baseState);
    reassigned.assignments['15'] = { peripheral: 'USART1', signal: 'TX', af: 7 };
    const reassignedDiff = diffProjects(snapshot(baseState), snapshot(reassigned));
    expect(reassignedDiff.changes).toHaveLength(1);
    expect(reassignedDiff.changes[0]).toMatchObject({
      kind: 'reassigned',
      pos: '15',
      from: { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      to: { peripheral: 'USART1', signal: 'TX', af: 7 },
    });

    const relabeled = clone(baseState);
    relabeled.labels['16'] = 'DATA_NEW';
    const relabeledDiff = diffProjects(snapshot(baseState), snapshot(relabeled));
    expect(relabeledDiff.changes).toHaveLength(1);
    expect(relabeledDiff.changes[0]).toMatchObject({
      kind: 'relabeled',
      pos: '16',
      fromLabel: 'DATA',
      toLabel: 'DATA_NEW',
    });
    expect(assignmentsEqual(relabeled.assignments['16'], baseState.assignments['16'])).toBe(true);
  });

  it('is deterministic and does not mutate either input', () => {
    const before = snapshot(clone(baseState));
    const after = snapshot(clone(baseState), baseState.mcuId, { ...names, '17': 'PA7' });
    after.state.assignments['17'] = { peripheral: 'GPIO', signal: 'Output', af: null };
    const beforeCopy = clone(before);
    const afterCopy = clone(after);
    const first = diffProjects(before, after);
    const second = diffProjects(before, after);
    expect(first).toEqual(second);
    expect(before).toEqual(beforeCopy);
    expect(after).toEqual(afterCopy);
  });
});

describe('project file validation for the diff modal', () => {
  it('rejects malformed JSON, a missing MCU identifier and an unsupported version', () => {
    expect(parsePinoutJson('{ not json').ok).toBe(false);
    expect(parsePinoutJson(JSON.stringify({ version: 2, assignments: {} })).ok).toBe(false);
    expect(
      parsePinoutJson(JSON.stringify({ mcuId: 'STM32G431CBU6', version: 1 })).ok,
    ).toBe(false);
  });

  it('accepts a version-2 file exported from the current project schema', () => {
    const parsed = parsePinoutJson(exportPinoutJson(baseState));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(baseState);
  });
});

describe('diff modal source contract', () => {
  const source = (rel: string): string =>
    fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('wires the global bar and page without writing to the workspace store', () => {
    const bar = source('src/components/shell/WorkspaceTopBar.svelte');
    expect(bar).toContain('topBarUI.diffOpen = true');
    expect(bar).toContain('Compare project pinouts');
    const shell = source('src/components/shell/AppShell.svelte');
    expect(shell).toContain('<PinoutDiffModal');
    expect(shell).toContain("topBarUI.activeDialog === 'diff'");
    expect(shell).toContain('<PinoutDiffModal onClose={() => (topBarUI.diffOpen = false)} />');
    const page = source('src/pages/WorkspacePage.svelte');
    expect(page).not.toContain('PinoutDiffModal');
    const landing = source('src/pages/LandingPage.svelte');
    expect(landing).toContain('topBarUI.diffOpen = true');
    expect(landing).not.toContain('PinoutDiffModal');
  });

  it('uses two independent file slots with no workspace writes or KiCad output', () => {
    const modal = source('src/components/workspace/PinoutDiffModal.svelte');
    expect(modal).toContain('type="file"');
    expect(modal.match(/type="file"/g)?.length).toBe(2);
    expect(modal.match(/accept="\.json,application\/json"/g)?.length).toBe(2);
    expect(modal).not.toContain('accept=".json,.ioc,application/json"');
    expect(modal).toContain("'idle'");
    expect(modal).toContain("'loading'");
    expect(modal).toContain("'ready'");
    expect(modal).toContain("'error'");
    expect(modal).toContain('parsePinoutJson');
    expect(modal).toContain('unsupported-format');
    expect(modal).not.toContain('.kicad_sym');
    expect(modal).not.toContain('workspaceStore');
    expect(modal).not.toContain('onPinClick=');
    expect(modal).not.toContain('onPinContextMenu=');
    expect(modal).not.toContain('onPinHover=');
    expect(modal).not.toContain('highlightedPins=');
    expect(modal).toContain('PerimeterPackage');
    expect(modal).toContain('GridPackage');
    expect(modal).toContain('diff-marker');
  });
});
