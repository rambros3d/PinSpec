import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DAISYUI_OWNED_TOKENS,
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

/** Retired custom utilities that daisyUI component classes now replace. */
const RETIRED_UTILITIES = [
  'rounded-panel',
  'rounded-control',
  'rounded-pill',
  'rounded-mark',
  'rounded-top-control',
  'border-ui',
  'size-selector-dot',
  'size-ui',
  'bg-canvas',
  'bg-surface',
  'bg-elevated',
  'bg-subtle',
  'bg-action',
  'bg-danger',
  'bg-pin-',
  'text-muted',
  'text-faint',
  'text-hint',
  'text-pin-',
  'text-danger',
  'border-hairline',
  'border-strong',
  'border-hint',
];

describe('daisyUI token integration', () => {
  it('gives every actionable token a consumer, owned by daisyUI where appropriate', () => {
    const audit = auditThemeTokens();
    expect(audit.declared.length).toBe(28);
    expect(audit.daisyUIOwned).toEqual([...DAISYUI_OWNED_TOKENS]);
    expect(audit.unused).toEqual([...INTENTIONALLY_INERT_TOKENS]);
    expect(audit.previouslyUnusedStillUnused).toEqual([]);
    for (const token of DAISYUI_OWNED_TOKENS) {
      expect(audit.usage.find((item) => item.token === token)?.ownedByDaisyUI).toBe(true);
    }
    for (const token of PREVIOUSLY_UNUSED_TOKENS) {
      expect(DAISYUI_OWNED_TOKENS).toContain(token);
    }
    for (const token of INTENTIONALLY_INERT_TOKENS) {
      const usage = audit.usage.find((item) => item.token === token);
      expect(usage?.references ?? 0).toBe(0);
      expect(usage?.ownedByDaisyUI).toBe(false);
    }
  });

  it('registers all daisyUI families without built-in themes or startup logs', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src', 'app.css'), 'utf8');
    const plugin = css.match(/@plugin "daisyui" \{[\s\S]*?\}/)?.[0] ?? '';
    expect(plugin).toContain('themes: false');
    expect(plugin).toContain('logs: false');
    expect(plugin).toContain('rootcolor, rootscrolllock, rootscrollgutter');
    expect(plugin).not.toContain('include:');
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

  it('uses daisyUI component classes on the audited status and pending surfaces', () => {
    const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const about = read('src/pages/AboutPage.svelte');
    expect(about).toContain('tabs tabs-box w-fit');
    expect(about).not.toContain('tabs-boxed');

    for (const rel of [
      'src/pages/LandingPage.svelte',
      'src/pages/CatalogPage.svelte',
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/about/ProvenancePanel.svelte',
    ]) {
      expect(read(rel), rel).toContain('alert alert-soft alert-error');
    }

    const workspacePage = read('src/pages/WorkspacePage.svelte');
    expect(workspacePage).toContain('loading loading-spinner loading-lg text-info');
    expect(workspacePage).not.toContain('border-t-transparent');

    for (const rel of [
      'src/pages/CatalogPage.svelte',
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/about/ProvenancePanel.svelte',
      'src/pages/LandingPage.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/CompatibleMcuFinder.svelte',
    ]) {
      expect(read(rel), rel).toContain('loading loading-spinner loading-xs');
    }

    const summary = read('src/components/workspace/SummaryDrawer.svelte');
    expect(summary).toContain('class="alert alert-warning p-2.5 text-xs space-y-1"');
    expect(summary).toContain('class="card card-border bg-base-200 p-2.5 text-xs space-y-1"');
    expect(summary).not.toMatch(/class=\{`[^`]*card-card[^`]*\}/);
    expect(summary).not.toMatch(/class=\{`[^`]*card card-border[^`]*alert[^`]*\}/);
  });

  it('keeps the changed sidebar and shortcut dialog on theme tokens', () => {
    for (const rel of [
      'src/components/shell/GlobalSidebar.svelte',
      'src/components/workspace/ShortcutHelpDialog.svelte',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(source, rel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/);
      expect(source, rel).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      expect(source, rel).toContain('text-base-content');
    }
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
    expect(canvas).toContain('bg-base-100');
  });

  it('keeps rotated label text on theme utilities rather than literal colors', () => {
    for (const name of ['PerimeterPackage.svelte', 'GridPackage.svelte']) {
      const source = fs.readFileSync(
        path.join(ROOT, 'src', 'components', 'workspace', name),
        'utf8',
      );
      expect(source, name).toContain('localLabelAngle');
      expect(source, name).toContain('fill-base-content');
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('encodes tree status with theme tokens and no raw colors', () => {
    const tree = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'workspace', 'PeripheralTree.svelte'),
      'utf8',
    );
    for (const token of [
      'bg-success',
      'bg-warning',
      'bg-error',
      'bg-base-300',
      'bg-transparent',
      'border-success',
      'border-warning',
      'border-error',
      'border-base-content/50',
    ]) {
      expect(tree, token).toContain(token);
    }
    expect(tree).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const sidebar = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'workspace', 'CombinedSidebar.svelte'),
      'utf8',
    );
    expect(sidebar).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('maps status surfaces onto daisyUI status utilities', () => {
    const markup = sourceFiles()
      .filter((file) => /\.svelte$/.test(file) && file.includes(`${path.sep}src${path.sep}`))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    for (const token of [
      'badge-success',
      'badge-warning',
      'badge-error',
      'alert-success',
      'alert-warning',
      'alert-error',
      'bg-base-100',
    ]) {
      expect(markup, token).toContain(token);
    }
  });

  it('uses the renamed foreground utility without leaving the former name behind', () => {
    const markup = sourceFiles().filter(
      (file) => /\.svelte$/.test(file) && file.includes(`${path.sep}src${path.sep}`),
    );
    const all = markup.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(all).toContain('text-foreground');
    expect(all).not.toMatch(/\btext-primary\b(?!-)/);
    const css = fs.readFileSync(path.join(ROOT, 'src', 'app.css'), 'utf8');
    expect(css).toContain('@utility text-foreground');
    expect(css).not.toContain('@utility text-primary');
  });

  it('keeps retired custom shape, border, surface, and action utilities out of markup', () => {
    const markupDirs = [
      path.join(ROOT, 'src', 'components'),
      path.join(ROOT, 'src', 'pages'),
    ];
    const files: string[] = [];
    for (const dir of markupDirs) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          for (const nested of fs.readdirSync(path.join(dir, entry.name))) {
            if (nested.endsWith('.svelte')) files.push(path.join(dir, entry.name, nested));
          }
        } else if (entry.name.endsWith('.svelte')) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const utility of RETIRED_UTILITIES) {
        expect(source, `${path.basename(file)}: ${utility}`).not.toContain(utility);
      }
    }
  });
});
