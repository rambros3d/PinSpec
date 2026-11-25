import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateProjectName } from '../src/core/project-name';
import type { ChipData } from '../src/core/types';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('canvas pan gesture ownership', () => {
  const canvas = read('src/components/workspace/PackageCanvas.svelte');

  it('captures the pointer only on the stage or the SVG package surface', () => {
    for (const token of [
      'target === stageEl',
      'contentEl?.contains(target)',
      '!isPinTarget',
      'isPanButton && isStageOrSvg && !isPinTarget',
      'setPointerCapture(e.pointerId)',
    ]) {
      expect(canvas, token).toContain(token);
    }
    expect(canvas).not.toContain('e.button === 1 || (e.button === 0 && !isPinTarget)');
    const handler = canvas.match(/function handlePointerDown[\s\S]*?\n  }/)?.[0] ?? '';
    expect(handler.indexOf('const isStageOrSvg')).toBeLessThan(
      handler.indexOf('setPointerCapture(e.pointerId)'),
    );
  });

  it('keeps every canvas overlay control wired to its existing action', () => {
    for (const token of [
      'onclick={() => zoomBy(1 / 1.2)}',
      'onclick={() => zoomBy(1.2)}',
      'onclick={fitView}',
      'onclick={onRotate}',
      'onPlacementToggle?.(next)',
      'aria-label="Clear search"',
      'onclick={onCancelRemap}',
      'absolute top-28 left-1/2 -translate-x-1/2',
      'max-w-[calc(100%-1.5rem)]',
    ]) {
      expect(canvas, token).toContain(token);
    }
    expect(canvas).not.toContain('absolute top-3 left-1/2 -translate-x-1/2');
    const popover = read('src/components/workspace/PinPopover.svelte');
    expect(popover).toContain("onAssign({ peripheral: 'GPIO', signal: mode, af: null })");
    expect(popover).toContain('onToggleLock');
    const menu = read('src/components/workspace/PinContextMenu.svelte');
    expect(menu).toContain('onSetLabel');
    expect(menu).toContain('onHighlightAlternates');
    expect(menu).toContain('onEnterRemap');
  });
});

describe('summary drawer collapse control', () => {
  const page = read('src/pages/WorkspacePage.svelte');

  it('is not overlapped by the canvas find HUD', () => {
    expect(page).toContain('absolute bottom-3 right-3 z-20 shadow-xs');
    expect(page).not.toContain('absolute top-14 right-3 z-20 shadow-xs');
    expect(page).toContain('onclick={toggleRightDrawer}');
  });
});

describe('workspace title icon and sidebar navigation start', () => {
  const bar = read('src/components/shell/GlobalTopBar.svelte');
  const sidebar = read('src/components/shell/GlobalSidebar.svelte');

  it('shows the app icon before the editable project name on workspace routes', () => {
    const icon = bar.indexOf('${import.meta.env.BASE_URL}radiokit-logo.svg');
    const name = bar.indexOf('aria-label="Rename project"');
    expect(icon).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(icon);
    expect(bar).toContain('aria-label="Project name"');
    expect(bar).toContain('PinCraft');
  });

  it('drops the sidebar brand header without dropping navigation', () => {
    expect(sidebar).not.toContain('flex h-12 shrink-0 items-center border-b border-base-300');
    expect(sidebar).not.toContain('>PinCraft<');
    const panel = sidebar.indexOf('<aside');
    const nav = sidebar.indexOf('<nav class="shrink-0 space-y-1 py-2"', panel);
    const recents = sidebar.indexOf('Recent projects');
    expect(nav).toBeGreaterThan(panel);
    expect(nav).toBeLessThan(recents);
    expect(sidebar).toContain('shellPreferences.sidebarExpanded = !expanded');
  });
});

describe('two-word generator independence', () => {
  it('does not read chip metadata', () => {
    const chip: ChipData = {
      id: 'STM32H503CBT6',
      family: 'STM32H5',
      muxModel: 'af',
      core: 'Test core',
      flashKb: 128,
      ramKb: 32,
      package: { name: 'TSSOP20', kind: 'perimeter', pinCount: 2, sides: [1, 0, 1, 0] },
      pins: [],
      peripherals: {},
    };
    const freshRng = () => {
      const samples = [0, 1 / 12];
      let index = 0;
      return () => samples[index++] ?? 0;
    };
    expect(generateProjectName(chip, freshRng())).toBe('amber-quartz');
    expect(generateProjectName({ id: 'RP2040', family: '' }, freshRng())).toBe('amber-quartz');
  });
});
