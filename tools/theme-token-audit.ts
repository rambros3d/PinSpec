/**
 * Audits consumption of the vendored daisyUI design tokens.
 *
 * Source of truth: src/themes/daisyui.css (the only file allowed to declare
 * raw color literals). Every other file must reference tokens via var().
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tokens that had no consumer before the theme-token-integration change.
 * Depth and noise are deliberately excluded: the IC package texture must stay
 * always on and must not be gated by theme flags, and those effects must not be
 * added anywhere else.
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

/** Theme flags intentionally left inert outside the vendored theme file. */
export const INTENTIONALLY_INERT_TOKENS = ['--depth', '--noise'] as const;

export interface TokenAudit {
  declared: string[];
  usage: Array<{ token: string; references: number }>;
  unused: string[];
  previouslyUnusedStillUnused: string[];
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
  }));
  const unused = usage.filter((item) => item.references === 0).map((item) => item.token);
  const previouslyUnusedStillUnused = PREVIOUSLY_UNUSED_TOKENS.filter((token) =>
    unused.includes(token),
  );
  return { declared, usage, unused, previouslyUnusedStillUnused: [...previouslyUnusedStillUnused] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditThemeTokens();
  for (const { token, references } of result.usage) {
    console.log(`${token}: ${references}`);
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
  console.log(
    `Intentionally inert (IC texture is always on): ${INTENTIONALLY_INERT_TOKENS.join(', ')}`,
  );
  process.exitCode = result.previouslyUnusedStillUnused.length > 0 ? 1 : 0;
}
