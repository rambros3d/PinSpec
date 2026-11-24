import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHeroDemoState } from '../src/core/hero-demo';
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
      'src/components/landing/HeroChipPreview.svelte',
    ];
    for (const site of sites) {
      const source = readSource(site);
      expect(source, site).toContain('formatMuxLabel');
      expect(source, site).not.toMatch(/AF\$\{/);
      expect(source, site).not.toContain("'AFIO'");
    }
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
});

describe('peripheral tree remaps and RP PIO panel', () => {
  it('offers remap options with register notes and supports pwm/pio categories', () => {
    const source = readSource('src/components/workspace/PeripheralTree.svelte');
    expect(source).toContain('pInfo.remaps && pInfo.remaps.length > 1');
    expect(source).toContain('registerNote');
    expect(source).toContain('summarizeRemapSignals');
    expect(source).toContain("kinds: ['pwm', 'pio']");
    expect(source).toContain('onRemapChange');
    expect(source).toContain('PinTagPills');
    expect(summarizeRemapSignals({ TX: 'PB6', RX: 'PB7' })).toBe('TX:PB6, RX:PB7');

    const ch32 = readChip('CH32V203C8T6');
    expect(ch32.peripherals.SPI1.remaps?.length).toBeGreaterThan(1);
    expect(ch32.peripherals.SPI1.remaps?.[1].registerNote).toBeTruthy();
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

describe('vendor-aware discovery, presets and hero', () => {
  it('builds vendor tabs with live per-source counts', () => {
    const tabs = buildVendorTabs(meta, index);
    expect(tabs.map((t) => t.id)).toEqual(['all', 'stm32', 'ch32', 'rp']);
    expect(tabs[1].count).toBe(meta.sources?.stm32?.chipCount);
    expect(tabs[2].count).toBe(meta.sources?.ch32?.chipCount);
    expect(tabs[3].count).toBe(meta.sources?.rp?.chipCount);
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
    for (const id of ['STM32G431CBU6', 'CH32V003J4M6', 'CH32V203C8T6', 'RP2040', 'RP2350B']) {
      expect(source).toContain(id);
    }
    expect(source).toContain('Cross-Vendor Starter Chips');
  });

  it('lazy-fetches one generated chip per hero vendor', () => {
    const page = readSource('src/pages/LandingPage.svelte');
    expect(page).toContain("const HERO_CHIP_ID = 'STM32G431CBU6'");
    expect(page).toContain('catalogStore.loadChip(HERO_CHIP_ID)');
    expect(page).toContain('HERO_CHIPS');
    expect(page).toContain('selectHeroVendor');
    expect(page).not.toMatch(/from\s+['"][^'"]*hero-chip\.json['"]/);

    const preview = readSource('src/components/landing/HeroChipPreview.svelte');
    expect(preview).toContain('onVendorChange');
    expect(preview).toContain('buildHeroDemoState');
    expect(preview).not.toContain("'TIM1', 'pwm_3phase_comp'");
  });

  it('builds demos from peripherals actually present on each vendor chip', () => {
    for (const id of ['STM32G431CBU6', 'CH32V203C8T6', 'RP2040', 'RP2350B']) {
      const chip = readChip(id);
      const demo = buildHeroDemoState(chip);
      expect(Object.keys(demo.assignments).length, id).toBeGreaterThan(0);
      for (const [pos, asgn] of Object.entries(demo.assignments)) {
        expect(chip.peripherals[asgn.peripheral], `${id}:${pos}`).toBeDefined();
      }
    }
    const rpChip = readChip('RP2350B');
    const rpDemo = buildHeroDemoState(rpChip);
    expect(rpDemo.mcuId).toBe('RP2350B');
    for (const pos of Object.keys(rpDemo.assignments)) {
      expect(rpChip.pins.some((pin) => pin.pos === pos)).toBe(true);
    }
  });
});

describe('export previews and provenance copy', () => {
  it('dispatches vendor-aware Rust labels in both export surfaces', () => {
    const modal = readSource('src/components/workspace/ExportModal.svelte');
    expect(modal).toContain('ch32-hal');
    expect(modal).toContain('embassy-rp');
    expect(modal).toContain('embassy-stm32');
    expect(modal).toContain('downloadFile');
    expect(modal).toContain('copyContent');

    const page = readSource('src/pages/LandingPage.svelte');
    expect(page).toContain('rustCrate');
    expect(page).toContain('downloadPreview');
  });

  it('contains no STM32-only claims and credits all three upstream sources', () => {
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
      'src/components/workspace/TopToolbar.svelte',
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

    const footer = readSource('src/pages/LandingPage.svelte');
    expect(footer).toContain('STMicroelectronics/STM32_open_pin_data');
    expect(footer).toContain('embassy-rs/stm32-data-generated');
    expect(footer).toContain('ch32-riscv-ug/ch32-device-data');
    expect(footer).toContain('raspberrypi/pico-sdk');
    expect(footer).toContain('Per-vendor chip counts and source revisions');
    expect(meta.sources?.stm32).toBeDefined();
    expect(meta.sources?.ch32).toBeDefined();
    expect(meta.sources?.rp).toBeDefined();
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

  it('preserves all four daisyUI themes', () => {
    const themes = readSource('src/themes/daisyui.css');
    for (const name of ['lofi', 'forest', 'caramellatte', 'halloween']) {
      expect(themes).toContain(`[data-theme="${name}"]`);
    }
  });
});
