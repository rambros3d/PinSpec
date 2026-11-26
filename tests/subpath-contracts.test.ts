import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataUrl } from '../src/core/data-url';
import { parseHash } from '../src/state/router.svelte';

const ROOT = process.cwd();

describe('GitHub Pages-safe data URLs', () => {
  it('builds data URLs from BASE_URL for root and subpath deployments', () => {
    expect(dataUrl('/', 'index.json')).toBe('/data/index.json');
    expect(dataUrl('/pinspec/', 'index.json')).toBe('/pinspec/data/index.json');
    expect(dataUrl('/pinspec', 'chips/STM32G431CBU6.json')).toBe(
      '/pinspec/data/chips/STM32G431CBU6.json',
    );
    expect(dataUrl('/pinspec/', '/meta.json')).toBe('/pinspec/data/meta.json');
  });

  it('contains no root-absolute data or asset literal in application source', () => {
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|svelte)$/.test(entry.name)) sources.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(sources.length).toBeGreaterThan(0);
    const offenders = sources.filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return /["'`]\/(data|assets)\//.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

describe('shell hash routes under a subpath', () => {
  it('resolves shell routes from the hash and falls back to home', () => {
    expect(parseHash('#/')).toEqual({ view: 'landing' });
    expect(parseHash('#/catalog')).toEqual({ view: 'catalog' });
    expect(parseHash('#/projects')).toEqual({ view: 'projects' });
    expect(parseHash('#/about')).toEqual({ view: 'about' });
    expect(parseHash('#/mcu/STM32G431CBU6')).toEqual({
      view: 'workspace',
      mcuId: 'STM32G431CBU6',
    });
    expect(parseHash('#/s/abcDEF')).toEqual({ view: 'shared', payload: 'abcDEF' });
    expect(parseHash('#/unknown')).toEqual({ view: 'landing' });
  });

  it('keeps generated data fetches behind dataUrl across every shell page', () => {
    for (const file of [
      'src/pages/CatalogPage.svelte',
      'src/pages/ProjectsPage.svelte',
      'src/pages/AboutPage.svelte',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source, file).not.toMatch(/["'`]\/(data|assets)\//);
    }
    const catalog = fs.readFileSync(path.join(ROOT, 'src/state/catalog.svelte.ts'), 'utf8');
    expect(catalog).toContain('dataUrl(');
    expect(catalog).toContain('import.meta.env.BASE_URL');
  });
});

describe('deploy workflow contract', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');

  const jobBlocks = (): Record<string, string> => {
    const blocks: Record<string, string> = {};
    const lines = workflow.split('\n');
    const jobsIndex = lines.indexOf('jobs:');
    expect(jobsIndex, 'jobs:').toBeGreaterThan(-1);
    let current: string | null = null;
    let block: string[] = [];
    for (const line of lines.slice(jobsIndex + 1)) {
      if (line && !/^\s/.test(line)) break;
      const heading = /^  ([a-z][a-z0-9-]*):\s*$/.exec(line);
      if (heading) {
        if (current) blocks[current] = block.join('\n');
        current = heading[1];
        block = [];
      } else if (current) {
        block.push(line);
      }
    }
    if (current) blocks[current] = block.join('\n');
    return blocks;
  };

  it('separates build and deploy into dependent jobs', () => {
    const jobs = jobBlocks();
    expect(Object.keys(jobs).sort()).toEqual(['build', 'deploy']);
    expect(jobs.build).toContain('runs-on: ubuntu-latest');
    expect(jobs.build).toContain('actions/upload-pages-artifact@v4');
    expect(jobs.build).toContain('path: dist');
    expect(jobs.build).not.toContain('actions/deploy-pages@v4');
    expect(jobs.build).not.toContain('environment:');
    expect(jobs.deploy).toContain('needs: build');
    expect(jobs.deploy).toContain('runs-on: ubuntu-latest');
    expect(jobs.deploy).toContain('name: github-pages');
    expect(jobs.deploy).toContain('url: ${{ steps.deployment.outputs.page_url }}');
    expect(jobs.deploy).toContain('id: deployment');
    expect(jobs.deploy).toContain('uses: actions/deploy-pages@v4');
    expect(jobs.deploy).not.toContain('actions/upload-pages-artifact@v4');
    expect(jobs.deploy.match(/- name:/g)).toHaveLength(1);
    expect(workflow.match(/actions\/deploy-pages@v4/g)).toHaveLength(1);
  });

  it('preserves triggers and the Pages actions', () => {
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("cron: '0 4 * * 1'");
    expect(workflow).toContain('actions/upload-pages-artifact@v4');
    expect(workflow).toContain('actions/deploy-pages@v4');
  });

  it('refreshes sources weekly, acquires all sources, and records SHAs', () => {
    expect(workflow).toContain("if: github.event_name == 'schedule'");
    expect(workflow).toContain('uses: actions/cache@v4');
    expect(workflow).toContain('path: .cache');
    expect(workflow).toContain("if: github.event_name != 'schedule'");
    expect(workflow).toContain("hashFiles('tools/data-gen/sources.ts', 'tools/data-gen/adapters/**/sources.ts', 'package-lock.json')");
    expect(workflow.indexOf('uses: actions/cache@v4')).toBeLessThan(workflow.indexOf('npm ci'));
    expect(workflow).toContain('rm -rf .cache');
    expect(workflow).toContain('npm run acquire-sources');
    expect(workflow).toContain('meta.json');
    expect(workflow).toContain('generatedAt');
  });

  it('runs generation before tests, types, and subpath build', () => {
    const at = (needle: string): number => {
      const index = workflow.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    expect(at('npm ci')).toBeLessThan(at('npm run gen-data'));
    expect(at('npm run gen-data')).toBeLessThan(at('npm test'));
    expect(at('npm test')).toBeLessThan(at('npm run check'));
    expect(at('npm run check')).toBeLessThan(at('BASE_PATH: /'));
    expect(at('Verify subpath runtime fetches')).toBeLessThan(at('Upload GitHub Pages artifact'));
  });

  it('smoke-checks the page, index, and a chip shard under the derived subpath', () => {
    expect(workflow).toContain('BASE_PATH: /${{ github.event.repository.name }}/');
    expect(workflow).toContain('SITE_NAME="${{ github.event.repository.name }}"');
    expect(workflow).toContain('/$SITE_NAME/index.html');
    expect(workflow).toContain('/$SITE_NAME/data/index.json');
    expect(workflow).toContain('/$SITE_NAME/data/chips/');
    expect(workflow).toContain('(src|href)="/(data|assets)/');
  });
});

describe('local subpath smoke reproduction', () => {
  it('serves the built site under /pinspec/ and rejects root-absolute fetches', async () => {
    const dist = path.join(ROOT, 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) return;
    const server = http.createServer((req, res) => {
      const requestPath = (req.url ?? '').split('?')[0];
      if (!requestPath.startsWith('/pinspec/')) {
        res.writeHead(404, { Connection: 'close' });
        res.end('not found');
        return;
      }
      const rel = requestPath.slice('/pinspec/'.length) || 'index.html';
      const file = path.join(dist, rel);
      if (!file.startsWith(dist) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { Connection: 'close' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', Connection: 'close' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    try {
      const index: Array<{ id: string }> = JSON.parse(
        fs.readFileSync(path.join(dist, 'data', 'index.json'), 'utf8'),
      );
      for (const url of [
        '/pinspec/index.html',
        '/pinspec/data/index.json',
        `/pinspec/data/chips/${index[0].id}.json`,
      ]) {
        const response = await fetch(`http://127.0.0.1:${port}${url}`);
        expect(response.status, url).toBe(200);
      }
      const absolute = await fetch(`http://127.0.0.1:${port}/data/index.json`);
      expect(absolute.status).toBe(404);
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
      expect(/(src|href)="\/(data|assets)\//.test(html)).toBe(false);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  }, 15_000);
});
