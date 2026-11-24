import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORY_EXPANSION } from '../src/state/workspace-preferences.svelte';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('right-drawer configuration surface', () => {
  it('hosts the detail component as a summary tab and forwards pin callbacks', () => {
    const drawer = readSource('src/components/workspace/SummaryDrawer.svelte');
    expect(drawer).toContain("activeTab = 'configuration'");
    expect(drawer).toContain('activeTab === \'configuration\'');
    expect(drawer).toContain('<PeripheralDetail');
    for (const callback of ['onModeChange', 'onRemapChange', 'onToggleSignal', 'onFocusPin']) {
      expect(drawer, callback).toContain(callback);
    }
    expect(drawer).toContain('min-h-0');
    expect(drawer).toContain('overflow-y-auto');
  });

  it('selects the peripheral and opens Configuration in both orientations', () => {
    const page = readSource('src/pages/WorkspacePage.svelte');
    const handler = page.match(/function selectPeripheral\(name: string\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(handler).toContain('viewPreferences.selectedPeripheral = name');
    expect(handler).toContain("summaryTab = 'configuration'");
    expect(handler).toContain("workspaceStore.setDockTab('configuration')");
    expect(page).toContain('onSelectPeripheral={selectPeripheral}');
    expect(page).toContain('peripheralName={viewPreferences.selectedPeripheral}');
    for (const component of ['PeripheralTree', 'PackageCanvas', 'SummaryDrawer']) {
      expect(page.match(new RegExp(`<${component}\\b`, 'g'))?.length, component).toBe(1);
    }
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

  it('renders only a name, status dot and inline mode label per row', () => {
    expect(tree).toContain('inlineModeLabel(name)');
    expect(tree).toContain('statusColor(status)');
    expect(tree).toContain('onSelectPeripheral(name)');
    expect(tree).not.toContain('togglePeripheral(');
    expect(tree).not.toContain('type="checkbox"');
    expect(tree).not.toContain('<select');
    expect(tree).not.toContain('PinTagPills');
  });

  it('sorts configured work first and keeps the catch-all count in its label', () => {
    expect(tree).toContain('partitionPeripherals(peripheralStatus, peripheralModes)');
    expect(tree).toContain('orderPeripheralNames(names, partition)');
    expect(tree).toContain("category.id === 'other'");
    expect(tree).toContain('category.label');
    expect(tree).toContain('${category.names.length}');
    expect(readSource('src/core/vendor-view.ts')).toContain("label: 'Other peripherals'");
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
