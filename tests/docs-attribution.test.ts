import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Files touched by the multi-vendor gates and documentation change. */
const TOUCHED_FILES = [
  'README.md',
  'AGENTS.md',
  'index.html',
  '.github/workflows/deploy.yml',
  'src/core/types.ts',
  'src/core/vendor-view.ts',
  'src/core/exporters/embassy-rust.ts',
  'src/core/exporters/c-header.ts',
  'src/core/data-url.ts',
  'src/state/catalog.svelte.ts',
  'src/pages/LandingPage.svelte',
  'tools/data-gen/artifacts.ts',
  'tools/data-gen/gates.ts',
  'tools/data-gen/index.ts',
  'tools/data-gen/types.ts',
  'tools/data-gen/warnings.ts',
  'tools/data-gen/adapters/stm32.ts',
  'tools/data-gen/adapters/ch32.ts',
  'tools/data-gen/adapters/rp/index.ts',
  'tools/data-gen/adapters/esp32/index.ts',
  'tools/data-gen/adapters/esp32/gates.ts',
  'tools/data-gen/adapters/esp32/gpio-tool.ts',
  'tools/data-gen/adapters/esp32/metadata.ts',
  'tools/data-gen/adapters/esp32/kicad.ts',
  'tools/data-gen/adapters/esp32/esp-idf.ts',
  'tools/data-gen/adapters/esp32/join.ts',
  'tools/data-gen/adapters/esp32/modules.ts',
  'tools/data-gen/adapters/esp32/types.ts',
  'tools/data-gen/adapters/nordic/index.ts',
  'tools/data-gen/adapters/nordic/svd.ts',
  'tools/data-gen/adapters/nordic/zephyr.ts',
  'tools/data-gen/adapters/nordic/pinctrl.ts',
  'tools/data-gen/adapters/nordic/kicad.ts',
  'tools/data-gen/adapters/nordic/parts.ts',
  'tools/data-gen/adapters/nordic/gates.ts',
  'tools/data-gen/adapters/sam/index.ts',
  'tools/data-gen/adapters/sam/atdf.ts',
  'tools/data-gen/adapters/sam/gates.ts',
  'tools/data-gen/adapters/sam/sources.ts',
  'tools/data-gen/adapters/sam/variants.ts',
  'tools/data-gen/sources.ts',
  'tests/data-gen-esp32.test.ts',
  'tests/data-gen-sam.test.ts',
  'tests/data-gen-nordic.test.ts',
  'tests/gates-contracts.test.ts',
  'tests/subpath-contracts.test.ts',
  'tests/docs-attribution.test.ts',
  'src/core/hardware-audit.ts',
  'src/components/workspace/ExportModal.svelte',
  'src/components/workspace/CompatibleMcuFinder.svelte',
  'src/components/landing/PresetGrid.svelte',
  'src/components/workspace/HardwareAuditPanel.svelte',
  'src/components/workspace/SummaryDrawer.svelte',
  'tests/hardware-audit.test.ts',
  'tests/data-gen-ch32.test.ts',
];

const LICENSE_TOKENS = [
  'BSD-3-Clause',
  'MIT / Apache-2.0',
  'CC-BY-SA-4.0',
  'Apache-2.0',
];

const SOURCE_TOKENS = [
  'STMicroelectronics/STM32_open_pin_data',
  'embassy-rs/stm32-data-generated',
  'ch32-riscv-ug/ch32-device-data',
  'KiCad',
  'pico-sdk',
  'Zephyr',
  'raspberrypi/documentation',
  'espressif/esp-gpio-tool',
  'esp-rs/esp-hal',
  'espressif/kicad-libraries',
  'espressif/esp-idf',
  'Microchip-MPLAB-Harmony/dev_packs',
  'nrf-rs/nrf-pacs',
];

describe('multi-vendor documentation and attribution', () => {
  it('documents all sources, licenses, gates, and verification in README', () => {
    const readme = read('README.md');
    for (const token of [...SOURCE_TOKENS, ...LICENSE_TOKENS]) {
      expect(readme, token).toContain(token);
    }
    for (const command of [
      'npm run acquire-sources',
      'npm run gen-data',
      'npm test',
      'npm run check',
      'BASE_PATH="/pincraft/" npm run build',
    ]) {
      expect(readme, command).toContain(command);
    }
    expect(readme).toContain('build-warnings.json');
    expect(readme).toContain('ch32-device-data');
    expect(readme).toContain('evidence/pins.csv');
    expect(readme).toMatch(/no compatibility shim/i);
    expect(readme).toContain('pico-sdk');
    expect(readme).toContain('gate');
    expect(readme).toMatch(/daisyUI[^\n]*MIT/);
    expect(readme).toContain('text-foreground');
  });

  it('describes shipped multi-vendor behavior in AGENTS.md', () => {
    const agents = read('AGENTS.md');
    for (const token of SOURCE_TOKENS) expect(agents, token).toContain(token);
    expect(agents).toContain('multi-vendor-ci-gates');
    expect(agents).toContain('artifact-budget');
    expect(agents).toContain('shard-integrity');
    expect(agents).toContain('provenance');
    expect(agents).toContain('build-warnings.json');
    expect(agents).toContain('weekly');
    expect(agents).not.toContain('## Multi-vendor expansion (roadmap)');
  });

  it('renders all thirteen sources, licenses, and live metadata in the landing footer', () => {
    const footer = read('src/pages/LandingPage.svelte');
    for (const token of [...SOURCE_TOKENS, ...LICENSE_TOKENS]) {
      expect(footer, token).toContain(token);
    }
    expect(footer).toContain('Upstream data sources and licenses');
    expect(footer).toContain('catalogStore.meta');
    expect(footer).toContain('sources');
    expect(footer).toContain('microchip-atdf');
    expect(footer).toContain('nrf-pacs');
  });

  it('advertises all six vendors in the document metadata', () => {
    const html = read('index.html');
    expect(html).toContain('STM32 / CH32 / RP / ESP32 / Microchip SAM / Nordic');
    expect(html).toContain('CubeMX-style');
  });
});

describe('lint scans over touched files', () => {
  it('contains no emoji characters', () => {
    const offenders: string[] = [];
    for (const rel of TOUCHED_FILES) {
      const text = read(rel);
      if (/\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('introduces no raw color literals in UI markup', () => {
    const offenders: string[] = [];
    for (const rel of TOUCHED_FILES.filter((f) => f.endsWith('.svelte'))) {
      const text = read(rel);
      if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
