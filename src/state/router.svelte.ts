export type Route =
  | { view: 'landing' }
  | { view: 'catalog' }
  | { view: 'projects' }
  | { view: 'about' }
  | { view: 'workspace'; mcuId: string }
  | { view: 'shared'; payload: string };

/** Pure hash parser shared by the shell and its route contract tests. */
export function parseHash(rawHash: string): Route {
  const hash = rawHash.replace(/^#/, '');
  if (!hash || hash === '/' || hash === '') {
    return { view: 'landing' };
  }
  if (hash === '/catalog') return { view: 'catalog' };
  if (hash === '/projects') return { view: 'projects' };
  if (hash === '/about') return { view: 'about' };
  const mcuMatch = hash.match(/^\/mcu\/([^/?#]+)/);
  if (mcuMatch) {
    return { view: 'workspace', mcuId: decodeURIComponent(mcuMatch[1]).toUpperCase() };
  }
  const shareMatch = hash.match(/^\/s\/([^?#]+)/);
  if (shareMatch) {
    return { view: 'shared', payload: shareMatch[1] };
  }
  return { view: 'landing' };
}

class RouterStore {
  route = $state<Route>(
    typeof window !== 'undefined' ? parseHash(window.location.hash) : { view: 'landing' },
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.route = parseHash(window.location.hash);
      });
    }
  }

  navigateHome(): void {
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    }
    this.route = { view: 'landing' };
  }

  navigateCatalog(): void {
    this.setHash('#/catalog', { view: 'catalog' });
  }

  navigateProjects(): void {
    this.setHash('#/projects', { view: 'projects' });
  }

  navigateAbout(): void {
    this.setHash('#/about', { view: 'about' });
  }

  private setHash(hash: string, route: Route): void {
    if (typeof window !== 'undefined') {
      window.location.hash = hash;
    }
    this.route = route;
  }

  navigateMcu(mcuId: string): void {
    const clean = mcuId.trim().toUpperCase();
    if (typeof window !== 'undefined') {
      window.location.hash = `#/mcu/${encodeURIComponent(clean)}`;
    }
    this.route = { view: 'workspace', mcuId: clean };
  }

  navigateShare(payload: string): void {
    if (typeof window !== 'undefined') {
      window.location.hash = `#/s/${payload}`;
    }
    this.route = { view: 'shared', payload };
  }
}

export const router = new RouterStore();
