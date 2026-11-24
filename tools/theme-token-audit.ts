/**
 * Audits consumption of the vendored daisyUI design tokens.
 *
 * Source of truth: src/themes/daisyui.css (the only file allowed to declare
 * raw color literals). Every other file must reference tokens via var() or use
 * a daisyUI component class that reads the token from the active theme.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tokens that had no custom var() consumer before the daisyUI adoption. Their
 * consumers are now daisyUI component classes (badge-secondary,
 * text-accent-content, rounded-box, select-sm, and similar), so an explicit
 * var() reference is no longer required.
 */
export const PREVIOUSLY_UNUSED_TOKENS = [
  '--color-secondary',
  '--color-secondary-content',
  '--color-accent',
  '--color-accent-content',
  '--color-success-content',
  '--color-warning-content',
  '--color-error-content',
  '--radius-selector',
  '--radius-field',
  '--radius-box',
  '--size-selector',
  '--size-field',
] as const;

/** Tokens whose consumer is a daisyUI component class rather than a var() call. */
export const DAISYUI_OWNED_TOKENS = [
  '--border',
  '--color-base-100',
  '--color-base-300',
  '--color-primary',
  '--color-primary-content',
  ...PREVIOUSLY_UNUSED_TOKENS,
] as const;

/** Theme flags intentionally left inert outside the vendored theme file. */
export const INTENTIONALLY_INERT_TOKENS = ['--depth', '--noise'] as const;

export interface TokenUsage {
  token: string;
  references: number;
  /** True when a daisyUI component class is the token's consumer. */
  ownedByDaisyUI: boolean;
}

export interface TokenAudit {
  declared: string[];
  usage: TokenUsage[];
  unused: string[];
  previouslyUnusedStillUnused: string[];
  daisyUIOwned: string[];
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const THEME_FILE = join(ROOT, 'src/themes/daisyui.css');
const SCAN_ROOTS = [join(ROOT, 'src'), join(ROOT, 'index.html')];
const SOURCE_EXTENSIONS = /\.(css|svelte|ts)$/;

function collectFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return SOURCE_EXTENSIONS.test(path) || path.endsWith('.html') ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}

/** Extracts every custom-property name declared in the vendored theme file. */
export function declaredThemeTokens(): string[] {
  const css = readFileSync(THEME_FILE, 'utf8');
  const names = new Set<string>();
  for (const match of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) names.add(match[1]);
  return [...names].sort();
}

/** Counts var(--token) references outside the vendored theme file. */
export function auditThemeTokens(): TokenAudit {
  const declared = declaredThemeTokens();
  const files = SCAN_ROOTS.flatMap(collectFiles).filter((file) => file !== THEME_FILE);
  const sources = files.map((file) => readFileSync(file, 'utf8'));
  const usage = declared.map((token) => ({
    token,
    references: sources.reduce(
      (sum, source) => sum + (source.match(new RegExp(`var\\(${token}\\b`, 'g'))?.length ?? 0),
      0,
    ),
    ownedByDaisyUI: (DAISYUI_OWNED_TOKENS as readonly string[]).includes(token),
  }));
  const withoutVarConsumer = usage.filter((item) => item.references === 0);
  const unused = withoutVarConsumer
    .filter((item) => !item.ownedByDaisyUI)
    .map((item) => item.token);
  const unownedTokens = new Set(withoutVarConsumer.filter((item) => !item.ownedByDaisyUI).map((item) => item.token));
  const previouslyUnusedStillUnused = PREVIOUSLY_UNUSED_TOKENS.filter((token) => unownedTokens.has(token));
  return {
    declared,
    usage,
    unused,
    previouslyUnusedStillUnused: [...previouslyUnusedStillUnused],
    daisyUIOwned: [...DAISYUI_OWNED_TOKENS],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditThemeTokens();
  for (const { token, references, ownedByDaisyUI } of result.usage) {
    console.log(`${token}: ${references}${ownedByDaisyUI ? ' (daisyUI component class)' : ''}`);
  }
  console.log(`Declared tokens: ${result.declared.length}`);
  console.log(`Unused tokens: ${result.unused.length ? result.unused.join(', ') : 'none'}`);
  console.log(
    `Previously unused still unused: ${
      result.previouslyUnusedStillUnused.length
        ? result.previouslyUnusedStillUnused.join(', ')
        : 'none'
    }`,
  );
  console.log(`daisyUI-owned tokens: ${result.daisyUIOwned.join(', ')}`);
  console.log(
    `Intentionally inert (IC texture is always on): ${INTENTIONALLY_INERT_TOKENS.join(', ')}`,
  );
  process.exitCode = result.previouslyUnusedStillUnused.length > 0 ? 1 : 0;
}
