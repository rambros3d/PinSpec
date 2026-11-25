import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { thumbnailGeometryFromChip } from '../src/core/package-thumbnail';
import { formatMuxLabel } from '../src/core/types';
import {
  buildVendorTabs,
  catalogFamilies,
  catalogPackageKinds,
  formatGpioWindow,
  gpioNumberFromPinName,
  isGpioInWindows,
  summarizeRemapSignals,
} from '../src/core/vendor-view';
import { searchCatalogEntries } from '../src/state/catalog.svelte';
import type { CatalogIndexEntry, CatalogMeta, ChipData } from '../src/core/types';

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function readChip(id: string): ChipData {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'data', 'chips', `${id}.json`), 'utf8'),
  ) as ChipData;
}

const meta = JSON.parse(readSource('public/data/meta.json')) as CatalogMeta;
const index = JSON.parse(readSource('public/data/index.json')) as CatalogIndexEntry[];

describe('vendor-correct mux labels', () => {
  it('formats AF, FUNCSEL, remap and GPIO labels from the chip mux model', () => {
    const sig = { peripheral: 'SPI1', signal: 'SCK', af: 7, remapId: undefined };
    expect(formatMuxLabel(sig, 'af')).toBe('AF7');
    expect(formatMuxLabel(sig, 'funcsel-pio')).toBe('F7');
    expect(formatMuxLabel({ ...sig, af: null }, 'funcsel-pio')).toBe('PIO');
    expect(formatMuxLabel({ ...sig, af: null, remapId: 1 }, 'remap-group')).toBe('RM1');
    expect(formatMuxLabel({ ...sig, peripheral: 'GPIO', signal: 'Output' }, 'af')).toBe('Output');
    expect(formatMuxLabel({ ...sig, funcLabel: 'RM3' }, 'af')).toBe('RM3');
  });

  it('uses the shared helper in every UI mux-label site', () => {
    const sites = [
      'src/components/workspace/PackageCanvas.svelte',
      'src/components/workspace/PinPopover.svelte',
      'src/components/workspace/PinContextMenu.svelte',
      'src/components/workspace/SummaryDrawer.svelte',
      'src/components/workspace/PerimeterPackage.svelte',
      'src/components/workspace/GridPackage.svelte',
    ];
    for (const site of sites) {
      const source = readSource(site);
      expect(source, site).toContain('formatMuxLabel');
      expect(source, site).not.toMatch(/AF\$\{/);
      expect(source, site).not.toContain("'AFIO'");
    }
  });
});

describe('rotated vendor rendering contracts', () => {
  it('keeps vendor labels, bonded pads and exposed pads intact while rotating', () => {
    const perimeter = readSource('src/components/workspace/PerimeterPackage.svelte');
    const grid = readSource('src/components/workspace/GridPackage.svelte');
    for (const [name, source] of [
      ['perimeter', perimeter],
      ['grid', grid],
    ] as const) {
      expect(source, name).toContain('formatMuxLabel');
      expect(source, name).toContain('data-pin-pos=');
      expect(source, name).toContain('geometryTransform');
      expect(source, name).toContain('localLabelAngle');
    }
    expect(perimeter).toContain('twoSidedPackage');
    expect(perimeter).toContain('chip.package.hasExposedPad');
    expect(perimeter).toContain('bondedNames');
    expect(perimeter).toContain('stroke-dasharray={isBonded');
    expect(perimeter).toContain('tag && zoom >= 0.6');
    expect(perimeter).toContain('localLabelAngle(item.side, rotation)');
    expect(perimeter).not.toContain('-90 + counterRotation');
    expect(perimeter).not.toContain('rotate(${-90 + counterRotation} ${cx} ${cy})');
  });
});

describe('multi-vendor package rendering', () => {
  it('recognizes two-sided SOP packages and exposes the declared sides', () => {
    const source = readSource('src/components/workspace/PerimeterPackage.svelte');
    expect(source).toMatch(/twoSidedPackage/);
    expect(source).toMatch(/SOP\|SOIC\|SSOP\|DIP/);
    expect(source).toContain('chip.package.hasExposedPad');
    expect(source).toContain('bondedNames');
    expect(source).toContain('stroke-dasharray={isBonded');
    // Dense labels are suppressed at minimum zoom and restored when zoomed in.
    expect(source).toContain('tag && zoom >= 0.6');

    const sop8 = readChip('CH32V003J4M6');
    expect(sop8.package.name).toBe('SOP8');
    expect(sop8.package.sides?.[1]).toBe(0);
    expect(sop8.package.sides?.[2]).toBe(4);
    const tssop20 = readChip('CH32V003F4P6');
    expect(tssop20.package.name).toBe('TSSOP20');
    expect(tssop20.package.sides?.[1]).toBe(0);
    expect(tssop20.package.sides?.[2]).toBe(10);
    expect(sop8.pins.some((pin) => (pin.bondedNames?.length ?? 0) > 0)).toBe(true);
  });

  it('renders STM32 reference packages without changing four-sided layouts', () => {
    expect(readChip('STM32G431CBU6').package.sides).toEqual([12, 12, 12, 12]);
    expect(readChip('STM32H743XIH6').package.kind).toBe('grid');
    expect(readChip('RP2350B').package.hasExposedPad).toBe(true);
  });

  it('refines thumbnails from generated two-sided, grid and exposed-pad geometry', () => {
    const catalog = readSource('src/pages/CatalogPage.svelte');
    expect(catalog).toContain('thumbnailGeometryFromChip(');
    expect(catalog).toContain('catalogStore.loadChip(');
    const thumbnail = readSource('src/components/catalog/PackageThumbnail.svelte');
    expect(thumbnail).toContain('data-fidelity={geometry.fidelity}');
    expect(thumbnail).not.toContain('onclick=');

    for (const id of ['CH32V003J4M6', 'STM32H743XIH6', 'RP2350B']) {
      const chip = readChip(id);
      const geometry = thumbnailGeometryFromChip(chip);
      expect(geometry.kind).toBe(chip.package.kind);
      expect(geometry.fidelity).toBe('exact');
      expect(geometry.hasExposedPad).toBe(chip.package.hasExposedPad === true);
    }
    expect(readSource('src/components/workspace/PerimeterPackage.svelte')).toContain('twoSidedPackage');
    expect(readSource('src/components/workspace/GridPackage.svelte')).toContain('data-pin-pos=');
  });
});

describe('peripheral configuration detail and RP PIO panel', () => {
  it('offers remap options with register notes in the sidebar detail surface', () => {
    const sidebar = readSource('src/components/workspace/CombinedSidebar.svelte');
    expect(sidebar).toContain('<PeripheralDetail');
    expect(readSource('src/components/workspace/SummaryDrawer.svelte')).not.toContain(
      '<PeripheralDetail',
    );
    const detail = readSource('src/components/workspace/PeripheralDetail.svelte');
    expect(detail).toContain('pInfo.remaps && pInfo.remaps.length > 1');
    expect(detail).toContain('registerNote');
    expect(detail).toContain('summarizeRemapSignals');
    expect(detail).toContain('onRemapChange');
    expect(detail).toContain('PinTagPills');
    expect(summarizeRemapSignals({ TX: 'PB6', RX: 'PB7' })).toBe('TX:PB6, RX:PB7');

    const categories = readSource('src/core/vendor-view.ts');
    expect(categories).toContain("kinds: ['pwm', 'pio']");
    expect(categories).toContain("label: 'Others'");

    const ch32 = readChip('CH32V203C8T6');
    expect(ch32.peripherals.SPI1.remaps?.length).toBeGreaterThan(1);
    expect(ch32.peripherals.SPI1.remaps?.[1].registerNote).toBeTruthy();
  });

  it('keeps the compact tree free of inline editing controls', () => {
    const tree = readSource('src/components/workspace/PeripheralTree.svelte');
    expect(tree).toContain('onSelectPeripheral');
    expect(tree).toContain('peripheralStatus');
    expect(tree).not.toContain('pInfo.remaps && pInfo.remaps.length > 1');
    expect(tree).not.toContain('registerNote');
    expect(tree).not.toContain('summarizeRemapSignals');
    expect(tree).not.toContain('onRemapChange');
    expect(tree).not.toContain('PinTagPills');
    expect(tree).not.toContain('type="checkbox"');
    expect(tree).not.toContain('<select');
  });

  it('shows both RP2350B GPIOBASE windows and flags out-of-window pins', () => {
    const source = readSource('src/components/workspace/PioPanel.svelte');
    expect(source).toContain('formatGpioWindow');
    expect(source).toContain('isGpioInWindows');
    expect(source).toContain('PIO_GPIOBASE_CONFLICT');
    expect(source).toContain('Outside every GPIOBASE window');

    expect(formatGpioWindow(0)).toBe('GPIO0-31');
    expect(formatGpioWindow(16)).toBe('GPIO16-47');
    expect(gpioNumberFromPinName('GPIO16')).toBe(16);
    expect(gpioNumberFromPinName('PA1')).toBeNull();
    expect(isGpioInWindows(47, [0, 16])).toBe(true);
    expect(isGpioInWindows(48, [0, 16])).toBe(false);
    expect(isGpioInWindows(16, [0])).toBe(true);

    const rp2350b = readChip('RP2350B');
    expect(rp2350b.pio?.gpioBaseOptions).toEqual([0, 16]);
    expect(rp2350b.pio?.instances).toEqual(['PIO0', 'PIO1', 'PIO2']);
  });
});

describe('vendor-aware discovery and presets', () => {
  it('builds vendor tabs with live per-source counts', () => {
    const tabs = buildVendorTabs(meta, index);
    expect(tabs.map((t) => t.id)).toEqual(['all', 'stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic']);
    expect(tabs[1].count).toBe(meta.sources?.stm32?.chipCount);
    expect(tabs[2].count).toBe(meta.sources?.ch32?.chipCount);
    expect(tabs[3].count).toBe(meta.sources?.rp?.chipCount);
    expect(tabs[4].count).toBe(meta.sources?.esp32?.chipCount);
    expect(tabs[5].count).toBe(meta.sources?.microchip?.chipCount);
    expect(tabs[6].count).toBe(meta.sources?.nordic?.chipCount);
  });

  it('filters the generated index by vendor, family and package', () => {
    const rp = searchCatalogEntries(index, '', { vendor: 'rp' }, 500);
    expect(rp.length).toBeGreaterThan(0);
    expect(rp.every((e) => e.vendor === 'rp')).toBe(true);

    const rp2350 = searchCatalogEntries(index, '', { vendor: 'rp', family: 'RP2350' }, 500);
    expect(rp2350.length).toBeGreaterThan(0);
    expect(rp2350.every((e) => e.family.includes('RP2350'))).toBe(true);

    const sop = searchCatalogEntries(index, '', { vendor: 'ch32', packageKind: 'SOP' }, 500);
    expect(sop.length).toBeGreaterThan(0);
    expect(sop.every((e) => e.vendor === 'ch32' && e.package.includes('SOP'))).toBe(true);

    expect(searchCatalogEntries(index, '', { vendor: 'all' }, 3).length).toBe(3);
    expect(catalogFamilies(index)).toContain('RP2350');
    expect(catalogPackageKinds(index)).toContain('SOP');
  });

  it('exposes vendor tabs in both discovery surfaces', () => {
    for (const site of [
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
    ]) {
      const source = readSource(site);
      expect(source, site).toContain('buildVendorTabs');
      expect(source, site).toContain('vendorFilter');
      expect(source, site).toContain('familyOptions');
      expect(source, site).toMatch(/packageOptions|pkgOptions/);
    }
  });

  it('uses cross-vendor presets', () => {
    const source = readSource('src/components/landing/PresetGrid.svelte');
    for (const id of [
      'STM32G431CBU6',
      'CH32V003J4M6',
      'CH32V203C8T6',
      'RP2040',
      'RP2350B',
      'ESP32-C3FH4',
      'ESP32-WROOM-E',
    ]) {
      expect(source).toContain(id);
    }
    expect(source).toContain('Cross-Vendor Starter Chips');
  });

});

describe('generated module identity and discovery tags', () => {
  it('marks module shards and compact index entries from generated data', () => {
    const wroom = readChip('ESP32-WROOM-E');
    expect(wroom.module).toEqual({
      kind: 'module',
      name: 'ESP32-WROOM-E',
      baseFamily: 'esp32',
      symbol: 'ESP32-WROOM-E',
    });
    expect(index.find((entry) => entry.id === 'ESP32-WROOM-E')?.module).toBe(true);
    for (const dieId of ['ESP32-C3', 'ESP32-C3FH4']) {
      expect(readChip(dieId)).not.toHaveProperty('module');
      expect(index.find((entry) => entry.id === dieId)).not.toHaveProperty('module');
    }
  });

  it('decorates module packages without changing pad geometry or handlers', () => {
    const source = readSource('src/components/workspace/PerimeterPackage.svelte');
    expect(source).toContain("chip.module?.kind === 'module'");
    expect(source).toContain('chip.module?.name ??');
    expect(source).toContain('stroke-dasharray="4 3"');
    expect(source).toContain('pointer-events="none"');
    expect(source).toContain('data-pin-pos={item.pin.pos}');
    expect(source).toContain('onclick={(e) =>');
    expect(source).toContain('oncontextmenu={(e) =>');
    expect(source).toContain('onmouseenter={(e) => onPinHover?.(item.pin, e)}');
  });

  it('shows a compact MODULE tag from the catalog marker in every discovery surface', () => {
    for (const site of [
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/CompatibleMcuFinder.svelte',
      'src/components/landing/PresetGrid.svelte',
    ]) {
      const source = readSource(site);
      expect(source, site).toContain('MODULE');
      expect(source, site).toContain('badge-outline');
    }
    expect(readSource('src/components/landing/QuickSearchBar.svelte')).toContain('{#if entry.module}');
    expect(readSource('src/components/workspace/McuSwitcherModal.svelte')).toContain(
      '{#if entry.module}',
    );
    expect(readSource('src/components/workspace/CompatibleMcuFinder.svelte')).toContain(
      'moduleIds.has(score.mcuId.toUpperCase())',
    );
    const preset = readSource('src/components/landing/PresetGrid.svelte');
    expect(preset).toContain('moduleIds.has(item.id.toUpperCase())');
    expect(preset).not.toContain('module: true');
    const landing = readSource('src/pages/LandingPage.svelte');
    expect(landing).toContain('moduleIds={moduleIds}');
    expect(landing).toContain('entry.module');
    // Vendor tabs, family/package filters and navigation remain unchanged.
    expect(readSource('src/components/landing/QuickSearchBar.svelte')).toContain('buildVendorTabs');
    expect(readSource('src/components/workspace/McuSwitcherModal.svelte')).toContain('vendorFilter');
  });

  it('keeps the vendor-filtered MCU switcher reachable from the global bar', () => {
    const bar = readSource('src/components/shell/GlobalTopBar.svelte');
    expect(bar).toContain('topBarUI.switcherOpen = true');
    expect(bar).toContain('workspaceStore.chip.id');
    const workspace = readSource('src/pages/WorkspacePage.svelte');
    expect(workspace).toContain('<McuSwitcherModal');
    expect(workspace).toContain('topBarUI.switcherOpen');
  });
});

describe('workspace exports and provenance copy', () => {
  it('dispatches vendor-aware Rust labels in the workspace export modal', () => {
    const modal = readSource('src/components/workspace/ExportModal.svelte');
    expect(modal).toContain('ch32-hal');
    expect(modal).toContain('embassy-rp');
    expect(modal).toContain('embassy-stm32');
    expect(modal).toContain('esp-hal');
    expect(modal).toContain('downloadFile');
    expect(modal).toContain('copyContent');
  });

  it('contains no STM32-only claims and credits all twelve upstream sources', () => {
    const stm32OnlyClaims = [
      'Fast STM32 pinout planning',
      'Jump to STM32 MCU',
      'Switch STM32 MCU',
      'Loading STM32 catalog',
      'No STM32 parts matched',
      'requested STM32 part',
      'major STM32 families',
    ];
    for (const site of [
      'src/pages/LandingPage.svelte',
      'src/pages/WorkspacePage.svelte',
      'src/components/shell/GlobalTopBar.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/ExportModal.svelte',
      'src/components/landing/PresetGrid.svelte',
      'src/components/landing/QuickSearchBar.svelte',
    ]) {
      const source = readSource(site);
      for (const claim of stm32OnlyClaims) {
        expect(source, `${site}: ${claim}`).not.toContain(claim);
      }
    }

    const provenance = readSource('src/data/provenance.ts');
    for (const source of [
      'STMicroelectronics/STM32_open_pin_data',
      'embassy-rs/stm32-data-generated',
      'ch32-riscv-ug/ch32-device-data',
      'raspberrypi/pico-sdk',
      'espressif/esp-gpio-tool',
      'esp-rs/esp-hal',
      'espressif/kicad-libraries',
      'espressif/esp-idf',
      'Microchip-MPLAB-Harmony/dev_packs',
    ]) {
      expect(provenance, source).toContain(source);
    }
    expect(readSource('src/components/about/ProvenancePanel.svelte')).toContain(
      'Catalog sources',
    );
    expect(readSource('src/pages/LandingPage.svelte')).not.toContain('id="provenance"');
    expect(meta.sources?.stm32).toBeDefined();
    expect(meta.sources?.ch32).toBeDefined();
    expect(meta.sources?.rp).toBeDefined();
    expect(meta.sources?.esp32).toBeDefined();
    expect(meta.sources?.microchip).toBeDefined();
  });
});

describe('pinout diff modal contract', () => {
  it('provides two file inputs with independent load and error states', () => {
    const source = readSource('src/components/workspace/PinoutDiffModal.svelte');
    expect(source.match(/type="file"/g)?.length).toBe(2);
    expect(source).toContain("'idle'");
    expect(source).toContain("'loading'");
    expect(source).toContain("'ready'");
    expect(source).toContain("'error'");
    expect(source).toContain('parsePinoutJson');
    expect(source).toContain('unsupported-format');
    expect(source).not.toContain('workspaceStore');
  });
});

describe('theme and color safety', () => {
  it('keeps raw color literals only in the daisyUI theme file', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(svelte|css|ts)$/.test(entry.name)) files.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    const pattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|hsla?\(/;
    const offenders = files.filter(
      (file) =>
        !file.endsWith(path.join('themes', 'daisyui.css')) && pattern.test(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('preserves exactly the two vendored daisyUI themes', () => {
    const themes = readSource('src/themes/daisyui.css');
    for (const name of ['fantasy', 'halloween']) {
      expect(themes).toContain(`[data-theme="${name}"]`);
    }
    expect(themes.match(/\[data-theme="[^"]+"\]/g)).toEqual([
      '[data-theme="fantasy"]',
      '[data-theme="halloween"]',
    ]);
    for (const removed of ['lofi', 'forest', 'caramellatte']) {
      expect(themes).not.toContain(removed);
    }
  });
});
