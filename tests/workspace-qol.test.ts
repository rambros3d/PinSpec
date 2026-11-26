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
  'src/pages/LandingPage.svelte',
];

describe('catalog error state and retry', () => {
  it('retries a failed catalog load and clears the error on success', async () => {
    const meta = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      sources: {
        stm32: { chipCount: 1, commit: 'test', license: 'BSD-3-Clause' },
      },
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

describe('workspace status surfaces', () => {
  it('uses the daisyUI spinner for the workspace load view', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('loading loading-spinner loading-lg text-info');
    expect(page).toContain('Loading {mcuId ?? \'shared pinout\'}...');
    expect(page).not.toContain('border-t-transparent');
  });

  it('splits DMA contention and ordinary rows into separate component families', () => {
    const drawer = readSource('src/components/workspace/SummaryDrawer.svelte');
    expect(drawer).toContain('{#snippet dmaRow(item: DmaAnalysisEntry)}');
    expect(drawer).toContain('class="alert alert-warning p-2.5 text-xs space-y-1"');
    expect(drawer).toContain('class="card card-border bg-base-200 p-2.5 text-xs space-y-1"');
    expect(drawer).toContain('{@render dmaRow(item)}');
    expect(drawer).not.toMatch(/class=\{`[^`]*card card-border[^`]*alert alert-warning[^`]*\}/);
    expect(drawer).toContain('Shares channel with:');
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

  it('keeps the toast above the two shell bars', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('workspace-toast');
    expect(page).toContain('z-[60]');
    expect(page).toContain('workspaceStore.dismissToast()');
    const css = readSource('src/app.css');
    const token = (name: string): number => {
      const match = new RegExp(`${name}:\\s*(\\d+)`).exec(css);
      expect(match, name).not.toBeNull();
      return Number(match![1]);
    };
    expect(token('--toast-z')).toBe(60);
    expect(css).toContain('z-index: var(--toast-z)');
    expect(css).not.toContain('--shell-panel-z');
    expect(readSource('src/components/shell/GlobalNavBar.svelte')).toContain('h-8 shrink-0');
    expect(readSource('src/components/shell/WorkspaceTopBar.svelte')).toContain('h-12 shrink-0');
  });
});

describe('export failure feedback', () => {
  it('reports copy and download failures from the workspace export dialog', () => {
    const modal = readSource('src/components/workspace/ExportModal.svelte');
    expect(modal).toContain('workspaceStore.showToast(');
    expect(modal).toContain('Check clipboard access.');
    expect(modal).toContain('Unable to start the export download.');
    expect(modal.indexOf('click()')).toBeLessThan(modal.indexOf('revokeObjectURL'));
    expect(modal).toContain('copyContent');
    expect(modal).toContain('downloadFile');
    for (const crate of ['embassy-stm32', 'embassy-rp', 'ch32-hal', 'esp-hal']) {
      expect(modal, crate).toContain(crate);
    }
    expect(readSource('src/pages/LandingPage.svelte')).not.toContain('id="export-preview"');
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
    const wrapper = readSource('src/components/shell/Dialog.svelte');
    for (const token of [
      'openDialogWithFocus',
      'showModal()',
      'dialogEl?.close()',
      'onclose={onClose}',
      'oncancel=',
      'modal-backdrop',
    ]) {
      expect(wrapper, token).toContain(token);
    }
    for (const file of [...DIALOG_FILES, 'src/components/workspace/ShortcutHelpDialog.svelte']) {
      const source = readSource(file);
      expect(source, file).toContain('Dialog.svelte');
      expect(source, file).toContain('<Dialog');
      if (!file.endsWith('WorkspacePage.svelte')) {
        expect(source, file).not.toContain("addEventListener('keydown'");
      }
    }
    expect(readSource('src/components/workspace/ExportModal.svelte')).toContain('copyButtonEl');
  });
});

describe('shortcut help', () => {
  it('places the modal backdrop as a direct dialog child outside the modal box', () => {
    const help = readSource('src/components/shell/Dialog.svelte');
    const boxOpen = help.indexOf('<div class={`modal-box ${boxClass}`}>');
    const backdrop = help.indexOf('<form method="dialog" class="modal-backdrop">');
    const dialogClose = help.indexOf('</dialog>');
    expect(boxOpen).toBeGreaterThan(-1);
    expect(backdrop).toBeGreaterThan(boxOpen);
    expect(backdrop).toBeLessThan(dialogClose);
    expect(help.slice(backdrop, dialogClose)).not.toContain('</div>');
    expect(help).toMatch(/<\/div>\s*<form method="dialog" class="modal-backdrop">/);
    expect(help).toContain('onclose={onClose}');
    expect(help).toContain('oncancel=');
    expect(help).toContain('openDialogWithFocus(');
  });

  it('renders the shared SHORTCUTS reference without a local shortcut array', () => {
    const help = readSource('src/components/workspace/ShortcutHelpDialog.svelte');
    expect(help).toContain("import { SHORTCUTS } from '../../data/provenance'");
    expect(help).toContain('{#each SHORTCUTS as shortcut (shortcut.keys)}');
    expect(help).not.toContain('const shortcuts = [');
    expect(help).not.toContain("{ keys: '?', action:");
    const reference = readSource('src/data/provenance.ts');
    for (const token of ['Ctrl+K', 'Ctrl+F', 'Ctrl+Click', 'Ctrl+Z', 'Ctrl+Y', '0', 'Escape']) {
      expect(reference, token).toContain(token);
    }
    for (const file of ['src/pages/LandingPage.svelte', 'src/pages/AboutPage.svelte']) {
      const source = readSource(file);
      expect(source, file).not.toContain('SHORTCUTS');
      expect(source, file).not.toContain('const shortcuts = [');
      expect(source, file).not.toContain('<kbd');
    }
    expect(readSource('src/pages/LandingPage.svelte')).not.toContain('Shortcuts');
    expect(readSource('src/components/shell/AppShell.svelte').match(/<ShortcutHelpDialog/g)?.length).toBe(1);
  });

  it('opens the same shell dialog from the keyboard and the shortcuts control', () => {
    const nav = readSource('src/components/shell/GlobalNavBar.svelte');
    const bar = readSource('src/components/shell/WorkspaceTopBar.svelte');
    expect(nav).toContain('topBarUI.shortcutHelpOpen = true');
    expect(nav).toContain('aria-label="Keyboard shortcuts"');
    const shell = readSource('src/components/shell/AppShell.svelte');
    expect(shell).toContain('topBarUI.shortcutHelpOpen');
    expect(shell).toContain('ShortcutHelpDialog');
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain("e.key === '?' && !inInput");
    expect(page).toContain('topBarUI.shortcutHelpOpen = true');
    expect(page).not.toContain('<ShortcutHelpDialog');
    const handler =
      page.match(/const onKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    expect(handler).toContain('topBarUI.focusSearch?.()');
    expect(handler).toContain(
      "(e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'f'",
    );
    expect(handler).toContain(
      "(e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'k'",
    );
    expect(handler).toContain("e.key === 'Escape' && inInput");
    expect(handler).toContain("e.key === '?' && !inInput");
    expect(bar).toContain('aria-label="Project name"');
    expect(bar).toContain('e.stopPropagation()');
    expect(bar).not.toContain('topBarUI.focusSearch = () =>');
    expect(nav).not.toContain('topBarUI.focusSearch = () =>');
    const canvas = readSource('src/components/workspace/PackageCanvas.svelte');
    expect(canvas).toContain('topBarUI.focusSearch = () =>');
    expect(canvas).toContain('searchInputRef?.select()');
    expect(canvas).toContain('aria-label="Find pin or signal"');
    expect(canvas).toContain('workspaceStore.globalSearch');
    expect(canvas).toContain('data-placement-furniture');
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
      [
        'src/components/landing/RecentSessions.svelte',
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
    const tree = readSource('src/components/workspace/PeripheralTree.svelte');
    expect(tree).not.toContain('font-mono-tabular text-[11px] text-base-content/40');
    expect(tree).not.toContain('type="checkbox"');
    expect(tree).not.toContain('<select');
  });
});

describe('workspace icon provenance', () => {
  it('uses Solar bold duotone icons across workspace surfaces', () => {
    for (const rel of [
      'src/components/workspace/ExportModal.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/BoardSelectorModal.svelte',
      'src/components/workspace/CompatibleMcuFinder.svelte',
      'src/components/workspace/PinoutDiffModal.svelte',
      'src/components/workspace/ShortcutHelpDialog.svelte',
      'src/components/workspace/PinPopover.svelte',
      'src/components/workspace/PinContextMenu.svelte',
      'src/components/workspace/PioPanel.svelte',
      'src/components/workspace/PeripheralTree.svelte',
      'src/components/workspace/PackageCanvas.svelte',
      'src/components/workspace/SummaryDrawer.svelte',
    ]) {
      const source = readSource(rel);
      expect(source, rel).not.toContain('lucide-svelte');
      expect(source, rel).toContain('@solar-icons/svelte/bold-duotone/');
    }
    expect(readSource('src/components/workspace/PackageCanvas.svelte')).toContain(
      '@solar-icons/svelte/bold-duotone/target',
    );
    expect(readSource('src/components/workspace/SummaryDrawer.svelte')).toContain('text-info');
    expect(readSource('src/pages/WorkspacePage.svelte')).not.toContain('lucide-svelte');
  });
});

describe('placement overlay Escape and keyboard focus', () => {
  it('cancels drags on Escape and keeps indicator keyboard controls', () => {
    const source = readSource('src/components/workspace/PlacementOverlay.svelte');
    expect(source).toContain("event.key === 'Escape' && draggingName");
    expect(source).toContain('cancelActiveDrag()');
    expect(source).toContain('group-focus-visible:opacity-100');
    const rings = source.match(/\{#each PLACEMENT_RINGS as ring \(ring\)[\s\S]*?\{\/each\}/)?.[0] ?? '';
    expect(rings).toContain('class="fill-none stroke-current text-info opacity-90"');
    expect(rings).toContain('stroke-width="1"');
    expect(rings).toContain('stroke-dasharray="2 3"');
    expect(rings).not.toContain('5 4');
    const handles = source.match(/\{#each indicators as indicator \(indicator\.name\)[\s\S]*?\{\/each\}/)?.[0] ?? '';
    expect(handles).toContain('stroke-width="2"');
    expect(source).not.toContain('opacity-40');
    expect(source).toContain('role="button"');
    expect(source).toContain('tabindex="0"');
    expect(source).toContain("event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0");
    for (const token of ['PLACEMENT_RINGS', 'setPointerCapture', 'indicator.name']) {
      expect(source, token).toContain(token);
    }
    expect(source).not.toContain('type="number"');
    expect(source).not.toContain('pointer-events-auto absolute top-16');
    expect(source).not.toContain('onRing');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const panel = readSource('src/components/workspace/PlacementPanel.svelte');
    expect(panel).toContain('configuredPeripheralNames');
    expect(panel).toContain('classifyPlacementEligibility');
    expect(panel).toContain("disabled={row.status === 'locked-only'}");
    expect(panel).toContain('setPlacement');
    expect(panel).toContain("ring: 'low', enabled: true");
    expect(panel).not.toContain('type="number"');
    expect(panel).not.toContain('setPlacementOverlayVisible');
    expect(panel).not.toContain('Claimed:');
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
    for (const label of ['Peripherals', 'Pins', 'Diagnostics', 'DMA', 'PIO', 'Placement', 'Audit']) {
      expect(page, label).toContain(label);
    }
    expect(page).not.toContain('Configuration');
  });

  it('computes toolbar overflow from scroll metrics', () => {
    expect(shouldShowScrollAffordance(0, 400, 400)).toBe(false);
    expect(shouldShowScrollAffordance(0, 400, 600)).toBe(true);
    expect(shouldShowScrollAffordance(100, 400, 600)).toBe(true);
    expect(shouldShowScrollAffordance(200, 400, 600)).toBe(false);
    expect(shouldShowScrollAffordance(Number.NaN, 400, 600)).toBe(false);
    expect(shouldShowScrollAffordance(0, 0, 600)).toBe(false);

    const bar = readSource('src/components/shell/WorkspaceTopBar.svelte');
    for (const token of [
      'global-top-bar h-12 shrink-0',
      'overflow-x-auto',
      'min-w-0',
      'truncate max-w-[11rem]',
      'shouldShowScrollAffordance',
      'onscroll={updateScrollHint}',
    ]) {
      expect(bar, token).toContain(token);
    }
    expect(readSource('src/components/shell/GlobalNavBar.svelte')).not.toContain('overflow-x-auto');
  });
});

describe('first-time recent-sessions hint', () => {
  it('derives the hint from the persisted session list', () => {
    const source = readSource('src/components/landing/RecentSessions.svelte');
    expect(source).toContain('recentSessions.length > 0');
    expect(source).toContain('Opening a part creates a recent session in this browser.');
    expect(source).not.toContain('hintDismissed');
    expect(readSource('src/core/types.ts')).not.toContain('hintDismissed');
  });
});
