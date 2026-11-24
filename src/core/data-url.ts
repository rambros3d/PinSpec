/**
 * Pure helper for GitHub Pages-safe data URLs.
 *
 * Vite injects the deploy subpath through `import.meta.env.BASE_URL`; building
 * every runtime fetch from that value keeps deep links working under
 * `/pincraft/` without a server rewrite. This module is pure TypeScript and is
 * deliberately free of DOM and Svelte imports so it can be unit tested on the
 * host.
 */
export function dataUrl(base: string, relPath: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}data/${relPath.replace(/^\/+/, '')}`;
}
