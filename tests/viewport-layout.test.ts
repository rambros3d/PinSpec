import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { clampOverlayPosition } from '../src/core/overlay-position';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { cloneWorkspaceState, createWorkspaceHistory, statesEqual } from '../src/core/history';
import { createEmptyWorkspace } from '../src/core/solver';
import { normalizeDockTab, type ChipData, type WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const chip: ChipData = {
  id: 'STM32G431CBU6',
  family: 'STM32G4',
  core: 'Cortex-M4',
  flashKb: 128,
  ramKb: 32,
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    { pos: '15', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
    { pos: '16', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
    { pos: '1', name: 'VBAT', type: 'power', signals: [] },
  ],
  peripherals: { SPI1: { kind: 'spi', signals: ['SCK', 'MISO'] } },
};

const dockState: WorkspaceState = {
  ...createEmptyWorkspace(chip.id),
  assignments: { '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 } },
  labels: { '15': 'CLK' },
  locked: { '15': true },
  peripheralModes: { SPI1: 'full_duplex' },
  dockTab: 'diagnostics',
};

describe('document viewport lock', () => {
  it('locks the document and the application root', () => {
    const css = readSource('src/app.css');
    const htmlBlock = css.match(/html,\s*body\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const appBlock = css.match(/#app\s*\{[\s\S]*?\}/)?.[0] ?? '';
    for (const block of [htmlBlock, appBlock]) {
      expect(block).toContain('height: 100%');
      expect(block).toContain('overflow: hidden');
      expect(block).toContain('overscroll-behavior: none');
    }
    for (const name of ['lofi', 'forest', 'caramellatte', 'halloween']) {
      expect(readSource('src/themes/daisyui.css')).toContain(`[data-theme="${name}"]`);
    }
    expect(css).toContain("@import './themes/daisyui.css'");
  });

  it('sizes the workspace root to dvh without viewport-unit legacy classes', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('h-[100dvh]');
    expect(page).toContain('w-full');
    expect(page).not.toContain('h-screen');
    expect(page).not.toContain('w-screen');
    const css = readSource('src/app.css');
    expect(css.match(/\.workspace-root\s*\{[\s\S]*?\}/)?.[0]).toContain('height: 100dvh');
  });
});

describe('orientation-driven grid layout', () => {
  it('uses one grid with named areas and a single portrait media query', () => {
    const css = readSource('src/app.css');
    const rootBlock = css.match(/\.workspace-root\s*\{[\s\S]*?\}/)?.[0] ?? '';
    for (const area of ['toolbar', 'banner', 'peripherals', 'leftresizer', 'canvas', 'rightresizer', 'summary']) {
      expect(rootBlock, area).toContain(area);
    }
    expect(css.match(/@media \(orientation: portrait\)/g)?.length).toBe(1);
    expect(css.match(/grid-template-areas:/g)?.length).toBe(2);
    expect(css).toContain("'dock-tabs'");
    expect(css).toContain("'dock'");
    expect(css).toContain('43dvh');
  });

  it('repositions single mounts and selects layout without JavaScript', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    for (const component of ['PeripheralTree', 'PackageCanvas', 'SummaryDrawer']) {
      expect(page.match(new RegExp(`<${component}\\b`, 'g'))?.length, component).toBe(1);
      expect(page).toContain(`workspace-${component === 'PeripheralTree' ? 'peripherals' : component === 'PackageCanvas' ? 'canvas' : 'summary'}`);
    }
    expect(page.match(/data-dock-tab=/g)?.length).toBe(1);
    for (const tab of ['Peripherals', 'Pins', 'Diagnostics', 'DMA', 'PIO']) {
      expect(page, tab).toContain(tab);
    }
    expect(page).not.toContain('matchMedia');
    expect(page).not.toContain("addEventListener('resize'");
    expect(page).not.toContain('addEventListener("resize"');
    const css = readSource('src/app.css');
    for (const tab of ['peripherals', 'pins', 'diagnostics', 'dma', 'pio']) {
      expect(css, tab).toContain(`[data-dock-tab='${tab}']`);
    }
    expect(css).toMatch(/\.workspace-summary \.summary-tab-strip \{\s*display: none/);
  });

  it('propagates minimum sizes through scrolling panes', () => {
    const css = readSource('src/app.css');
    for (const cell of ['workspace-peripherals', 'workspace-canvas', 'workspace-summary']) {
      const block = css.match(new RegExp(`\\.${cell}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? '';
      expect(block, cell).toContain('min-height: 0');
      expect(block, cell).toContain('min-width: 0');
    }
    for (const component of ['PeripheralTree.svelte', 'SummaryDrawer.svelte']) {
      const source = readSource(`src/components/workspace/${component}`);
      expect(source, component).toContain('min-h-0');
      expect(source, component).toContain('overflow-y-auto');
    }
  });
});

describe('toolbar and modal viewport fit', () => {
  it('keeps the toolbar to one internally scrollable row', () => {
    const source = readSource('src/components/workspace/TopToolbar.svelte');
    expect(source).toContain('h-12 shrink-0');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('min-w-0');
    expect(source).toContain('truncate max-w-[11rem]');
    expect(source).toContain('hidden sm:inline font-bold');
  });

  it('caps every workspace dialog with dvh and internal scrolling', () => {
    const files = [
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/ExportModal.svelte',
      'src/components/workspace/BoardSelectorModal.svelte',
      'src/pages/WorkspacePage.svelte',
    ];
    for (const file of files) {
      const source = readSource(file);
      expect(source, file).toContain('92dvh');
      expect(source, file).toMatch(/min-h-0/);
    }
    expect(readSource('src/components/workspace/McuSwitcherModal.svelte')).toContain(
      'flex-1 min-h-0 overflow-y-auto',
    );
    expect(readSource('src/components/workspace/ExportModal.svelte')).toContain(
      'flex-1 min-h-0 overflow-auto',
    );
  });
});

describe('pure overlay clamping', () => {
  it('keeps an already-inside overlay unchanged', () => {
    expect(clampOverlayPosition(100, 120, 200, 100, 800, 600)).toEqual({ left: 100, top: 120 });
  });

  it('clamps right and bottom edges', () => {
    expect(clampOverlayPosition(780, 580, 200, 100, 800, 600)).toEqual({ left: 588, top: 488 });
    expect(clampOverlayPosition(900, 700, 200, 100, 800, 600)).toEqual({ left: 588, top: 488 });
  });

  it('clamps negative coordinates and a viewport smaller than the overlay', () => {
    expect(clampOverlayPosition(-20, -30, 200, 100, 800, 600)).toEqual({ left: 12, top: 12 });
    expect(clampOverlayPosition(4, 4, 500, 500, 320, 240)).toEqual({ left: 12, top: 12 });
  });

  it('falls back to the margin for non-finite input', () => {
    expect(clampOverlayPosition(Number.NaN, Number.POSITIVE_INFINITY, 0, 0, 800, 600)).toEqual({
      left: 12,
      top: 12,
    });
  });

  it('uses the shared helper for all three floating overlays', () => {
    const source = readSource('src/components/workspace/PackageCanvas.svelte');
    expect(source).toContain('clampOverlayPosition');
    expect(source).toContain('popoverPos');
    expect(source).toContain('contextMenuPos');
    expect(source).toContain('tooltipPos');
    expect(source).not.toContain('bottom sheet');
    expect(readSource('src/core/overlay-position.ts')).not.toMatch(
      /from ['"]svelte|window\.|document\./,
    );
  });
});

describe('dock tab persistence', () => {
  it('normalizes absent and unknown values to Peripherals', () => {
    expect(normalizeDockTab(undefined)).toBe('peripherals');
    expect(normalizeDockTab('invalid')).toBe('peripherals');
    expect(normalizeDockTab('pio')).toBe('pio');
    const absent = createEmptyWorkspace(chip.id);
    expect(absent.dockTab).toBeUndefined();
    expect(normalizeDockTab(absent.dockTab)).toBe('peripherals');
  });

  it('clones and compares dock tabs through history', () => {
    const cloned = cloneWorkspaceState(dockState);
    expect(cloned).toEqual(dockState);
    expect(cloned).not.toBe(dockState);
    expect(statesEqual(dockState, { ...dockState, dockTab: 'pio' })).toBe(false);
    expect(statesEqual(createEmptyWorkspace(chip.id), { ...createEmptyWorkspace(chip.id), dockTab: 'peripherals' })).toBe(true);

    const history = createWorkspaceHistory(createEmptyWorkspace(chip.id));
    expect(history.push(dockState)).toBe(true);
    expect(history.current.dockTab).toBe('diagnostics');
    expect(history.push({ ...dockState, dockTab: 'pio' })).toBe(true);
    expect(history.undo()?.dockTab).toBe('diagnostics');
    expect(history.redo()?.dockTab).toBe('pio');
  });

  it('round-trips the dock tab through URL and project JSON', () => {
    const decoded = decodeWorkspaceState(encodeWorkspaceState(dockState));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.dockTab).toBe('diagnostics');

    const parsed = parsePinoutJson(exportPinoutJson(dockState));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.dockTab).toBe('diagnostics');

    const absentDecoded = decodeWorkspaceState(encodeWorkspaceState(createEmptyWorkspace(chip.id)));
    expect(absentDecoded.ok).toBe(true);
    if (absentDecoded.ok) expect(absentDecoded.state.dockTab).toBeUndefined();
  });

  it('persists the dock tab in a localStorage session and preserves pin state', async () => {
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
    workspaceStore.assignPin('15', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
    workspaceStore.toggleLock('15');
    workspaceStore.setPeripheralMode('SPI1', 'full_duplex');
    const before = cloneWorkspaceState(workspaceStore.state);

    // Selecting a dock tab is layout-only: the rest of the workspace survives.
    workspaceStore.setDockTab('dma');
    expect(workspaceStore.dockTab).toBe('dma');
    const { dockTab: _ignored, ...withoutDock } = workspaceStore.state;
    expect(withoutDock).toEqual(before);
    workspaceStore.undo();
    expect(workspaceStore.dockTab).toBe('peripherals');
    expect(workspaceStore.state.assignments['15']).toEqual(before.assignments['15']);
    expect(workspaceStore.state.locked['15']).toBe(true);
    expect(workspaceStore.state.peripheralModes).toEqual(before.peripheralModes);
    workspaceStore.setDockTab('pio');

    const sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.dockTab).toBe('pio');
    vi.unstubAllGlobals();
  });
});
