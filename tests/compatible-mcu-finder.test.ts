import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  candidateSupportsSignal,
  compareCandidateScores,
  deriveCompatibilitySignature,
  isCandidateScorable,
  mapWithConcurrency,
  MAX_COMPATIBILITY_RESULTS,
  MAX_CONCURRENT_SHARD_LOADS,
  scoreCandidate,
  signaturesEqual,
} from '../src/core/compatibility';
import type { ChipData, WorkspaceState } from '../src/core/types';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const sourceChip: ChipData = {
  id: 'STM32G431CBU6',
  vendor: 'stm32',
  muxModel: 'af',
  family: 'STM32G4',
  core: 'Cortex-M4',
  flashKb: 128,
  ramKb: 32,
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    { pos: '15', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
    { pos: '16', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
    { pos: '17', name: 'PA7', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MOSI', af: 5 }] },
    { pos: '1', name: 'VBAT', type: 'power', signals: [] },
  ],
  peripherals: {
    SPI1: { kind: 'spi', signals: ['SCK', 'MISO', 'MOSI'] },
  },
};

const sourceState: WorkspaceState = {
  mcuId: sourceChip.id,
  assignments: {
    '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    '16': { peripheral: 'SPI1', signal: 'MISO', af: 5 },
  },
  labels: { '15': 'CLK', '16': 'DATA' },
  locked: { '15': true },
  peripheralModes: { SPI1: 'rx_only' },
};

function variant(changes: Partial<ChipData>): ChipData {
  return { ...sourceChip, ...changes };
}

describe('compatibility signature', () => {
  it('ignores labels and locks but reflects mode changes', () => {
    const signature = deriveCompatibilitySignature(sourceChip, sourceState);
    const cosmetic = deriveCompatibilitySignature(sourceChip, {
      ...sourceState,
      labels: { '15': 'OTHER' },
      locked: {},
    });
    expect(signaturesEqual(signature, cosmetic)).toBe(true);

    const changedMode = deriveCompatibilitySignature(sourceChip, {
      ...sourceState,
      peripheralModes: { SPI1: 'full_duplex' },
    });
    expect(signaturesEqual(signature, changedMode)).toBe(false);
    expect(changedMode.requiredSignals).toContainEqual({ peripheral: 'SPI1', signal: 'MOSI' });
    expect(signature.powerPins).toEqual([{ name: 'VBAT', type: 'power' }]);
    expect(signature.muxModel).toBe('af');
  });
});

describe('candidate scoring', () => {
  const signature = deriveCompatibilitySignature(sourceChip, sourceState);

  it('classifies exact matches, functional matches and incompatible parts', () => {
    const exact = variant({
      id: 'STM32G431CBT6',
      flashKb: 256,
      pins: [
        { pos: '20', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 6 }] },
        { pos: '21', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 6 }] },
      ],
    });
    const functional = variant({
      id: 'STM32F103C8T6',
      flashKb: 64,
      ramKb: 20,
      pins: [
        { pos: '15', name: 'PB3', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 0 }] },
        { pos: '16', name: 'PB4', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 0 }] },
      ],
    });
    const incompatible = variant({
      id: 'STM32NOPE',
      pins: [{ pos: '15', name: 'PA0', type: 'io', signals: [] }],
    });

    const exactScore = scoreCandidate(signature, exact);
    const functionalScore = scoreCandidate(signature, functional);
    const incompatibleScore = scoreCandidate(signature, incompatible);
    expect(exactScore.classification).toBe('exact');
    expect(exactScore.exactPinMatches).toBe(2);
    expect(exactScore.flashDeltaKb).toBe(128);
    expect(functionalScore.classification).toBe('functional');
    expect(functionalScore.functionalMatches).toBe(2);
    expect(functionalScore.flashDeltaKb).toBe(-64);
    expect(incompatibleScore.classification).toBe('incompatible');
    expect(incompatibleScore.missingSignals).toEqual(['SPI1:MISO', 'SPI1:SCK']);
    expect(
      [exactScore, functionalScore, incompatibleScore].sort(compareCandidateScores).map((s) => s.mcuId),
    ).toEqual(['STM32G431CBT6', 'STM32F103C8T6', 'STM32NOPE']);
  });

  it('orders equal-ranked candidates deterministically by smaller memory delta then ID', () => {
    const make = (id: string, flashKb: number): ChipData =>
      variant({
        id,
        flashKb,
        pins: [
          { pos: '20', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
          { pos: '21', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
        ],
      });
    const scores = [make('ZPART', 256), make('APART', 64), make('BPART', 128)]
      .map((chip) => scoreCandidate(signature, chip))
      .sort(compareCandidateScores);
    expect(scores.map((s) => s.mcuId)).toEqual(['BPART', 'APART', 'ZPART']);
    expect([...scores].sort(compareCandidateScores)).toEqual(scores);
  });

  it('scores CH32 and RP candidates under their own mux models', () => {
    const ch32: ChipData = {
      ...sourceChip,
      id: 'CH32V203C8T6',
      vendor: 'ch32',
      muxModel: 'remap-group',
      flashKb: 64,
      pins: [
        { pos: '20', name: 'PB3', type: 'io', signals: [] },
        { pos: '21', name: 'PB4', type: 'io', signals: [] },
      ],
      peripherals: {
        SPI1: {
          kind: 'spi',
          signals: ['SCK', 'MISO'],
          remaps: [
            { id: 0, name: 'Default', signals: { SCK: 'PB3', MISO: 'PB4' } },
          ],
        },
      },
    };
    const rp: ChipData = {
      ...sourceChip,
      id: 'RP2040',
      vendor: 'rp',
      muxModel: 'funcsel-pio',
      flashKb: 0,
      ramKb: 264,
      pins: [
        { pos: '4', name: 'GPIO2', type: 'io', signals: [{ peripheral: 'SPI0', signal: 'SCK', af: 2, funcLabel: 'F2' }] },
        { pos: '5', name: 'GPIO3', type: 'io', signals: [{ peripheral: 'SPI0', signal: 'MISO', af: 2, funcLabel: 'F2' }] },
      ],
      peripherals: {
        SPI0: { kind: 'spi', signals: ['SCK', 'MISO'] },
      },
    };
    expect(candidateSupportsSignal(ch32, 'PB3', 'SPI1', 'SCK')).toBe(true);
    const ch32Score = scoreCandidate(signature, ch32);
    expect(ch32Score.vendor).toBe('ch32');
    expect(ch32Score.muxModel).toBe('remap-group');
    expect(ch32Score.classification).toBe('functional');
    const rpScore = scoreCandidate(signature, rp);
    expect(rpScore.vendor).toBe('rp');
    expect(rpScore.muxModel).toBe('funcsel-pio');
    expect(rpScore.classification).toBe('incompatible');
    expect(rpScore.missingSignals).toEqual(['SPI1:MISO', 'SPI1:SCK']);
  });

  it('reports incomplete shards instead of scoring them', () => {
    const empty = variant({ id: 'EMPTY', pins: [] });
    expect(isCandidateScorable(empty)).toBe(false);
    expect(isCandidateScorable(sourceChip)).toBe(true);
  });
});

describe('bounded shard loading', () => {
  it('never exceeds the fixed concurrency and keeps every result', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    const results = await mapWithConcurrency(items, MAX_CONCURRENT_SHARD_LOADS, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return item;
    });
    expect(maxActive).toBeLessThanOrEqual(MAX_CONCURRENT_SHARD_LOADS);
    expect(results.sort((a, b) => a - b)).toEqual(items);
    expect(MAX_COMPATIBILITY_RESULTS).toBe(20);
  });

  it('discards results produced after cancellation', async () => {
    const deferred: Array<{ resolve: (value: number) => void }> = [];
    let cancelled = false;
    const pending = mapWithConcurrency(
      [0, 1, 2, 3, 4, 5],
      MAX_CONCURRENT_SHARD_LOADS,
      (item) =>
        new Promise<number>((resolve) => {
          deferred.push({ resolve });
        }),
      () => cancelled,
    );
    await Promise.resolve();
    expect(deferred.length).toBe(MAX_CONCURRENT_SHARD_LOADS);
    cancelled = true;
    for (const entry of deferred) entry.resolve(1);
    expect(await pending).toEqual([]);
  });
});

describe('finder wiring', () => {
  it('opens from the global bar and caps its dialog to the viewport', () => {
    const bar = readSource('src/components/shell/GlobalTopBar.svelte');
    expect(bar).toContain('topBarUI.finderOpen = true');
    expect(bar).toContain('aria-label="Compatible MCUs"');
    expect(bar).toContain('>Compatible MCUs<');
    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain('CompatibleMcuFinder');
    expect(page).toContain('topBarUI.finderOpen');
    const finder = readSource('src/components/workspace/CompatibleMcuFinder.svelte');
    expect(finder).toContain('MAX_COMPATIBILITY_RESULTS');
    expect(finder).toContain('MAX_CONCURRENT_SHARD_LOADS');
    expect(finder).toContain('max-h-[92dvh]');
    expect(finder).toContain('min-h-0 overflow-y-auto');
    expect(finder).toContain('router.navigateMcu(');
    for (const vendor of ['stm32', 'ch32', 'rp', 'esp32']) {
      expect(finder, vendor).toContain(`<option value="${vendor}">`);
    }
    expect(finder.indexOf('<option value="all">')).toBeLessThan(
      finder.indexOf('<option value="stm32">'),
    );
    expect(finder).not.toContain('workspaceStore');
  });

  it('is reachable in portrait through the scrollable global bar', () => {
    const bar = readSource('src/components/shell/GlobalTopBar.svelte');
    expect(bar).toContain('overflow-x-auto');
    const css = readSource('src/app.css');
    expect(css).toContain('grid-template-areas:');
    expect(readSource('src/components/workspace/CompatibleMcuFinder.svelte')).toContain('max-h-[92dvh]');
  });
});
