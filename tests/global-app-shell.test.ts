import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/state/router.svelte';
import { topBarUI } from '../src/state/top-bar-ui.svelte';
import { createEmptyWorkspace } from '../src/core/solver';
import { exportPinoutJson } from '../src/core/exporters/json';
import { encodeWorkspaceState } from '../src/core/url-state';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('global shell mount and routes', () => {
  const app = read('src/App.svelte');

  it('mounts exactly one shell around all six route bodies', () => {
    expect(app.match(/<AppShell>/g)?.length).toBe(1);
    expect(app.match(/<\/AppShell>/g)?.length).toBe(1);
    for (const page of ['LandingPage', 'CatalogPage', 'ProjectsPage', 'AboutPage', 'WorkspacePage']) {
      expect(app, page).toContain(`<${page}`);
    }
    expect(app.match(/<WorkspacePage\b/g)?.length).toBe(2);
    const shell = read('src/components/shell/AppShell.svelte');
    expect(shell.match(/<GlobalNavBar\s*\/>/g)?.length).toBe(1);
    expect(shell).toContain('{#if isWorkspaceView}');
    expect(shell.match(/<WorkspaceTopBar\s*\/>/g)?.length).toBe(1);
    expect(shell).toContain('<ShortcutHelpDialog');
    expect(shell.match(/<PinoutDiffModal/g)?.length).toBe(1);
  });

  it('resolves every hash route and keeps unknown hashes on home', () => {
    expect(parseHash('#/')).toEqual({ view: 'landing' });
    expect(parseHash('#/catalog')).toEqual({ view: 'catalog' });
    expect(parseHash('#/projects')).toEqual({ view: 'projects' });
    expect(parseHash('#/about')).toEqual({ view: 'about' });
    expect(parseHash('#/mcu/RP2040')).toEqual({ view: 'workspace', mcuId: 'RP2040' });
    expect(parseHash('#/s/payload')).toEqual({ view: 'shared', payload: 'payload' });
    expect(parseHash('#/elsewhere')).toEqual({ view: 'landing' });
    const router = read('src/state/router.svelte.ts');
    for (const helper of ['navigateHome', 'navigateCatalog', 'navigateProjects', 'navigateAbout']) {
      expect(router, helper).toContain(helper);
    }
  });
});

describe('thin global navigation bar', () => {
  const nav = read('src/components/shell/GlobalNavBar.svelte');
  const shell = read('src/components/shell/AppShell.svelte');

  it('mounts one h-8 bar with route-specific product identity', () => {
    expect(nav).toContain('global-nav-bar relative flex h-8 shrink-0');
    expect(shell).toContain('<GlobalNavBar />');
    expect(nav).toContain('radiokit-logo.svg');
    expect(nav).toContain('>PinSpec<');
    expect(nav).not.toContain('routeTitle');
    for (const file of [
      'src/pages/LandingPage.svelte',
      'src/pages/CatalogPage.svelte',
      'src/pages/ProjectsPage.svelte',
      'src/pages/AboutPage.svelte',
      'src/pages/WorkspacePage.svelte',
    ]) {
      expect(read(file), file).not.toContain('class="navbar');
    }
    expect(read('src/pages/WorkspacePage.svelte')).not.toContain('TopToolbar');
    expect(fs.existsSync(path.join(ROOT, 'src/components/workspace/TopToolbar.svelte'))).toBe(false);
  });

  it('orders the sections, centered workspace, and resources', () => {
    expect(nav.indexOf("id: 'home'")).toBeLessThan(nav.indexOf("id: 'projects'"));
    expect(nav.indexOf("id: 'projects'")).toBeLessThan(nav.indexOf("id: 'catalog'"));
    expect(nav).toContain('absolute left-1/2 -translate-x-1/2');
    expect(nav).toContain('aria-label="Resources"');
    expect(nav).toContain('aria-label="Workspace"');
    expect(nav).toContain('aria-label="About"');
    expect(nav).toContain('aria-label="PinSpec repository on GitHub"');
    expect(nav).toContain('aria-label="Keyboard shortcuts"');
    expect(nav).toContain('<ThemePicker compact={true} />');
    const workspace = nav.indexOf('aria-label="Workspace"');
    const about = nav.indexOf('aria-label="About"');
    const github = nav.indexOf('aria-label="PinSpec repository on GitHub"');
    const hotkeys = nav.indexOf('aria-label="Keyboard shortcuts"');
    const theme = nav.indexOf('<ThemePicker compact={true} />');
    expect(workspace).toBeLessThan(about);
    expect(github).toBeGreaterThan(about);
    expect(hotkeys).toBeGreaterThan(github);
    expect(theme).toBeGreaterThan(hotkeys);
    expect(nav.match(/class="hidden sm:inline"/g)?.length).toBe(4);
    expect(nav).not.toContain('overflow-x-auto');
    expect(nav).toContain('justify-between gap-1');
    expect(nav).toContain('min-w-0');
  });

  it('marks the active section with aria-current on every route', () => {
    expect(nav).toContain("if (view === 'landing') return 'home'");
    expect(nav).toContain("if (view === 'workspace' || view === 'shared') return 'workspace'");
    expect(nav.match(/aria-current=\{activeSection === entry\.id \? 'page' : undefined\}/g)?.length).toBe(1);
    expect(nav).toContain('{#if !isWorkspace}');
    expect(nav).toContain('absolute left-1/2 -translate-x-1/2');
    expect(nav).toContain("aria-current={activeSection === 'about' ? 'page' : undefined}");
    expect(nav).toContain('router.navigateHome()');
    expect(nav).toContain('router.navigateCatalog()');
    expect(nav).toContain('router.navigateProjects()');
    expect(nav).toContain('router.navigateAbout()');
  });

  it('opens About through an accessible info icon without duplicating its content', () => {
    expect(nav).toContain("import Info from '@solar-icons/svelte/bold-duotone/info-circle'");
    expect(nav).toContain('<Info class={iconClass(\'about\')} />');
    expect(nav).toContain('title="About"');
    expect(nav).toContain('aria-label="About"');
    expect(nav).toContain('router.navigateAbout()');
    expect(read('src/pages/AboutPage.svelte')).toContain('<ProvenancePanel');
  });

  it('links the repository with an inline SVG and safe anchor attributes', () => {
    expect(nav).toContain('href="https://github.com/rambros3d/PinSpec"');
    expect(nav).toContain('target="_blank"');
    expect(nav).toContain('rel="noopener noreferrer"');
    expect(nav).toContain('aria-label="PinSpec repository on GitHub"');
    expect(nav).toContain('title="PinSpec repository on GitHub"');
    expect(nav).toContain('<svg');
    expect(nav).toContain('aria-hidden="true"');
    expect(nav).not.toContain('@solar-icons/svelte/bold-duotone/github');
  });

  it('opens the shared help dialog without a route or persisted state', () => {
    expect(nav).toContain('topBarUI.shortcutHelpOpen = true');
    expect(nav).toContain('aria-keyshortcuts="Shift+Slash"');
    expect(nav).not.toContain("'#/hotkeys'");
    expect(shell).toContain("topBarUI.activeDialog === 'shortcutHelp'");
    expect(shell).toContain('ShortcutHelpDialog');
  });

  it('derives the Workspace target and disables it when no chip or session exists', () => {
    expect(nav).toContain('workspaceStore.chip?.id');
    expect(nav).toContain('workspaceStore.recentSessions[0]?.mcuId');
    expect(nav).toContain('router.navigateMcu(workspaceTarget)');
    expect(nav).toContain('void workspaceStore.openMcu(workspaceTarget)');
    expect(nav).toContain('href={`#/mcu/${workspaceTarget}`}');
    expect(nav).toContain('disabled');
    expect(nav).toContain('title="Open a part first to enable the workspace"');
    expect(nav).toContain('cursor-not-allowed opacity-40');
  });

  it('does not list recent sessions or session actions in the shell', () => {
    expect(nav).not.toContain('Recent projects');
    expect(nav).not.toContain('reviewRecent');
    expect(nav).not.toContain('deleteRecent');
    expect(nav).not.toContain('workspaceStore.recentSessions.slice');
    expect(nav).not.toContain('Delete session');
    expect(shell).not.toContain('Recent projects');
    expect(read('src/pages/ProjectsPage.svelte')).toContain('workspaceStore.deleteRecentSession(mcuId)');
  });
});

describe('workspace action bar', () => {
  const bar = read('src/components/shell/WorkspaceTopBar.svelte');
  const shell = read('src/components/shell/AppShell.svelte');

  it('is mounted once by the shell only on workspace and shared routes', () => {
    expect(bar).toContain('global-top-bar h-12 shrink-0');
    expect(bar).toContain('aria-label="Workspace actions"');
    expect(shell).toContain('const isWorkspaceView = $derived(');
    expect(shell).toContain('{#if isWorkspaceView}');
    expect(shell.match(/<WorkspaceTopBar\s*\/>/g)?.length).toBe(1);
    for (const file of [
      'src/pages/LandingPage.svelte',
      'src/pages/CatalogPage.svelte',
      'src/pages/ProjectsPage.svelte',
      'src/pages/AboutPage.svelte',
      'src/pages/WorkspacePage.svelte',
    ]) {
      expect(read(file), file).not.toContain('class="navbar');
    }
  });

  it('owns every pin-planning action and the scroll affordance', () => {
    for (const token of [
      'topBarUI.switcherOpen = true',
      'workspaceStore.undo()',
      'workspaceStore.redo()',
      'workspaceStore.clearAll()',
      'topBarUI.finderOpen = true',
      'topBarUI.diffOpen = true',
      'handleShare()',
      'topBarUI.exportOpen = true',
      'overflow-x-auto',
      'min-w-0',
      'shouldShowScrollAffordance',
      'onscroll={updateScrollHint}',
    ]) {
      expect(bar, token).toContain(token);
    }
    expect(bar).not.toContain('topBarUI.shortcutHelpOpen = true');
    expect(bar.match(/<ThemePicker compact=\{true\} \/>/g)?.length ?? 0).toBe(0);
    const state = read('src/state/top-bar-ui.svelte.ts');
    for (const field of [
      'switcherOpen',
      'exportOpen',
      'finderOpen',
      'diffOpen',
      'shortcutHelpOpen',
      'focusSearch',
    ]) {
      expect(state, field).toContain(field);
    }
    expect(state).toContain('Nothing here is persisted');
  });

  it('shows an inline-editable project name at the left edge before the MCU pill', () => {
    expect(bar).toContain("workspaceStore.state.projectName ?? 'Unnamed project'");
    for (const hook of [
      'aria-label="Rename project"',
      'aria-label="Project name"',
      'beginNameEdit()',
      'workspaceStore.renameProject(nameDraft)',
      'cancelNameEdit()',
      'onblur={commitName}',
      'e.stopPropagation()',
      "e.key === 'Enter'",
      "e.key === 'Escape'",
    ]) {
      expect(bar, hook).toContain(hook);
    }
    expect(bar).not.toContain('const routeTitle');
    const title = bar.indexOf("workspaceStore.state.projectName ?? 'Unnamed project'");
    const mcu = bar.indexOf('title="Switch MCU (Ctrl+K)"');
    const undo = bar.indexOf('aria-label="Undo"');
    expect(title).toBeGreaterThan(-1);
    expect(title).toBeLessThan(mcu);
    expect(mcu).toBeLessThan(undo);
  });

  it('leaves pin search to the canvas HUD and the theme picker to the navigation bar', () => {
    for (const token of ['workspaceStore.globalSearch', 'searchInputRef', 'topBarUI.focusSearch']) {
      expect(bar, token).not.toContain(token);
    }
    const canvas = read('src/components/workspace/PackageCanvas.svelte');
    for (const token of [
      'workspaceStore.globalSearch',
      'workspaceStore.searchMatchingPins.length',
      'topBarUI.focusSearch = () =>',
      'searchInputRef?.select()',
      'aria-label="Find pin or signal"',
      'data-placement-furniture',
    ]) {
      expect(canvas, token).toContain(token);
    }
    const actions = bar.slice(bar.indexOf('class="ml-auto flex shrink-0 items-center gap-1"'));
    expect(actions).toContain('aria-label="Undo"');
    expect(actions.indexOf('aria-label="Undo"')).toBeLessThan(
      actions.indexOf('topBarUI.exportOpen = true'),
    );
    expect(actions).not.toContain('Rotate package clockwise');
    expect(read('src/components/shell/GlobalNavBar.svelte')).toContain('<ThemePicker compact={true} />');
  });

  it('anchors the Clear All confirmation below both bars with its full-reset copy', () => {
    expect(bar).toContain('top-20');
    expect(bar).toContain('Reset the full pin plan?');
    expect(bar).toContain(
      'Assignments, labels, locks, modes, remaps, and PIO bindings are cleared. You can undo with Ctrl+Z.',
    );
    expect(bar).toContain('aria-label="Clear all assignments"');
    expect(bar).not.toContain('top-12 z-50');
  });

  it('keeps the help dialog owned by the shell and the other dialogs owned by the workspace', () => {
    expect(shell).toContain('<ShortcutHelpDialog');
    expect(shell).toContain("topBarUI.activeDialog === 'shortcutHelp'");
    expect(read('src/pages/WorkspacePage.svelte')).toContain('<McuSwitcherModal');
    expect(read('src/pages/WorkspacePage.svelte')).toContain('topBarUI.exportOpen');
    expect(bar).not.toContain("'#/about'");
  });

  it('backs every dialog flag with one typed active dialog', () => {
    const store = read('src/state/top-bar-ui.svelte.ts');
    expect(store).toContain("export type DialogKind = 'switcher' | 'export' | 'finder' | 'diff' | 'shortcutHelp';");
    expect(store).toContain('activeDialog = $state<DialogKind | null>(null)');
    for (const name of ['switcher', 'export', 'finder', 'diff', 'shortcutHelp']) {
      expect(store, name).toContain(`get ${name}Open()`);
      expect(store, name).toContain(`set ${name}Open(`);
    }
    expect(store).toContain('this.activeDialog = null');
  });

  it('keeps one dialog active and clears flags through the shared owner', () => {
    topBarUI.reset();
    expect(topBarUI.activeDialog).toBeNull();
    topBarUI.diffOpen = true;
    expect(topBarUI.activeDialog).toBe('diff');
    expect(topBarUI.diffOpen).toBe(true);
    topBarUI.shortcutHelpOpen = true;
    expect(topBarUI.activeDialog).toBe('shortcutHelp');
    expect(topBarUI.diffOpen).toBe(false);
    topBarUI.shortcutHelpOpen = false;
    expect(topBarUI.activeDialog).toBeNull();
    topBarUI.switcherOpen = true;
    topBarUI.reset();
    expect(topBarUI.activeDialog).toBeNull();
    expect(topBarUI.switcherOpen).toBe(false);
  });
});

describe('shell icon provenance and tokens', () => {
  it('uses Solar bold duotone icons on shell surfaces', () => {
    for (const rel of [
      'src/components/shell/GlobalNavBar.svelte',
      'src/components/shell/WorkspaceTopBar.svelte',
      'src/components/ThemePicker.svelte',
    ]) {
      const source = read(rel);
      expect(source, rel).not.toContain('lucide-svelte');
      expect(source, rel).toMatch(/from '@solar-icons\/svelte\/bold-duotone\/[a-z0-9-]+'/);
    }
    const nav = read('src/components/shell/GlobalNavBar.svelte');
    expect(nav).toContain("import Home from '@solar-icons/svelte/bold-duotone/home'");
    const picker = read('src/components/ThemePicker.svelte');
    for (const slug of ['monitor', 'sun', 'moon']) {
      expect(picker, slug).toContain(`@solar-icons/svelte/bold-duotone/${slug}`);
    }
  });

  it('colors section icons with accent while labels keep their foreground', () => {
    const nav = read('src/components/shell/GlobalNavBar.svelte');
    expect(nav).toContain('function iconClass(id: SectionId): string');
    expect(nav).toContain("activeSection === id ? 'text-info' : 'text-accent'");
    expect(nav).toContain('<Icon class={iconClass(entry.id)} />');
    expect(nav).toContain("import Keyboard from '@solar-icons/svelte/bold-duotone/keyboard'");
    const entryClassFn =
      nav.match(/function entryClass\(id: SectionId\): string \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(entryClassFn).toContain('text-base-content/70');
    expect(entryClassFn).not.toContain('text-accent');
    expect(nav).toContain('class="hidden sm:inline">{entry.label}</span>');
    expect(nav).not.toMatch(/<a[^>]*text-accent[^>]*>/);
  });

  it('uses theme tokens only in the two bars', () => {
    const css = read('src/app.css');
    for (const rel of [
      'src/components/shell/GlobalNavBar.svelte',
      'src/components/shell/WorkspaceTopBar.svelte',
    ]) {
      const source = read(rel);
      expect(source, rel).toContain('bg-base-100');
      expect(source, rel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
      expect(source, rel).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
    expect(css).toContain('@utility text-foreground');
  });
});

describe('two-bar shell layout', () => {
  const css = read('src/app.css');

  it('uses a full-width thin bar and an action bar without a rail or overlay', () => {
    const shell = read('src/components/shell/AppShell.svelte');
    for (const rel of [
      'src/components/shell/GlobalNavBar.svelte',
      'src/components/shell/WorkspaceTopBar.svelte',
    ]) {
      expect(read(rel), rel).not.toContain('shell-backdrop');
      expect(read(rel), rel).not.toContain('shell-panel');
      expect(read(rel), rel).not.toContain('shell-rail');
    }
    for (const removed of [
      '.shell-panel',
      '.shell-rail',
      '.shell-backdrop',
      '--shell-panel-z',
      '--shell-backdrop-z',
      'padding-left: 3rem',
    ]) {
      expect(css, removed).not.toContain(removed);
    }
    expect(css).toContain('scroll-padding-top: 2rem');
    const contentBlock = css.match(/\.app-shell-content\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(contentBlock).not.toContain('padding');
    expect(shell).toContain('<GlobalNavBar />');
    expect(shell).toContain('{#if isWorkspaceView}');
    const root = css.match(/\.workspace-root\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(root).toContain('grid-template-columns:');
    expect(root).not.toContain('padding');
  });

  it('keeps the document viewport lock and portrait dock rules', () => {
    for (const block of [
      css.match(/html,\s*body\s*\{[\s\S]*?\}/)?.[0] ?? '',
      css.match(/#app\s*\{[\s\S]*?\}/)?.[0] ?? '',
    ]) {
      expect(block).toContain('height: 100%');
      expect(block).toContain('overflow: hidden');
      expect(block).toContain('overscroll-behavior: none');
    }
    expect(css.match(/@media \(orientation: portrait\)/g)?.length).toBe(1);
    expect(css).toContain('43dvh');
    expect(css).toContain('bottom: calc(43dvh + 0.75rem)');
  });
});

describe('catalog route', () => {
  const page = read('src/pages/CatalogPage.svelte');

  it('browses the generated index with locally persisted query, vendor, family and package filters', () => {
    expect(page).toContain('catalogStore.index');
    expect(page).toContain('searchCatalogEntries(');
    expect(page).toContain('buildVendorTabs(');
    expect(page).toContain('catalogFamilies(');
    expect(page).toContain('catalogPackageKinds(');
    expect(page).toContain('discoveryPreferences.catalog');
    for (const field of [
      'filters.query',
      'filters.vendor',
      'filters.family',
      'filters.package',
    ]) {
      expect(page, field).toContain(field);
    }
    expect(page).toContain('filters.reset()');
    expect(read('src/state/discovery-preferences.svelte.ts')).toContain(
      "'pinspec:discovery_preferences_v1'",
    );
    expect(page).toContain('router.navigateMcu(entry.id)');
  });

  it('shows a retryable failure and a pending state instead of an empty list', () => {
    expect(page).toContain('catalogStore.indexError');
    expect(page).toContain('catalogStore.retry()');
    expect(page).toContain('Retry catalog load');
    expect(page).toContain('catalogStore.loadingIndex');
    expect(page).toContain('Loading multi-vendor catalog...');
    expect(page).toContain('alert alert-soft alert-error');
    expect(page).toContain('loading loading-spinner loading-xs');
  });

  it('shows the generated module marker without a hardcoded part table', () => {
    expect(page).toContain('{#if entry.module}');
    expect(page).toContain('MODULE');
    expect(page).not.toContain('ESP32-WROOM-E');
  });

  it('leads each dense result row with a decorative package thumbnail', () => {
    expect(page).toContain('<PackageThumbnail');
    expect(page).toContain('size={44}');
    expect(page).toContain('Outline');
    expect(page).toContain('thumbnailGeometryFromIndex(entry)');
    expect(page).not.toContain('IntersectionObserver');
    expect(page).toContain('searchCatalogEntries(');
    expect(page).toContain('500,');
  });
});

describe('projects route', () => {
  const page = read('src/pages/ProjectsPage.svelte');

  it('lists recent sessions as cards with a thumbnail and open, export and delete actions', () => {
    expect(page).toContain('workspaceStore.recentSessions.slice(0, 10)');
    expect(page).toContain('workspaceStore.openMcu(mcuId)');
    expect(page).toContain('workspaceStore.deleteRecentSession(mcuId)');
    expect(page).toContain('exportSession(session.mcuId)');
    expect(page).toContain('thumbnailGeometryFromSaved(session.packageName, session.pinCount)');
    expect(page).toContain('No recent projects');
    expect(page).toContain('href="#/catalog"');
    expect(page).not.toContain('<table');
  });

  it('shows and renames the saved project name on each card', () => {
    expect(page).toContain('session.state.projectName');
    expect(page).toContain('beginRename(session.mcuId, session.state.projectName)');
    expect(page).toContain('aria-label={`Rename ${session.mcuId}`}');
    expect(page).toContain('workspaceStore.renameProject(nameDraft, mcuId)');
    expect(page).toContain('onblur={commitRename}');
    expect(page).toContain('cancelRename()');
    expect(page).toContain('maxlength="48"');
  });

  it('imports and exports version-2 project files only', () => {
    expect(page).toContain('parsePinoutJson(');
    expect(page).toContain('exportPinoutJson(');
    expect(page).toContain('workspaceStore.setPendingHandoff(parsed.state)');
    expect(page).toContain('router.navigateMcu(parsed.state.mcuId)');
    expect(page).toContain('application/json');
    const state = createEmptyWorkspace('STM32G431CBU6');
    const project = exportPinoutJson(state);
    expect(project).not.toContain('sidebarExpanded');
    expect(encodeWorkspaceState(state)).not.toContain('shell');
  });
});

describe('about route', () => {
  const page = read('src/pages/AboutPage.svelte');
  const panel = read('src/components/about/ProvenancePanel.svelte');

  it('presents one grouped Catalog sources table with totals in its header', () => {
    expect(page).toContain('<ProvenancePanel');
    expect(page).not.toContain('Catalog summary');
    expect(panel).toContain('Catalog sources');
    expect(panel).toContain('catalogStore.index.length.toLocaleString()');
    expect(panel).toContain('familyCount');
    expect(panel).toContain('PROVENANCE_SOURCES');
    expect(panel).toContain('PROVENANCE_VENDORS');
    expect(panel).toContain('catalogStore.meta.sources?.[vendor.id]');
    expect(panel).toContain('catalogStore.meta.sources?.[sourceId]');
    expect(panel).not.toContain('Per-vendor chip counts and source revisions');
    expect(panel).not.toContain('Upstream data sources and licenses');
  });

  it('renders one static provenance surface with no tab preference', () => {
    expect(page).not.toContain('sidebar');
    expect(page).not.toContain('ABOUT_TABS');
    expect(page).not.toContain('role="tablist"');
    expect(page).not.toContain('aria-selected');
    expect(page).not.toContain('Shortcuts');
    expect(panel).not.toContain('AboutTab');
    expect(panel).not.toContain('sr-only');
    expect(fs.existsSync(path.join(ROOT, 'src/state/shell-preferences.svelte.ts'))).toBe(false);
  });

  it('keeps loading and retry states on the merged surface', () => {
    expect(page).toContain('catalogStore.ensureLoaded()');
    expect(panel).toContain('catalogStore.indexError');
    expect(panel).toContain('catalogStore.retry()');
    expect(panel).toContain('Retry catalog load');
    expect(panel).toContain('Loading catalog statistics...');
    expect(panel).toContain('Catalog statistics unavailable');
    expect(panel).not.toContain('SHORTCUTS');
    expect(panel).toContain('alert alert-soft alert-error');
    expect(panel).toContain('loading loading-spinner loading-xs');
  });

  it('opens the shared shortcuts dialog from the navigation bar without a route', () => {
    const nav = read('src/components/shell/GlobalNavBar.svelte');
    expect(nav).toContain('Keyboard');
    expect(nav).toContain('aria-label="Keyboard shortcuts"');
    expect(nav).toContain('topBarUI.shortcutHelpOpen = true');
    expect(nav).not.toContain("'#/hotkeys'");
    expect(read('src/components/shell/AppShell.svelte')).toContain('ShortcutHelpDialog');
    expect(read('src/pages/AboutPage.svelte')).not.toContain('ShortcutHelpDialog');
  });
});

describe('shell documentation', () => {
  it('documents local-only discovery filters and the two-bar Workspace contract', () => {
    const readme = read('README.md');
    expect(readme).toContain('pinspec:discovery_preferences_v1');
    expect(readme).toContain('Catalog and quick-search discovery filters');
    expect(readme).toContain('absent from share URLs, version-2 project files');
    expect(readme).not.toContain('pinspec:shell_preferences_v1');
    expect(readme).toContain('two curated words');
    expect(readme).not.toContain('word-word-family');
    expect(readme).toContain('Home, Projects, and Catalog on the left');
    expect(readme).toContain('Workspace opens the loaded chip');
    expect(readme).toContain('most recent local session');
    expect(readme).toContain('word-word');
    expect(readme).toContain('shareable pin-planning metadata');
    expect(readme).toContain('version-2 share URLs');
    expect(readme).toContain('inline editing mode itself is component-local');
    expect(readme).toContain('Hero with `New pinout`');
    expect(readme).toContain('two columns at `lg`');
    expect(readme).not.toContain('starter chips');
    const agents = read('AGENTS.md');
    expect(agents).not.toContain('pinspec:shell_preferences_v1');
    expect(agents).toContain('h-8 (32 px) navigation bar');
    expect(agents).toContain('action bar below the navigation bar');
    expect(agents).toContain('hero-led, two-column surface');
    expect(agents).toContain('`Plan a pinout` headline');
    expect(agents).not.toContain('three-zone shell');
  });
});

describe('start screen redirect', () => {
  it('opens the catalog from New pinout and keeps its quick actions', () => {
    const page = read('src/pages/LandingPage.svelte');
    expect(page).toContain('router.navigateCatalog()');
    expect(page).toContain('>New pinout</span>');
    expect(page).toContain('<QuickSearchBar');
    expect(page).toContain('<RecentSessions');
    expect(page).toContain('<BoardSelectorModal');
    expect(page).toContain('topBarUI.diffOpen = true');
    expect(page).not.toContain('PinoutDiffModal');
    expect(page).not.toContain('id="provenance"');
  });

  it('leaves the shared Hotkeys dialog as the only shortcut reference', () => {
    const page = read('src/pages/LandingPage.svelte');
    expect(page).not.toContain('SHORTCUTS');
    expect(page).not.toContain('Shortcuts');
    expect(page).not.toContain('<kbd');
    expect(page).not.toContain('ratios.');
    expect(page).not.toContain('PROVENANCE_VENDORS');
    expect(page).toContain('Synced {formatSyncDate(catalogStore.meta.generatedAt)}');
    const shell = read('src/components/shell/AppShell.svelte');
    expect(shell.match(/<ShortcutHelpDialog/g)?.length).toBe(1);
    expect(read('src/pages/AboutPage.svelte')).not.toContain('SHORTCUTS');
    const nav = read('src/components/shell/GlobalNavBar.svelte');
    expect(nav).toContain('aria-label="Keyboard shortcuts"');
    expect(nav).toContain('topBarUI.shortcutHelpOpen = true');
  });
});
