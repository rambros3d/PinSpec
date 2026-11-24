import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
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

const pinConfigState: WorkspaceState = {
  ...createEmptyWorkspace(chip.id),
  assignments: { '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 } },
  labels: { '15': 'CLK' },
  locked: { '15': true },
  peripheralModes: { SPI1: 'full_duplex' },
};

/** Build a legacy compact payload that still carries a dock tab value. */
function encodeLegacyUrlPayload(payload: Record<string, unknown>): string {
  const deflated = deflateSync(strToU8(JSON.stringify(payload)), { level: 9 });
  return Buffer.from(deflated)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a share payload's compact JSON keys without importing app codec internals. */
function urlPayloadKeys(encoded: string): string[] {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = new Uint8Array(Buffer.from(normalized, 'base64'));
  const raw = strFromU8(inflateSync(bytes));
  return Object.keys(JSON.parse(raw) as Record<string, unknown>);
}

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
    const themes = readSource('src/themes/daisyui.css');
    for (const name of ['fantasy', 'halloween']) {
      expect(themes).toContain(`[data-theme="${name}"]`);
    }
    for (const removed of ['lofi', 'forest', 'caramellatte']) {
      expect(themes).not.toContain(removed);
    }
    expect(css).toContain("@import './themes/daisyui.css'");
  });

  it('scrolls landing content inside a landing-only shell', () => {
    const css = readSource('src/app.css');
    const block = css.match(/\.landing-shell\s*\{[\s\S]*?\}/)?.[0] ?? '';
    for (const declaration of [
      'height: 100dvh',
      'overflow-y: auto',
      'overscroll-behavior: contain',
      'scroll-padding-top: 3.5rem',
    ]) {
      expect(block, declaration).toContain(declaration);
    }
    const page = readSource('src/pages/LandingPage.svelte');
    expect(page).toContain('class="landing-shell flex flex-col bg-base-200 text-foreground"');
    expect(page).not.toContain('min-h-screen');
    expect(page).toContain('navbar sticky top-0');
    expect(page).toContain('href="#presets"');
    expect(page).toContain('id="export-preview"');
    expect(page).toContain('id="provenance"');
    expect(readSource('src/components/landing/PresetGrid.svelte')).toContain('id="presets"');
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
    for (const component of ['CombinedSidebar', 'PackageCanvas', 'SummaryDrawer']) {
      expect(page.match(new RegExp(`<${component}\\b`, 'g'))?.length, component).toBe(1);
      expect(page).toContain(`workspace-${component === 'CombinedSidebar' ? 'peripherals' : component === 'PackageCanvas' ? 'canvas' : 'summary'}`);
    }
    expect(page.match(/data-dock-tab=/g)?.length).toBe(1);
    for (const tab of ['Peripherals', 'Pins', 'Diagnostics', 'DMA', 'PIO', 'Audit']) {
      expect(page, tab).toContain(tab);
    }
    expect(page).not.toContain('Configuration');
    expect(page).not.toContain('matchMedia');
    expect(page).not.toContain("addEventListener('resize'");
    expect(page).not.toContain('addEventListener("resize"');
    const css = readSource('src/app.css');
    for (const tab of ['peripherals', 'pins', 'diagnostics', 'dma', 'pio', 'audit']) {
      expect(css, tab).toContain(`[data-dock-tab='${tab}']`);
    }
    expect(css).not.toContain("[data-dock-tab='configuration']");
    expect(css).toMatch(/\.workspace-summary \.summary-tab-strip \{\s*display: none/);
  });

  it('keeps the combined sidebar side by side in both orientations', () => {
    const css = readSource('src/app.css');
    const rootBlock = css.match(/\.workspace-root\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(rootBlock).toContain('minmax(400px, var(--left-pane-width, 440px))');
    expect(css).toContain('.combined-tree-column');
    expect(css).toContain('width: var(--tree-column-width, 160px)');
    expect(css).toContain('min-width: 120px');
    expect(css).toContain('max-width: 240px');
    expect(css).toContain('min-width: 260px');
    const portrait = css.slice(css.indexOf('@media (orientation: portrait)'));
    expect(portrait).toContain("[data-dock-tab='peripherals'] .workspace-peripherals");
    expect(portrait).not.toContain('configuration');
    const sidebar = readSource('src/components/workspace/CombinedSidebar.svelte');
    expect(sidebar).toContain('flex flex-row');
    expect(sidebar).toContain('combined-tree-column');
    expect(sidebar).toContain('combined-detail-column');
    const tree = readSource('src/components/workspace/PeripheralTree.svelte');
    const detail = readSource('src/components/workspace/PeripheralDetail.svelte');
    expect(tree).toContain('overflow-y-auto');
    expect(detail).toContain('overflow-y-auto');
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

describe('native dialog contract', () => {
  it('opens all six dialog surfaces through the modal API', () => {
    const components = [
      'src/components/workspace/ExportModal.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/BoardSelectorModal.svelte',
      'src/components/workspace/CompatibleMcuFinder.svelte',
      'src/components/workspace/PinoutDiffModal.svelte',
    ];
    for (const file of components) {
      const source = readSource(file);
      expect(source, file).toContain('<dialog');
      expect(source, file).toContain('class="modal"');
      expect(source, file).toContain('bind:this=');
      expect(source, file).toContain('showModal()');
      expect(source, file).toMatch(/\.close\(\)/);
      expect(source, file).toContain('onclose=');
      expect(source, file).toContain('oncancel=');
      expect(source, file).toContain('modal-backdrop');
      expect(source, file).not.toContain("addEventListener('keydown'");
    }
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('<dialog');
    expect(page).toContain('bind:this={ambiguousDialogEl}');
    expect(page).toContain('showModal()');
    expect(page).toContain('onclose={handleAmbiguousClose}');
    expect(page).toContain('modal-backdrop');
    expect(page).not.toContain("e.key === 'Escape'");
  });

  it('guards both window shortcut handlers while a native dialog is open', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    const handler =
      page.match(/const onKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    const guard = "document.querySelector('dialog[open]')";
    expect(handler, 'workspace guard').toContain(guard);
    expect(handler.indexOf(guard), 'workspace guard placement').toBeLessThan(
      handler.indexOf("e.key.toLowerCase() === 'f'"),
    );
    expect(handler).not.toContain('Escape');

    const canvas = readSource('src/components/workspace/PackageCanvas.svelte');
    const canvasHandler =
      canvas.match(/const onKey = \(e: KeyboardEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    expect(canvasHandler, 'canvas guard').toContain(guard);
    expect(canvasHandler.indexOf(guard), 'canvas guard placement').toBeLessThan(
      canvasHandler.indexOf("e.key === 'Escape'"),
    );
    expect(canvasHandler.indexOf(guard), 'canvas fit guard placement').toBeLessThan(
      canvasHandler.indexOf("e.key === '0'"),
    );
  });

  it('keeps the shared workspace shortcuts without dialog Escape handling', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    const handler = page.match(/const onKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    expect(handler).toContain("e.key.toLowerCase() === 'f'");
    expect(handler).toContain("e.key.toLowerCase() === 'k'");
    expect(handler).not.toContain('Escape');
  });
});

describe('canvas gesture and rotation input', () => {
  it('registers non-passive wheel and gesture listeners with cleanup', () => {
    const source = readSource('src/components/workspace/PackageCanvas.svelte');
    expect(source).toContain("addEventListener('wheel', handleWheel, { passive: false })");
    expect(source).toContain(
      "addEventListener('gesturestart', handleGestureStart, { passive: false })",
    );
    expect(source).toContain(
      "addEventListener('gesturechange', handleGestureChange, { passive: false })",
    );
    expect(source).toContain("removeEventListener('wheel', handleWheel)");
    expect(source).not.toContain('onwheel=');
    expect(source).toContain('activePointers');
    expect(source).toContain('resetPinch()');
    expect(source).toContain('zoomBy(distance / pinchDistance, midX, midY)');

    const css = readSource('src/app.css');
    const stage = css.match(/\.canvas-stage\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(stage).toContain('touch-action: none');
    for (const block of [
      css.match(/html,\s*body\s*\{[\s\S]*?\}/)?.[0] ?? '',
      css.match(/#app\s*\{[\s\S]*?\}/)?.[0] ?? '',
    ]) {
      expect(block).toContain('overflow: hidden');
    }
  });

  it('renders two-state rotation in SVG without a CSS wrapper', () => {
    const canvas = readSource('src/components/workspace/PackageCanvas.svelte');
    expect(canvas).toContain('rotation === -90');
    expect(canvas).not.toContain('transform: rotate(${rotation}deg)');
    expect(canvas).toContain('{rotation}');
    for (const file of ['PerimeterPackage.svelte', 'GridPackage.svelte']) {
      const source = readSource(`src/components/workspace/${file}`);
      expect(source, file).toContain('rotation?: PackageRotation');
      expect(source, file).toContain('geometryTransform');
      expect(source, file).toContain('counterRotation');
      expect(source, file).toContain('rotate(-90 ${viewCenterX} ${viewCenterY})');
      expect(source, file).toContain('rotate(${counterRotation}');
    }
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
    expect(normalizeDockTab('configuration')).toBe('peripherals');
    expect(normalizeDockTab('pio')).toBe('pio');
    expect(Object.keys(createEmptyWorkspace(chip.id))).not.toContain('dockTab');
  });

  it('does not clone, compare or record a dock tab in workspace state or history', () => {
    const cloned = cloneWorkspaceState(pinConfigState);
    expect(cloned).toEqual(pinConfigState);
    expect(cloned).not.toBe(pinConfigState);
    expect(statesEqual(pinConfigState, cloned)).toBe(true);

    const history = createWorkspaceHistory(createEmptyWorkspace(chip.id));
    expect(history.push(pinConfigState)).toBe(true);
    expect(history.current).toEqual(pinConfigState);
    expect(Object.keys(history.current)).not.toContain('dockTab');
    expect(history.undo()).toEqual(createEmptyWorkspace(chip.id));
  });

  it('omits UI preferences from share links and project JSON', () => {
    const encoded = encodeWorkspaceState(pinConfigState);
    expect(urlPayloadKeys(encoded)).not.toContain('d');
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(pinConfigState);

    const json = exportPinoutJson(pinConfigState);
    expect(Object.keys(JSON.parse(json) as Record<string, unknown>)).not.toContain('dockTab');
    const parsed = parsePinoutJson(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(pinConfigState);
  });

  it('ignores legacy dock values while preserving pin configuration', () => {
    const legacyUrl = decodeWorkspaceState(
      encodeLegacyUrlPayload({
        v: 2,
        m: chip.id,
        a: { '15': ['SPI1', 'SCK', 5] },
        k: ['15'],
        p: { SPI1: 'full_duplex' },
        d: 'diagnostics',
      }),
    );
    expect(legacyUrl.ok).toBe(true);
    if (legacyUrl.ok) {
      expect(legacyUrl.state.assignments['15']).toEqual(pinConfigState.assignments['15']);
      expect(legacyUrl.state.locked).toEqual(pinConfigState.locked);
      expect(legacyUrl.state.peripheralModes).toEqual(pinConfigState.peripheralModes);
      expect(Object.keys(legacyUrl.state)).not.toContain('dockTab');
    }

    const legacyJson = parsePinoutJson(
      JSON.stringify({
        format: 'pincraft-pinout',
        version: 2,
        mcuId: chip.id,
        assignments: { '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 } },
        labels: { '15': 'CLK' },
        locked: ['15'],
        peripheralModes: { SPI1: 'full_duplex' },
        dockTab: 'audit',
      }),
    );
    expect(legacyJson.ok).toBe(true);
    if (legacyJson.ok) {
      expect(legacyJson.state).toEqual(pinConfigState);
      expect(Object.keys(legacyJson.state)).not.toContain('dockTab');
    }
  });

  it('survives reload in localStorage without touching pin state or undo history', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      location: { origin: 'https://example.test', pathname: '/pincraft/' },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    try {
      const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
      const { catalogStore } = await import('../src/state/catalog.svelte.ts');
      const { viewPreferences, VIEW_PREFERENCES_STORAGE_KEY } = await import(
        '../src/state/workspace-preferences.svelte.ts'
      );
      catalogStore.primeChip(chip);
      await workspaceStore.openMcu(chip.id);
      workspaceStore.assignPin('15', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
      workspaceStore.toggleLock('15');
      workspaceStore.setPeripheralMode('SPI1', 'full_duplex');
      const before = cloneWorkspaceState(workspaceStore.state);
      const canUndoBefore = workspaceStore.canUndo;
      const canRedoBefore = workspaceStore.canRedo;

      // Selecting a dock tab is layout-only: it needs no history entry.
      workspaceStore.setDockTab('dma');
      expect(workspaceStore.dockTab).toBe('dma');
      expect(workspaceStore.state).toEqual(before);
      expect(workspaceStore.canUndo).toBe(canUndoBefore);
      expect(workspaceStore.canRedo).toBe(canRedoBefore);

      workspaceStore.setDockTab('audit');
      expect(workspaceStore.dockTab).toBe('audit');
      const preferences = JSON.parse(
        storage.get(VIEW_PREFERENCES_STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>;
      expect(preferences.dockTab).toBe('audit');
      expect(viewPreferences.dockTab).toBe('audit');

      const sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
        state: WorkspaceState;
      }>;
      expect(sessions[0].state).toEqual(before);
      expect(Object.keys(sessions[0].state)).not.toContain('dockTab');
      expect(exportPinoutJson(workspaceStore.state)).not.toContain('dockTab');
      expect(
        urlPayloadKeys(workspaceStore.buildShareUrl().split('#/s/')[1]),
      ).not.toContain('d');

      // Undo still targets pin configuration rather than the dock selection.
      workspaceStore.undo();
      expect(workspaceStore.dockTab).toBe('audit');
      expect(workspaceStore.state.peripheralModes).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
