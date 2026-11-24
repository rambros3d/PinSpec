import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { shouldShowScrollAffordance } from '../src/core/scroll-affordance';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const DIALOG_FILES = [
  'src/components/workspace/ExportModal.svelte',
  'src/components/workspace/McuSwitcherModal.svelte',
  'src/components/workspace/BoardSelectorModal.svelte',
  'src/components/workspace/CompatibleMcuFinder.svelte',
  'src/components/workspace/PinoutDiffModal.svelte',
  'src/pages/WorkspacePage.svelte',
];

describe('catalog error state and retry', () => {
  it('retries a failed catalog load and clears the error on success', async () => {
    const meta = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      stm32DataCommit: 'test',
      openPinDataCommit: 'test',
      chipCount: 1,
      families: ['STM32G4'],
    };
    const entry = {
      id: 'STM32G431CBU6',
      family: 'STM32G4',
      core: 'Cortex-M4',
      package: 'UFQFPN48',
      pinCount: 48,
      flashKb: 128,
      ramKb: 32,
      peripherals: { spi: 1, i2c: 1, usart: 1, can: 1, usb: 0, tim: 1, adc: 1 },
    };
    let fail = true;
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      if (fail) return { ok: false, status: 503 } as unknown as Response;
      const url = String(input);
      if (url.includes('meta.json')) {
        return { ok: true, json: async () => meta } as unknown as Response;
      }
      return { ok: true, json: async () => [entry] } as unknown as Response;
    });
    vi.resetModules();
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');

    await catalogStore.ensureLoaded();
    expect(catalogStore.indexError).toContain('Failed to load catalog');
    expect(catalogStore.index).toHaveLength(0);

    fail = false;
    await catalogStore.retry();
    expect(catalogStore.indexError).toBeNull();
    expect(catalogStore.index).toHaveLength(1);
    expect(catalogStore.index[0].id).toBe('STM32G431CBU6');

    fail = true;
    await catalogStore.retry();
    expect(catalogStore.indexError).toContain('Failed to load catalog');
    vi.unstubAllGlobals();
  });

  it('shows the error row before the empty-results row', () => {
    const source = readSource('src/components/landing/QuickSearchBar.svelte');
    expect(source.indexOf('catalogStore.indexError')).toBeLessThan(
      source.indexOf('No parts matched your filter criteria.'),
    );
    expect(source).toContain('catalogStore.retry()');
    expect(source).toContain('Retry catalog load');
    expect(source).toContain('catalogStore.loadingIndex');
    expect(source).not.toContain('Could not load STM32');
  });
});

describe('pin table states and sort semantics', () => {
  it('distinguishes no assignments from a filter with no matches', () => {
    const source = readSource('src/components/workspace/SummaryDrawer.svelte');
    expect(source).toContain('rows.length === 0 && !hasAssignments');
    expect(source).toContain('No assigned pins yet');
    expect(source).toContain('{:else if rows.length === 0}');
    expect(source).toContain('No assigned pins match this filter');
    expect(source).toContain("tableFilter = ''");
    expect(source).toContain('Clear filter');
    expect(source).toContain('hasAssignments = $derived(Object.keys(assignments).length > 0)');
  });

  it('reports sort direction on all three sortable headers', () => {
    const source = readSource('src/components/workspace/SummaryDrawer.svelte');
    expect(source.match(/aria-sort=/g)?.length).toBe(3);
    for (const key of ['pos', 'pin', 'signal']) {
      expect(source, key).toContain(
        `sortKey === '${key}' ? (sortAsc ? 'ascending' : 'descending') : 'none'`,
      );
    }
  });
});

describe('toast placement and dismissal', () => {
  it('clears the toast immediately and still accepts later notifications', async () => {
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    workspaceStore.showToast('first');
    expect(workspaceStore.toast?.text).toBe('first');
    workspaceStore.dismissToast();
    expect(workspaceStore.toast).toBeNull();
    workspaceStore.showToast('second', 'warning');
    expect(workspaceStore.toast?.text).toBe('second');
    expect(workspaceStore.toast?.tone).toBe('warning');
    workspaceStore.dismissToast();
  });

  it('places the toast above the portrait dock inside the existing media query', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('workspace-toast');
    expect(page).toContain('workspaceStore.dismissToast()');
    expect(page).toContain('Dismiss notification');
    const css = readSource('src/app.css');
    expect(css.match(/@media \(orientation: portrait\)/g)?.length).toBe(1);
    expect(css.match(/grid-template-areas:/g)?.length).toBe(2);
    expect(css).toContain('43dvh');
    expect(css).toContain('bottom: calc(43dvh + 0.75rem)');
    expect(readSource('src/state/workspace.svelte.ts')).toContain('}, 3200);');
  });
});

describe('export failure feedback', () => {
  it('reports copy and download failures from both export surfaces', () => {
    const landing = readSource('src/pages/LandingPage.svelte');
    const modal = readSource('src/components/workspace/ExportModal.svelte');
    for (const [name, source] of [
      ['landing', landing],
      ['export modal', modal],
    ] as const) {
      expect(source, name).toContain('workspaceStore.showToast(');
      expect(source, name).toContain('Check clipboard access.');
      expect(source, name).toContain('Unable to start the export download.');
      expect(source.indexOf('click()'), name).toBeLessThan(source.indexOf('revokeObjectURL'));
    }
    expect(modal).toContain('copyContent');
    expect(modal).toContain('downloadFile');
    expect(landing).toContain('downloadPreview');
    expect(landing).toContain('rustCrate');
    for (const crate of ['embassy-stm32', 'embassy-rp', 'ch32-hal']) {
      expect(modal, crate).toContain(crate);
    }
  });
});

describe('dialog focus management', () => {
  it('uses a DOM-only helper outside the pure core', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/state/dialog-focus.ts'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/core/dialog-focus.ts'))).toBe(false);
    const helper = readSource('src/state/dialog-focus.ts');
    expect(helper).not.toContain("from 'svelte'");
    expect(helper).not.toContain("from './");
    expect(helper).toContain('openDialogWithFocus');
    expect(helper).toContain("addEventListener('close'");
    expect(helper).toContain('opener?.focus()');
  });

  it('restores focus for all six native dialogs and the help dialog', () => {
    for (const file of [...DIALOG_FILES, 'src/components/workspace/ShortcutHelpDialog.svelte']) {
      const source = readSource(file);
      expect(source, file).toContain('openDialogWithFocus');
      expect(source, file).toContain('showModal()');
      expect(source, file).toMatch(/\.close\(\)/);
      expect(source, file).toContain('onclose=');
      expect(source, file).toContain('oncancel=');
      expect(source, file).toContain('modal-backdrop');
      if (!file.endsWith('WorkspacePage.svelte')) {
        expect(source, file).not.toContain("addEventListener('keydown'");
      }
    }
    expect(readSource('src/components/workspace/ExportModal.svelte')).toContain('copyButtonEl');
  });
});

describe('shortcut help', () => {
  it('lists only documented shortcuts and opens on ? outside text fields', () => {
    const help = readSource('src/components/workspace/ShortcutHelpDialog.svelte');
    for (const token of [
      'Ctrl+K',
      'Ctrl+F',
      'Ctrl+Click',
      'Ctrl+Z',
      'Ctrl+Y',
      '0',
      'Escape',
      '?',
    ]) {
      expect(help, token).toContain(token);
    }
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain("e.key === '?' && !inInput");
    expect(page).toContain('showShortcutHelp = true');
    expect(page).toContain('<ShortcutHelpDialog');
    const handler =
      page.match(/const onKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    expect(handler).toContain('searchInputRef?.focus()');
    expect(handler).toContain('searchInputRef?.select()');
  });
});

describe('focus visibility, motion, and contrast', () => {
  it('adds a token-based focus ring and universal reduced-motion override', () => {
    const css = readSource('src/app.css');
    expect(css).toContain(':focus-visible {');
    expect(css).toContain('outline: 2px solid var(--color-info)');
    expect(css).toContain('outline-offset: 2px');
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).toContain('transition-duration: 0.01ms !important');
    expect(css).toContain('.animate-pin-pulse');
  });

  it('raises text-bearing muted copy to the standard muted token', () => {
    const replaced: Array<[string, string]> = [
      ['src/components/landing/HeroChipPreview.svelte', 'text-[11px] text-base-content/40'],
      [
        'src/components/landing/PresetGrid.svelte',
        'text-base-content/40 font-mono-tabular',
      ],
      ['src/components/landing/QuickSearchBar.svelte', 'text-base-content/40 mx-0.5'],
      [
        'src/components/landing/QuickSearchBar.svelte',
        'class="text-base-content/40">{entry.pinCount} pins',
      ],
      ['src/pages/LandingPage.svelte', 'text-base-content/40 space-y-0.5'],
      ['src/components/workspace/HardwareAuditPanel.svelte', 'text-[11px] text-base-content/40'],
      ['src/components/workspace/McuSwitcherModal.svelte', 'mx-1 text-base-content/40'],
      ['src/components/workspace/PackageCanvas.svelte', 'text-base-content/40 ml-2'],
      ['src/components/workspace/PackageCanvas.svelte', 'text-[10px] text-base-content/40'],
      ['src/components/workspace/PinPopover.svelte', 'class="text-base-content/40">·<'],
      ['src/components/workspace/PioPanel.svelte', 'text-[11px] text-base-content/40'],
      ['src/components/workspace/SummaryDrawer.svelte', 'text-base-content/40 ml-1">'],
    ];
    for (const [file, token] of replaced) {
      expect(readSource(file), `${file}: ${token}`).not.toContain(token);
    }
    expect(readSource('src/components/landing/QuickSearchBar.svelte')).toContain(
      'class="size-4 text-base-content/40 absolute left-3.5 pointer-events-none"',
    );
    expect(readSource('src/components/landing/HeroChipPreview.svelte')).toContain(
      'text-[11px] text-base-content/60">Click any pin to edit',
    );
    const tree = readSource('src/components/workspace/PeripheralTree.svelte');
    expect(tree).not.toContain('font-mono-tabular text-[11px] text-base-content/40');
    expect(tree).not.toContain('type="checkbox"');
    expect(tree).not.toContain('<select');
  });
});

describe('placement overlay Escape and keyboard focus', () => {
  it('cancels drags on Escape and keeps indicator keyboard controls', () => {
    const source = readSource('src/components/workspace/PlacementOverlay.svelte');
    expect(source).toContain("event.key === 'Escape' && draggingName");
    expect(source).toContain('cancelActiveDrag()');
    expect(source).toContain('group-focus-visible:opacity-100');
    expect(source).toContain('role="button"');
    expect(source).toContain('tabindex="0"');
    expect(source).toContain("event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0");
    for (const token of ['PLACEMENT_RINGS', 'setPointerCapture', 'type="number"', 'indicator.name']) {
      expect(source, token).toContain(token);
    }
    expect(source).not.toContain('onRing');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('portrait dock and toolbar affordance', () => {
  it('exposes dock tabs with selection semantics and touch-sized targets', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('role="tablist"');
    expect(page).toContain('role="tab"');
    expect(page).toContain('aria-selected={workspaceStore.dockTab === tab}');
    expect(page).toContain('min-h-11');
    expect(page.match(/data-dock-tab=/g)?.length).toBe(1);
    for (const label of ['Peripherals', 'Pins', 'Configuration', 'Diagnostics', 'DMA', 'PIO']) {
      expect(page, label).toContain(label);
    }
  });

  it('computes toolbar overflow from scroll metrics', () => {
    expect(shouldShowScrollAffordance(0, 400, 400)).toBe(false);
    expect(shouldShowScrollAffordance(0, 400, 600)).toBe(true);
    expect(shouldShowScrollAffordance(100, 400, 600)).toBe(true);
    expect(shouldShowScrollAffordance(200, 400, 600)).toBe(false);
    expect(shouldShowScrollAffordance(Number.NaN, 400, 600)).toBe(false);
    expect(shouldShowScrollAffordance(0, 0, 600)).toBe(false);

    const toolbar = readSource('src/components/workspace/TopToolbar.svelte');
    for (const token of [
      'h-12 shrink-0',
      'overflow-x-auto',
      'min-w-0',
      'truncate max-w-[11rem]',
      'hidden sm:inline font-bold',
      'shouldShowScrollAffordance',
      'onscroll={updateScrollHint}',
    ]) {
      expect(toolbar, token).toContain(token);
    }
  });
});

describe('first-time recent-sessions hint', () => {
  it('derives the hint from the persisted session list', () => {
    const source = readSource('src/components/landing/PresetGrid.svelte');
    expect(source).toContain('recentSessions.length > 0');
    expect(source).toContain('Opening a part creates a recent session in this browser.');
    expect(source).not.toContain('hintDismissed');
    expect(readSource('src/core/types.ts')).not.toContain('hintDismissed');
  });
});
