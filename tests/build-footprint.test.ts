import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** daisyUI family name for each component class prefix used in markup. */
const USED_FAMILIES: Record<string, string> = {
  alert: 'alert',
  badge: 'badge',
  btn: 'button',
  card: 'card',
  checkbox: 'checkbox',
  dock: 'dock',
  drawer: 'drawer',
  indicator: 'indicator',
  input: 'input',
  kbd: 'kbd',
  label: 'label',
  loading: 'loading',
  menu: 'menu',
  modal: 'modal',
  select: 'select',
  table: 'table',
  tabs: 'tab',
  toggle: 'toggle',
};

function svelteSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return svelteSources(full);
    return entry.name.endsWith('.svelte') ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

describe('build footprint contract', () => {
  it('maps vendor packages to stable chunks', () => {
    const config = read('vite.config.ts');
    for (const token of [
      'manualChunks(id)',
      "id.includes('node_modules/@solar-icons')",
      "return 'icons'",
      "id.includes('node_modules/fflate')",
      "return 'codec'",
      "id.includes('node_modules/svelte/')",
      "id.includes('node_modules/@sveltejs/')",
      "return 'svelte'",
    ]) {
      expect(config, token).toContain(token);
    }
  });

  it('includes every daisyUI family used in markup with themes disabled', () => {
    const css = read('src/app.css');
    const plugin = css.match(/@plugin "daisyui" \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(plugin).toContain('themes: false');
    const markup = svelteSources(path.join(ROOT, 'src')).join('\n');
    for (const [token, family] of Object.entries(USED_FAMILIES)) {
      if (!new RegExp(`(?:^|[\\s"\`{])${token}(?:-[\\w]+)*(?=[\\s"\`}]|$)`).test(markup)) {
        continue;
      }
      expect(plugin, family).toMatch(new RegExp(`\\b${family}\\b`));
    }
  });

  it('keeps the required selectors in the generated stylesheet', () => {
    const assets = path.join(ROOT, 'dist', 'assets');
    if (!fs.existsSync(assets)) return;
    const cssFile = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
    if (!cssFile) return;
    const css = fs.readFileSync(path.join(assets, cssFile), 'utf8');
    for (const selector of [
      '.btn',
      '.badge',
      '.card',
      '.alert',
      '.modal-box',
      '.modal-backdrop',
      '.table',
      '.input',
      '.select',
    ]) {
      expect(css, selector).toContain(selector);
    }
  });
});
