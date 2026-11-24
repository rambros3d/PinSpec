import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTENTIONALLY_INERT_TOKENS,
  PREVIOUSLY_UNUSED_TOKENS,
  auditThemeTokens,
} from '../tools/theme-token-audit';

const ROOT = process.cwd();

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (target: string): void => {
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      if (/\.(ts|svelte|css)$/.test(target) || target.endsWith('.html')) files.push(target);
      return;
    }
    for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
  };
  walk(path.join(ROOT, 'src'));
  files.push(path.join(ROOT, 'index.html'));
  walk(path.join(ROOT, 'tools'));
  walk(path.join(ROOT, 'tests'));
  return files;
}

describe('daisyUI token integration', () => {
  it('gives every actionable previously unused token a consumer', () => {
    const audit = auditThemeTokens();
    expect(audit.declared.length).toBe(28);
    expect(audit.previouslyUnusedStillUnused).toEqual([]);
    for (const token of PREVIOUSLY_UNUSED_TOKENS) {
      expect(audit.usage.find((item) => item.token === token)?.references ?? 0).toBeGreaterThan(0);
    }
    for (const token of INTENTIONALLY_INERT_TOKENS) {
      expect(audit.usage.find((item) => item.token === token)?.references ?? 0).toBe(0);
    }
  });

  it('keeps raw color literals confined to the vendored theme file', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.endsWith(path.join('src', 'themes', 'daisyui.css')))
      .filter((file) =>
        /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/.test(fs.readFileSync(file, 'utf8')),
      );
    expect(offenders).toEqual([]);
  });

  it('contains no emoji characters in delivered source', () => {
    const offenders = sourceFiles().filter((file) =>
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('scopes texture effects to the two package renderers', () => {
    const files = sourceFiles().filter((file) => /\.svelte$/.test(file));
    const textured = files.filter((file) => /feTurbulence/.test(fs.readFileSync(file, 'utf8')));
    expect(textured.map((file) => path.basename(file)).sort()).toEqual([
      'GridPackage.svelte',
      'PerimeterPackage.svelte',
    ]);
    const src = files.map((file) => fs.readFileSync(file, 'utf8'));
    expect(src.some((text) => /--depth|--noise/.test(text))).toBe(false);
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'workspace', 'PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('bg-mcu-canvas');
  });
});
