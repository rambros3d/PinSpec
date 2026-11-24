export type Route =
  | { view: 'landing' }
  | { view: 'workspace'; mcuId: string }
  | { view: 'shared'; payload: string };

function parseHash(rawHash: string): Route {
  const hash = rawHash.replace(/^#/, '');
  if (!hash || hash === '/' || hash === '') {
    return { view: 'landing' };
  }
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
