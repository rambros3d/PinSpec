import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../src/data/provenance';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('UX completion surfaces', () => {
  it('gives both package renderers keyboard-operable pins', () => {
    for (const file of [
      'src/components/workspace/PerimeterPackage.svelte',
      'src/components/workspace/GridPackage.svelte',
    ]) {
      const source = read(file);
      expect(source, file).toContain("pinKeyboardClick");
      expect(source, file).toContain('role="button"');
      expect(source, file).toContain('tabindex={isInteractive ? 0 : -1}');
      expect(source, file).toContain('aria-disabled={!isInteractive}');
      expect(source, file).toContain("e.key !== 'Enter' && e.key !== ' '");
      expect(source, file).toContain('onPinClick?.');
      expect(source, file).not.toContain('a11y_click_events_have_key_events');
    }
    const helper = read('src/state/pin-keyboard.ts');
    expect(helper).toContain('getBoundingClientRect()');
    expect(helper).toContain('new MouseEvent(');
    expect(helper).toContain('window.innerWidth / 2');
  });

  it('keeps portrait padding inside the single orientation media query', () => {
    const css = read('src/app.css');
    expect(css.match(/@media \(orientation: portrait\)/g)?.length).toBe(1);
    const portrait = css.slice(css.indexOf('@media (orientation: portrait)'));
    expect(portrait).toContain('.landing-shell > main,');
    expect(portrait).toContain('.shell-route > main');
    expect(portrait).toContain('padding-left: 1rem');
    expect(portrait).toContain('padding-right: 1rem');
    expect(read('src/pages/WorkspacePage.svelte')).not.toContain('matchMedia');
  });

  it('sorts catalog results and links each part directly', () => {
    const page = read('src/pages/CatalogPage.svelte');
    for (const token of [
      "import { sortCatalogEntries, type CatalogSortField }",
      "let sortBy = $state<CatalogSortField>('part')",
      'sortCatalogEntries(results, sortBy)',
      'aria-label="Sort catalog results"',
      '{#each sortedResults as entry (entry.id)}',
      'href={`#/mcu/${encodeURIComponent(entry.id)}`}',
      'Flash / RAM (KB)',
      "{entry.flashKb ?? '—'} / {entry.ramKb ?? '—'}",
    ]) {
      expect(page, token).toContain(token);
    }
    expect(read('src/state/discovery-preferences.svelte.ts')).not.toContain('sortBy');
    expect(read('src/core/exporters/json.ts')).not.toContain('sortBy');
    expect(read('src/core/url-state.ts')).not.toContain('sortBy');
    expect(read('src/core/catalog-sort.ts')).not.toContain('window');
  });

  it('adds project search, delete confirmation, and Save as', () => {
    const page = read('src/pages/ProjectsPage.svelte');
    for (const token of [
      'aria-label="Search recent projects"',
      '{#each filteredSessions as session (session.mcuId)}',
      'aria-label={`Confirm delete ${session.mcuId}`}',
      'aria-label={`Cancel delete ${session.mcuId}`}',
      'aria-label={`Save ${session.mcuId} as`}',
      'withProjectName(session.state, name)',
      'projectFileName(name, mcuId)',
    ]) {
      expect(page, token).toContain(token);
    }
    expect(page).not.toContain('onclick={() => deleteSession(session.mcuId)}');
  });

  it('states what Clear All resets and exposes shortcut metadata', () => {
    const bar = read('src/components/shell/WorkspaceTopBar.svelte');
    const nav = read('src/components/shell/GlobalNavBar.svelte');
    for (const token of [
      'Reset the full pin plan?',
      'Assignments, labels, locks, modes, remaps, and PIO bindings are cleared.',
      'aria-keyshortcuts="Control+K Meta+K"',
      'aria-keyshortcuts="Control+Z Meta+Z"',
      'aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z"',
      'top-[5.25rem]',
    ]) {
      expect(bar, token).toContain(token);
    }
    expect(nav).toContain('aria-keyshortcuts="Shift+Slash"');
    expect(read('src/components/workspace/PackageCanvas.svelte')).toContain(
      'aria-keyshortcuts="Control+F Meta+F"',
    );
    expect(read('src/state/workspace.svelte.ts')).toContain(
      "Cleared assignments, labels, locks, modes, remaps, and PIO bindings.",
    );
  });

  it('keeps the shortcut reference complete and the finder name consistent', () => {
    expect(SHORTCUTS.some((shortcut) => shortcut.keys === '?')).toBe(true);
    expect(SHORTCUTS.find((shortcut) => shortcut.keys === 'Ctrl+K')?.action).toBe(
      'Open the MCU switcher',
    );
    const bar = read('src/components/shell/WorkspaceTopBar.svelte');
    expect(bar).toContain('aria-label="Compatible MCUs"');
    expect(bar).toContain('>Compatible MCUs<');
    const finder = read('src/components/workspace/CompatibleMcuFinder.svelte');
    expect(finder).toContain('ariaLabel="Compatible MCUs"');
    expect(finder).toContain('backdropLabel="Close compatible MCUs"');
  });
});
