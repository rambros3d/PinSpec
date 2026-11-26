import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORY_EXPANSION } from '../src/state/workspace-preferences.svelte';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('combined sidebar configuration surface', () => {
  it('hosts the detail component beside the tree and not in the right drawer', () => {
    const sidebar = readSource('src/components/workspace/CombinedSidebar.svelte');
    expect(sidebar).toContain('<PeripheralTree');
    expect(sidebar).toContain('<PeripheralDetail');
    expect(sidebar).not.toContain('<PlacementPanel');
    expect(sidebar).not.toContain('combined-section-switcher');
    expect(sidebar).toContain('combined-tree-column');
    expect(sidebar).toContain('combined-detail-column');
    expect(sidebar).toContain('160');
    expect(sidebar).toContain('120');
    expect(sidebar).toContain('240');
    expect(sidebar).toContain('min-w-[260px]');
    for (const callback of ['onModeChange', 'onRemapChange', 'onToggleSignal', 'onFocusPin']) {
      expect(sidebar, callback).toContain(callback);
    }
    const css = readSource('src/app.css');
    expect(css).toContain('.combined-tree-column');
    expect(css).toContain('min-width: 120px');
    expect(css).toContain('max-width: 240px');
    expect(css).toContain('min-width: 260px');
    expect(css).toContain('320px');

    const drawer = readSource('src/components/workspace/SummaryDrawer.svelte');
    expect(drawer).not.toContain('configuration');
    expect(drawer).not.toContain('<PeripheralDetail');
    expect(drawer).toContain('min-h-0');
    expect(drawer).toContain('overflow-y-auto');
    for (const tab of ['pins', 'diagnostics', 'dma', 'pio', 'gpio', 'placement', 'audit']) {
      expect(drawer, tab).toContain(`'${tab}'`);
    }
    expect(drawer).toContain('<PlacementPanel');
  });

  it('selects the peripheral without a sidebar section switcher', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    const handler = page.match(/function selectPeripheral\(name: string\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(handler).toContain('viewPreferences.selectedPeripheral = name');
    expect(handler).not.toContain('sidebarSection');
    expect(handler).not.toContain('configuration');
    expect(page).toContain('<CombinedSidebar');
    expect(page).toContain('onSelectPeripheral={selectPeripheral}');
    for (const component of ['CombinedSidebar', 'PackageCanvas', 'SummaryDrawer']) {
      expect(page.match(new RegExp(`<${component}\\b`, 'g'))?.length, component).toBe(1);
    }
    const tree = readSource('src/components/workspace/PeripheralTree.svelte');
    const detail = readSource('src/components/workspace/PeripheralDetail.svelte');
    expect(page.match(/<PeripheralTree\b/g)?.length).toBeUndefined();
    expect(tree.match(/<PeripheralTree\b/g)?.length).toBeUndefined();
    expect(detail.match(/<PeripheralDetail\b/g)?.length).toBeUndefined();
    expect(page.match(/data-dock-tab=/g)?.length).toBe(1);
  });

  it('keeps sidebar section state out of view preferences and shareable state', () => {
    const store = readSource('src/state/workspace-preferences.svelte.ts');
    expect(store).not.toContain('sidebarSection');
    expect(store).not.toContain('SIDEBAR_SECTIONS');
    const json = readSource('src/core/exporters/json.ts');
    expect(json).not.toContain('sidebarSection');
    const url = readSource('src/core/url-state.ts');
    expect(url).not.toContain('sidebarSection');
    const sidebar = readSource('src/components/workspace/CombinedSidebar.svelte');
    expect(sidebar).not.toContain("'place'");
    expect(sidebar).not.toContain('>Place<');
    expect(sidebar).not.toContain('selectSection');
  });

  it('shows a short empty-state prompt when nothing is selected', () => {
    const detail = readSource('src/components/workspace/PeripheralDetail.svelte');
    expect(detail).toContain('No peripheral selected');
    expect(detail).toContain('Select a peripheral in the tree');
    expect(detail).toContain('min-h-0');
    expect(detail).toContain('overflow-y-auto');
  });
});

describe('compact configured-first tree', () => {
  const tree = readSource('src/components/workspace/PeripheralTree.svelte');

  it('renders only a status circle and a name per row', () => {
    expect(tree).toContain('statusColor(status)');
    expect(tree).toContain('statusBorder(status)');
    expect(tree).toContain('hasMode(name)');
    expect(tree).toContain('title={state}');
    expect(tree).toContain('aria-label={state}');
    expect(tree).toContain('onSelectPeripheral(name)');
    expect(tree).not.toContain('inlineModeLabel');
    expect(tree).not.toContain('getModesForPeripheral');
    expect(tree).not.toContain('placement');
    expect(tree).not.toContain('togglePeripheral(');
    expect(tree).not.toContain('type="checkbox"');
    expect(tree).not.toContain('<select');
    expect(tree).not.toContain('PinTagPills');
  });

  it('encodes status by hue and mode presence by fill', () => {
    expect(tree).toContain("import { PERIPHERAL_STATUS_VIEW } from '../../core/pin-view'");
    expect(tree).toContain('PERIPHERAL_STATUS_VIEW[status ?? \'none\'].color');
    expect(tree).toContain('PERIPHERAL_STATUS_VIEW[status ?? \'none\'].border');
    expect(tree).not.toContain("case 'active':");
    expect(tree).toContain("? statusColor(status) : 'bg-transparent'");
    expect(tree).toContain('Mode: ${peripheralModes[name]}');
    expect(tree).toContain('No mode selected');
  });

  it('sorts configured work first and shows the catch-all count on the right', () => {
    expect(tree).toContain('partitionPeripherals(peripheralStatus, peripheralModes)');
    expect(tree).toContain('orderPeripheralNames(names, partition)');
    expect(tree).toContain('category.label');
    expect(tree).toContain('{category.names.length}');
    expect(readSource('src/core/vendor-view.ts')).toContain("label: 'Others'");
    expect(DEFAULT_CATEGORY_EXPANSION.other).toBe(false);
    expect(DEFAULT_CATEGORY_EXPANSION.system).toBe(true);
  });

  it('shows a short browsable empty state above the categories', () => {
    expect(tree).toContain('hasConfigured');
    const marker = tree.indexOf('No peripherals configured. Select one below to open its configuration.');
    expect(marker).toBeGreaterThan(-1);
    expect(marker).toBeLessThan(tree.indexOf('{#each grouped as category'));
    expect(tree).toContain('{#each grouped as category');
    expect(tree).toContain('viewPreferences.filterText');
    expect(tree).toContain('viewPreferences.setCategoryOpen');
  });
});
