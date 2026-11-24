import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('lazy hero chip data', () => {
  it('does not statically import a committed hero snapshot', () => {
    const page = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LandingPage.svelte'), 'utf8');
    expect(page).not.toMatch(/from\s+['"][^'"]*hero-chip\.json['"]/);
    expect(page).not.toContain('heroChipRaw');
    expect(page).toContain("const HERO_CHIP_ID = 'STM32G431CBU6'");
    expect(page).toContain('catalogStore.loadChip(HERO_CHIP_ID)');
    expect(page).toContain('$state<ChipData | null>');
    expect(fs.existsSync(path.join(ROOT, 'src', 'data', 'hero-chip.json'))).toBe(false);
  });

  it('fetches chip data relative to the GitHub Pages base path', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'catalog.svelte.ts'), 'utf8');
    expect(store).toContain('import.meta.env.BASE_URL');
    expect(store).toContain('chips/${encodeURIComponent(key)}.json');
    expect(store).not.toMatch(/fetch\(['"]\/data\//);
  });

  it('does not recreate the hero snapshot during generation', () => {
    const generatorSource = fs.readFileSync(
      path.join(ROOT, 'tools', 'data-gen', 'index.ts'),
      'utf8',
    );
    expect(generatorSource).not.toContain('hero-chip.json');
  });
});
