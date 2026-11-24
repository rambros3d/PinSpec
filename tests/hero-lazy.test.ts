import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('no hero snapshot on the start screen', () => {
  it('does not import a committed hero snapshot or render a hero preview', () => {
    const page = read('src/pages/LandingPage.svelte');
    expect(page).not.toMatch(/from\s+['"][^'"]*hero-chip\.json['"]/);
    expect(page).not.toContain('heroChipRaw');
    expect(page).not.toContain('HeroChipPreview');
    expect(page).not.toContain('buildHeroDemoState');
    expect(fs.existsSync(path.join(ROOT, 'src', 'data', 'hero-chip.json'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src', 'core', 'hero-demo.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src', 'components', 'landing', 'HeroChipPreview.svelte'))).toBe(
      false,
    );
  });

  it('fetches chip data relative to the GitHub Pages base path', () => {
    const store = read('src/state/catalog.svelte.ts');
    expect(store).toContain('import.meta.env.BASE_URL');
    expect(store).toContain('chips/${encodeURIComponent(key)}.json');
    expect(store).not.toMatch(/fetch\(['"]\/data\//);
  });

  it('does not recreate the hero snapshot during generation', () => {
    const generatorSource = read('tools/data-gen/index.ts');
    expect(generatorSource).not.toContain('hero-chip.json');
  });
});
