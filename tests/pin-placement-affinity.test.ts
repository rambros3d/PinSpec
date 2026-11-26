import fs from 'node:fs';
import path from 'node:path';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import {
  cloneWorkspaceState,
  createWorkspaceHistory,
  statesEqual,
} from '../src/core/history';
import {
  buildPinGeometryMap,
  canonicalPinPlacementPreference,
  configuredPeripheralNames,
  measuredSafeRadius,
  normalizeAngle,
  normalizePlacement,
  normalizePlacementRing,
  orderPeripheralsByPlacement,
  parsePinPlacementPreference,
  placementAffinityForPin,
  isMatrixCandidateLegal,
  matrixElectricalPenalty,
  rankMatrixAlternates,
  MATRIX_ALTERNATE_CAP,
} from '../src/core/placement';
import {
  allocatePeripheralMode,
  computePinScarcityScore,
  createEmptyWorkspace,
  findOneHopFixForSignal,
  reallocateMatrixPlacement,
  reallocatePeripheralPlacement,
  reallocatePlacementOrdered,
  searchBacktracking,
  validateMatrixPlan,
  togglePeripheralSignal,
} from '../src/core/solver';
import {
  PLACEMENT_RING_LABELS,
  PLACEMENT_RING_RANK,
  PLACEMENT_RINGS,
  type ChipData,
  type PinInfo,
  type PinPlacementPreference,
  type PinSignal,
  type PinTag,
  type WorkspaceState,
} from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';
import { stubCatalogChips } from './helpers/catalog-stub';

const ROOT = process.cwd();

function fixtureChip(overrides: Partial<ChipData> = {}): ChipData {
  return {
    id: 'STM32TEST48',
    family: 'STM32G4',
    core: 'Cortex-M4',
    flashKb: 128,
    ramKb: 32,
    package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 8, sides: [2, 2, 2, 2] },
    pins: [
      { pos: '1', name: 'VDD', type: 'power', signals: [] },
      {
        pos: '2',
        name: 'PA5',
        type: 'io',
        signals: [
          { peripheral: 'SPI1', signal: 'SCK', af: 5 },
          { peripheral: 'USART1', signal: 'TX', af: 7 },
        ],
      },
      { pos: '3', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
      {
        pos: '4',
        name: 'PA7',
        type: 'io',
        signals: [
          { peripheral: 'SPI1', signal: 'MOSI', af: 5 },
          { peripheral: 'USART1', signal: 'TX', af: 7 },
        ],
      },
      { pos: '5', name: 'PB3', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
      { pos: '6', name: 'PB4', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
      { pos: '7', name: 'PB5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MOSI', af: 5 }] },
      { pos: '8', name: 'PA2', type: 'io', signals: [{ peripheral: 'USART1', signal: 'TX', af: 7 }] },
    ],
    peripherals: {
      SPI1: { kind: 'spi', signals: ['SCK', 'MISO', 'MOSI'] },
      USART1: { kind: 'usart', signals: ['TX', 'RX'] },
    },
    ...overrides,
  };
}

const chip = fixtureChip();
const empty = createEmptyWorkspace(chip.id);

function decodeRawPayload(encoded: string): Record<string, unknown> {
  const bytes = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return JSON.parse(strFromU8(inflateSync(new Uint8Array(bytes)))) as Record<string, unknown>;
}

describe('package geometry helper', () => {
  it('derives finite angles and radii for a four-sided perimeter package', () => {
    const geometry = buildPinGeometryMap(chip);
    expect(geometry.byPos.size).toBe(8);
    for (const pin of chip.pins) {
      const point = geometry.byPos.get(pin.pos);
      expect(point).toBeDefined();
      expect(Number.isFinite(point!.angle)).toBe(true);
      expect(Number.isFinite(point!.radius)).toBe(true);
      expect(point!.angle).toBeGreaterThanOrEqual(0);
      expect(point!.angle).toBeLessThan(360);
    }
    const left = geometry.byPos.get('2')!;
    const bottom = geometry.byPos.get('4')!;
    const right = geometry.byPos.get('6')!;
    expect(left.angle).toBeGreaterThan(90);
    expect(bottom.angle).toBeGreaterThan(left.angle);
    expect(right.angle).toBeLessThan(90);
  });

  it('falls back gracefully for two-sided packages', () => {
    const twoSided = fixtureChip({
      package: { name: 'SOP8', kind: 'perimeter', pinCount: 4, sides: [2, 0, 2, 0] },
    });
    const geometry = buildPinGeometryMap(twoSided);
    expect(geometry.byPos.size).toBe(8);
    for (const pos of ['2', '4', '6', '8']) {
      const point = geometry.byPos.get(pos)!;
      expect(Number.isFinite(point.angle)).toBe(true);
      expect(Number.isFinite(point.radius)).toBe(true);
    }
    expect(geometry.byPos.get('2')!.angle).toBeGreaterThan(90);
    expect(geometry.byPos.get('4')!.angle).toBeLessThan(90);
  });

  it('derives outer balls with larger radii for grid packages', () => {
    const grid = fixtureChip({
      package: {
        name: 'TFBGA9',
        kind: 'grid',
        pinCount: 9,
        rows: ['A', 'B', 'C'],
        cols: [1, 2, 3],
      },
      pins: Array.from({ length: 9 }, (_, index) => ({
        pos: String(index + 1),
        name: `A${index + 1}`,
        type: 'io' as const,
        signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }],
      })),
    });
    const geometry = buildPinGeometryMap(grid);
    expect(geometry.byPos.get('5')!.radius).toBe(0);
    expect(geometry.byPos.get('3')!.radius).toBeGreaterThan(geometry.byPos.get('2')!.radius);
    for (const point of geometry.byPos.values()) {
      expect(Number.isFinite(point.angle)).toBe(true);
      expect(point.radius).toBeLessThanOrEqual(geometry.maxRadius + 1e-9);
    }
  });

  it('normalizes angles into [0, 360)', () => {
    expect(normalizeAngle(-45)).toBe(315);
    expect(normalizeAngle(720 + 30)).toBe(30);
    expect(normalizeAngle(Number.NaN)).toBe(0);
  });
});

describe('placement scoring hook', () => {
  const geometry = buildPinGeometryMap(chip);
  const target = geometry.byPos.get('4')!;

  it('is exactly zero when placement is disabled', () => {
    expect(placementAffinityForPin(chip.pins[3], chip, null, { geometry })).toBe(0);
    expect(
      placementAffinityForPin(chip.pins[3], chip, { angle: 0, ring: 'high', enabled: false }, { geometry }),
    ).toBe(0);
  });

  it('enforces strict inter-ring ordering before angular score', () => {
    const make = (ring: 'high' | 'medium' | 'low') =>
      placementAffinityForPin(chip.pins[3], chip, { angle: target.angle, ring, enabled: true }, { geometry });
    const inner = make('high');
    const middle = make('medium');
    const outer = make('low');
    expect(inner).toBeLessThan(middle);
    expect(middle).toBeLessThan(outer);
    expect(outer - middle).toBe(10000);
    expect(middle - inner).toBe(10000);
  });

  it('prefers the angularly closer pin and, on a tie, the outer ball', () => {
    const preference = { angle: target.angle, ring: 'high' as const, enabled: true };
    const near = placementAffinityForPin(chip.pins[3], chip, preference, { geometry });
    const far = placementAffinityForPin(chip.pins[1], chip, preference, { geometry });
    expect(near).toBeLessThan(far);

    const grid = fixtureChip({
      package: {
        name: 'TFBGA9',
        kind: 'grid',
        pinCount: 9,
        rows: ['A', 'B', 'C'],
        cols: [1, 2, 3],
      },
      pins: Array.from({ length: 9 }, (_, index) => ({
        pos: String(index + 1),
        name: `A${index + 1}`,
        type: 'io' as const,
        signals: [],
      })),
    });
    const gridGeometry = buildPinGeometryMap(grid);
    const gridPreference = { angle: 0, ring: 'high' as const, enabled: true };
    // Centre and right-edge pins both lie on angle 0; the outer ball wins.
    const centre = placementAffinityForPin(grid.pins[4], grid, gridPreference, { geometry: gridGeometry });
    const outer = placementAffinityForPin(grid.pins[5], grid, gridPreference, { geometry: gridGeometry });
    expect(outer).toBeLessThan(centre);
  });

  it('orders enabled peripherals by ring and keeps unconfigured ones last', () => {
    const state: WorkspaceState = {
      ...empty,
      placement: {
        OUT: { angle: 0, ring: 'low', enabled: true },
        MID: { angle: 0, ring: 'medium', enabled: true },
        IN: { angle: 0, ring: 'high', enabled: true },
        OFF: { angle: 0, ring: 'high', enabled: false },
      },
    };
    expect(orderPeripheralsByPlacement(['OUT', 'PLAIN', 'MID', 'OFF', 'IN'], state)).toEqual([
      'IN',
      'MID',
      'OUT',
      'PLAIN',
      'OFF',
    ]);
  });
});

describe('default allocation stays byte-identical', () => {
  it('keeps scarcity scores unchanged when placement is absent', () => {
    const counts = new Map<string, number>([
      ['SPI1:SCK', 3],
      ['SPI1:MISO', 3],
      ['SPI1:MOSI', 3],
      ['USART1:TX', 3],
    ]);
    const scores = chip.pins
      .filter((pin) => pin.type === 'io')
      .map((pin) => computePinScarcityScore(pin, chip, empty, counts, 'SPI1'));
    expect(scores).toEqual([3, 0.5, 3, 0.5, 0.5, 0.5, 2.5]);

    const withDisabledPlacement: WorkspaceState = {
      ...empty,
      placement: { SPI1: { angle: 90, ring: 'high', enabled: false } },
    };
    const disabledScores = chip.pins
      .filter((pin) => pin.type === 'io')
      .map((pin) => computePinScarcityScore(pin, chip, withDisabledPlacement, counts, 'SPI1'));
    expect(disabledScores).toEqual(scores);
  });

  it('keeps mode allocation, signal toggling and one-hop fixes unchanged', () => {
    const mode = allocatePeripheralMode(chip, empty, 'SPI1', 'full_duplex');
    expect(mode.state.assignments).toEqual({
      '3': { peripheral: 'SPI1', signal: 'MISO', af: 5 },
      '5': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      '7': { peripheral: 'SPI1', signal: 'MOSI', af: 5 },
    });
    expect(mode.allocated).toEqual([
      { pos: '5', signal: 'SCK', af: 5 },
      { pos: '3', signal: 'MISO', af: 5 },
      { pos: '7', signal: 'MOSI', af: 5 },
    ]);
    expect(mode.unallocated).toEqual([]);

    const toggle = togglePeripheralSignal(chip, mode.state, 'USART1', 'TX');
    expect(toggle.assignedPos).toBe('8');
    expect(toggle.state.assignments['8']).toEqual({
      peripheral: 'USART1',
      signal: 'TX',
      af: 7,
    });

    const fixChip = fixtureChip({
      pins: chip.pins.map((pin) =>
        pin.pos === '8'
          ? { ...pin, signals: [{ peripheral: 'USART1', signal: 'RX', af: 7 }] }
          : pin,
      ),
    });
    const occupied: WorkspaceState = {
      ...empty,
      assignments: { '2': { peripheral: 'USART1', signal: 'TX', af: 7 } },
    };
    expect(findOneHopFixForSignal(fixChip, occupied, 'SPI1', 'SCK')).toEqual({
      label: 'Move USART1_TX (PA5 -> PA7) to free SPI1_SCK',
      targetPeripheral: 'SPI1',
      targetSignal: 'SCK',
      targetAf: 5,
      targetPos: '2',
      displacedFromPos: '2',
      displacedToPos: '4',
      displacedPeripheral: 'USART1',
      displacedSignal: 'TX',
      displacedAf: 7,
    });
  });
});

describe('placement-driven reallocation', () => {
  it('moves the affected peripheral to the preferred angle', () => {
    const geometry = buildPinGeometryMap(chip);
    const state: WorkspaceState = {
      ...empty,
      assignments: { '2': { peripheral: 'SPI1', signal: 'SCK', af: 5 } },
      placement: {
        SPI1: { angle: geometry.byPos.get('5')!.angle, ring: 'high', enabled: true },
      },
    };
    const next = reallocatePeripheralPlacement(chip, state, 'SPI1');
    expect(next.assignments['5']?.signal).toBe('SCK');
    expect(next.assignments['2']).toBeUndefined();
  });

  it('allocates inner-ring peripherals before outer-ring competitors', () => {
    const sharedChip = fixtureChip({
      pins: chip.pins.map((pin) =>
        pin.pos === '5'
          ? {
              ...pin,
              signals: [
                ...pin.signals,
                { peripheral: 'USART1', signal: 'TX', af: 7 },
              ],
            }
          : pin,
      ),
    });
    const geometry = buildPinGeometryMap(sharedChip);
    const preferredAngle = geometry.byPos.get('5')!.angle;
    const state: WorkspaceState = {
      ...empty,
      assignments: {
        '2': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
        '5': { peripheral: 'USART1', signal: 'TX', af: 7 },
      },
      placement: {
        SPI1: { angle: preferredAngle, ring: 'high', enabled: true },
        USART1: { angle: preferredAngle, ring: 'low', enabled: true },
      },
    };
    const next = reallocatePlacementOrdered(sharedChip, state);
    expect(next.assignments['5']?.peripheral).toBe('SPI1');
    expect(
      Object.values(next.assignments).some(
        (asgn) => asgn.peripheral === 'USART1' && asgn.signal === 'TX',
      ),
    ).toBe(true);
  });

  it('never reassigns or clears locked pins during a simulated drag', async () => {
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    stubCatalogChips(catalogStore, chip);
    await workspaceStore.openMcu(chip.id);
    workspaceStore.assignPin('2', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
    workspaceStore.assignPin('6', { peripheral: 'SPI1', signal: 'MISO', af: 5 });
    workspaceStore.toggleLock('6');
    workspaceStore.assignPin('4', { peripheral: 'SPI1', signal: 'MOSI', af: 5 });

    const geometry = buildPinGeometryMap(chip);
    const preference = {
      angle: geometry.byPos.get('5')!.angle,
      ring: 'high' as const,
      enabled: true,
    };
    workspaceStore.previewPlacement('SPI1', preference);
    expect(workspaceStore.state.assignments['6']).toEqual({
      peripheral: 'SPI1',
      signal: 'MISO',
      af: 5,
    });
    workspaceStore.commitPlacement('SPI1', preference);
    expect(workspaceStore.state.locked['6']).toBe(true);
    expect(workspaceStore.state.assignments['6']?.signal).toBe('MISO');
    expect(workspaceStore.state.assignments['5']?.signal).toBe('SCK');
    workspaceStore.undo();
    expect(workspaceStore.state.assignments['6']?.signal).toBe('MISO');
    expect(workspaceStore.state.assignments['2']?.signal).toBe('SCK');
    expect(workspaceStore.state.placement).toBeUndefined();
  });
});

describe('placement persistence', () => {
  const placementState: WorkspaceState = {
    ...empty,
    placement: {
      SPI1: { angle: 123.5, ring: 'high', enabled: true },
      USART1: { angle: 300, ring: 'low', enabled: false },
    },
  };

  it('clones and compares placement fields', () => {
    const cloned = cloneWorkspaceState(placementState);
    expect(cloned).toEqual(placementState);
    expect(cloned.placement).not.toBe(placementState.placement);
    expect(statesEqual(placementState, cloned)).toBe(true);
    expect(
      statesEqual(placementState, {
        ...placementState,
        placement: {
          ...placementState.placement,
          SPI1: { angle: 90, ring: 'high', enabled: true },
        },
      }),
    ).toBe(false);
    expect(
      statesEqual(placementState, {
        ...placementState,
        placement: { ...placementState.placement, USART1: { angle: 10, ring: 'low', enabled: true } },
      }),
    ).toBe(false);
  });

  it('normalizes absent fields to disabled defaults', () => {
    expect(normalizePlacement(empty)).toEqual({ preferences: {} });
    const normalized = normalizePlacement({
      placement: { BAD: { angle: Number.NaN, ring: 'high', enabled: true } },
    });
    expect(normalized.preferences).toEqual({});
  });

  it('round-trips through history, share links and project files', () => {
    const history = createWorkspaceHistory(empty);
    expect(history.push(placementState)).toBe(true);
    expect(history.undo()?.placement).toBeUndefined();
    expect(history.redo()?.placement).toEqual(placementState.placement);

    const decoded = decodeWorkspaceState(encodeWorkspaceState(placementState));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(placementState);
    expect(decodeRawPayload(encodeWorkspaceState(placementState))).toHaveProperty('y');
    expect(decodeRawPayload(encodeWorkspaceState(placementState))).not.toHaveProperty('w');
    expect(decodeRawPayload(encodeWorkspaceState(empty))).not.toHaveProperty('y');
    expect(decodeRawPayload(encodeWorkspaceState(empty))).not.toHaveProperty('w');

    const text = exportPinoutJson(placementState, 'stm32');
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(doc.version).toBe(2);
    expect(doc).not.toHaveProperty('placementOverlayVisible');
    expect(Object.keys(doc.placement as object)).toEqual(['SPI1', 'USART1']);
    const parsed = parsePinoutJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(placementState);
    expect(parsePinoutJson(exportPinoutJson(empty))).toEqual({ ok: true, state: empty });
  });

  it('keeps view-only keys out of decoded state', () => {
    const raw = JSON.stringify({
      v: 2,
      m: chip.id,
      w: 1,
      y: { SPI1: [45, 'high', 1] },
    });
    const encoded = Buffer.from(deflateSync(strToU8(raw), { level: 9 })).toString('base64url');
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.state.placement?.SPI1).toEqual({ angle: 45, ring: 'high', enabled: true });
      expect(decoded.state).not.toHaveProperty('placementOverlayVisible');
    }

    const parsed = parsePinoutJson(
      JSON.stringify({
        format: 'pinspec-pinout',
        version: 2,
        mcuId: chip.id,
        peripheralModes: {},
        assignments: {},
        labels: {},
        locked: [],
        placementOverlayVisible: true,
        placement: { SPI1: { angle: 45, ring: 'high', enabled: true } },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.placement?.SPI1).toEqual({ angle: 45, ring: 'high', enabled: true });
      expect(parsed.state).not.toHaveProperty('placementOverlayVisible');
    }
  });

  it('ignores wrong-version payloads and invalid preferences', () => {
    const v1 = JSON.stringify({ ...JSON.parse(exportPinoutJson(placementState)), version: 1 });
    expect(parsePinoutJson(v1).ok).toBe(false);
    const v1Link = Buffer.from(
      deflateSync(strToU8(JSON.stringify({ v: 1, m: chip.id })), { level: 9 }),
    ).toString('base64url');
    expect(decodeWorkspaceState(v1Link).ok).toBe(false);

    const raw = JSON.stringify({
      v: 2,
      m: chip.id,
      y: { SPI1: [90, 'invalid', 1] },
    });
    const encoded = Buffer.from(deflateSync(strToU8(raw), { level: 9 })).toString('base64url');
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.placement).toBeUndefined();
  });

  it('persists placement bubbles but keeps the overlay toggle out of sessions', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    const { viewPreferences } = await import('../src/state/workspace-preferences.svelte.ts');
    stubCatalogChips(catalogStore, chip);
    await workspaceStore.openMcu(chip.id);
    workspaceStore.setPlacement('SPI1', { angle: 123.5, ring: 'high', enabled: true });
    workspaceStore.setPlacementOverlayVisible(true);

    expect(viewPreferences.placementOverlayVisible).toBe(true);
    const preferences = JSON.parse(
      storage.get('pinspec:workspace_view_preferences_v1') ?? '{}',
    ) as Record<string, unknown>;
    expect(preferences.placementOverlayVisible).toBe(true);
    const sessions = JSON.parse(storage.get('pinspec:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placement).toEqual({ SPI1: { angle: 123.5, ring: 'high', enabled: true } });
    expect(sessions[0].state).not.toHaveProperty('placementOverlayVisible');
    vi.unstubAllGlobals();
  });
});

describe('placement overlay wiring', () => {
  it('renders a toggleable overlay that feeds the existing highlight set', () => {
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('PlacementOverlay');
    expect(canvas).toContain('setPlacementOverlayVisible');
    expect(canvas).toContain('set.add(pos)');
    expect(canvas).toContain('previewPlacement');
    expect(canvas).toContain('commitPlacement');

    const overlay = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementOverlay.svelte'),
      'utf8',
    );
    for (const token of [
      'PLACEMENT_RINGS',
      'setPointerCapture',
      'indicator.name',
      'ringFromEvent',
      'overlayRotation',
      'PLACEMENT_RING_LABELS',
    ]) {
      expect(overlay, token).toContain(token);
    }
    expect(overlay).toContain('{indicator.name}');
    expect(overlay).not.toContain('} deg');
    expect(overlay).not.toContain('onRing');
    expect(overlay).not.toContain('type="number"');
    expect(overlay).not.toContain('pointer-events-auto absolute top-16');
    expect(canvas).toContain('setPlacementOverlayRotation(overlayRotation + 90)');
    expect(canvas).toContain('Rotate placement Rings');
    expect(canvas).toContain('<Orbit class="size-3.5" />');
    expect(canvas).not.toContain('handlePlacementRing');
    expect(canvas).toContain('onPlacementToggle?: (visible: boolean) => void;');
    expect(canvas).toContain('onPlacementToggle?.(next);');
  });

  it('draws legible rings and labels while keeping pin input passthrough', () => {
    const overlay = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementOverlay.svelte'),
      'utf8',
    );
    expect(overlay).toContain('class="fill-none stroke-current text-info opacity-90"');
    expect(overlay).toContain('stroke-width="2"');
    expect(overlay).toContain('class="fill-current text-info text-[11px] font-medium"');
    expect(overlay).not.toContain('opacity-40');
    expect(overlay).toContain('class="absolute inset-0 z-10 pointer-events-none"');
    expect(overlay).toContain('class="absolute inset-0 w-full h-full pointer-events-none"');
  });

  it('forwards the persisted rotation alongside the overlay', () => {
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('rotation: PackageRotation');
    expect(canvas).toContain('{rotation}');
    expect(canvas).toContain('fitViewTransform(');
    const view = fs.readFileSync(path.join(ROOT, 'src/core/canvas-view.ts'), 'utf8');
    expect(view).toContain('input.rotation === 90 || input.rotation === 270');
    const store = fs.readFileSync(
      path.join(ROOT, 'src/state/workspace.svelte.ts'),
      'utf8',
    );
    expect(store).toContain('normalizePackageRotation');
    expect(store).toContain('toggleRotation()');
    expect(store).not.toContain('rotateClockwise');
  });

  it('does not change generated data or non-JSON exporter files', () => {
    const generated = fs.readFileSync(path.join(ROOT, 'src/core/exporters/csv.ts'), 'utf8');
    expect(generated).not.toContain('placement');
    const rust = fs.readFileSync(path.join(ROOT, 'src/core/exporters/embassy-rust.ts'), 'utf8');
    expect(rust).not.toContain('placement');
  });
});

describe('placement tab activation', () => {
  const page = fs.readFileSync(path.join(ROOT, 'src/pages/WorkspacePage.svelte'), 'utf8');
  const drawer = fs.readFileSync(
    path.join(ROOT, 'src/components/workspace/SummaryDrawer.svelte'),
    'utf8',
  );
  const store = fs.readFileSync(path.join(ROOT, 'src/state/workspace.svelte.ts'), 'utf8');

  it('opens the overlay from the drawer or dock tab and deactivates on leaving', () => {
    expect(page).toContain("tab === 'placement'");
    expect(page).toContain("previousSummaryTab === 'placement'");
    expect(page).toContain('workspaceStore.setPlacementOverlayVisible(true)');
    expect(page).toContain('workspaceStore.setPlacementOverlayVisible(false)');
    expect(page).toContain('function toggleRightDrawer(): void');
    expect(page).toContain('workspaceStore.setPlacementOverlayVisible(!rightCollapsed)');
    expect(drawer).toContain("<PlacementPanel");
    expect(drawer).toContain("activeTab === 'placement'");
  });

  it('reveals the Placement panel when the canvas toggle turns on', () => {
    expect(page).toContain('function handlePlacementToggle(visible: boolean): void');
    const handler = page.match(/function handlePlacementToggle[\s\S]*?\n  }/)?.[0] ?? '';
    expect(handler).toContain('if (!visible) return;');
    expect(handler).toContain("summaryTab = 'placement'");
    expect(handler).toContain("workspaceStore.setDockTab('placement')");
    expect(handler).toContain('rightCollapsed = false;');
    expect(handler).not.toContain('setPlacementOverlayVisible');
    expect(handler).not.toContain('setPlacement(');
    expect(page).toContain('onPlacementToggle={handlePlacementToggle}');
  });

  it('keeps the canvas toggle as the only overlay ON/OFF control', () => {
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('setPlacementOverlayVisible(next)');
    expect(canvas).toContain('viewPreferences.placementOverlayVisible');
    expect(drawer).not.toContain('setPlacementOverlayVisible');
    const panel = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementPanel.svelte'),
      'utf8',
    );
    expect(panel).not.toContain('setPlacementOverlayVisible');
    expect(store).toContain('viewPreferences.placementOverlayVisible = visible');
    expect(store).not.toContain('next.placementOverlayVisible');
  });
});

describe('placement overlay interaction refresh', () => {
  const readOverlay = (): string =>
    fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementOverlay.svelte'),
      'utf8',
    );
  const readCanvas = (): string =>
    fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );

  it('uses measured body-centred radii for drawing, selection and keyboard changes', () => {
    const overlay = readOverlay();
    expect(overlay).not.toContain('RING_FACTORS');
    expect(overlay).not.toContain('radius *');
    expect(overlay).toContain('radii: PlacementRingRadii');
    expect(overlay).toContain('radii[preference.ring]');
    expect(overlay).toContain('radii[ring]');
    expect(overlay).toContain('ringFromEvent(event)');

    const canvas = readCanvas();
    expect(canvas).toContain("querySelector('[data-ic-body]')");
    expect(canvas).toContain('bodyHalfDiagonal = Math.hypot(bodyRect.width, bodyRect.height) / 2');
    expect(canvas).toContain('placementRingRadii(bodyHalfDiagonal)');
    expect(canvas).toContain('centerX={bodyCenterX}');
    expect(canvas).toContain('centerY={bodyCenterY}');
    expect(canvas).toContain('radii={ringRadii}');
    expect(canvas).not.toContain('safeRadius');
    expect(canvas).not.toContain('measuredSafeRadius');
    expect(canvas).not.toContain("querySelectorAll('[data-placement-furniture]')");
  });

  it('re-measures ring geometry when the body pans', () => {
    const canvas = readCanvas();
    const effect =
      canvas.match(/\$effect\(\(\) => \{\n    void stageWidth;[\s\S]*?queueMicrotask\(measureBodyFromDom\);\n  \}\);/)?.[0] ?? '';
    expect(effect).toContain('void panX;');
    expect(effect).toContain('void panY;');
    expect(effect).toContain('void zoom;');
    expect(effect).toContain('void chip.id;');
    expect(effect).toContain('void rotation;');
  });

  it('auto-fits only on the overlay-enable transition', () => {
    const canvas = readCanvas();
    const autoFit =
      canvas.match(/async function autoFitPlacement\(\): Promise<void> \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(autoFit).toContain('await tick()');
    expect(autoFit).toContain('const halfExtent = Math.min(stageRect.width, stageRect.height) / 2;');
    expect(autoFit).toContain('placementZoomLimit(');
    expect(autoFit).toContain('zoom > limit + PLACEMENT_ZOOM_EPSILON');
    expect(autoFit).toContain('zoomAtPoint({ zoom, panX, panY }, limit / zoom, bodyCenterX, bodyCenterY)');

    const resize =
      canvas.match(/const handleResize = \(\): void => \{[\s\S]*?\n    \};/)?.[0] ?? '';
    expect(resize).toContain('measureBodyFromDom()');
    expect(resize).not.toContain('autoFitPlacement');

    const chipOrRotation = canvas.match(/let lastFittedKey = '';[\s\S]*?\n  \}\);/)?.[0] ?? '';
    expect(chipOrRotation).toContain('queueMicrotask(fitView)');
    expect(chipOrRotation).not.toContain('autoFitPlacement');

    expect(canvas).toContain('if (visible && !wasOverlayVisible) void autoFitPlacement();');
    expect(canvas.match(/void autoFitPlacement\(\)/g)).toHaveLength(1);

    for (const pattern of [
      /function handlePointerMove\(e: PointerEvent\): void \{[\s\S]*?\n  \}/,
      /function zoomBy\([\s\S]*?\n  \}/,
      /function handleWheel\(e: WheelEvent\): void \{[\s\S]*?\n  \}/,
      /function handleGestureChange\(e: Event\): void \{[\s\S]*?\n  \}/,
    ]) {
      expect(canvas.match(pattern)?.[0] ?? '').not.toContain('autoFitPlacement');
    }
  });

  it('keeps keyboard angle steps and adds clamped ring stepping', () => {
    const overlay = readOverlay();
    expect(overlay).toContain(
      "event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')",
    );
    expect(overlay).toContain(
      'Math.max(0, Math.min(PLACEMENT_RINGS.length - 1, current + step))',
    );
    expect(overlay).toContain("event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0");
    expect(overlay).toContain('ringFromEvent(event)');
  });

  it('keeps the top-left toggle clear of the top-left import buttons and top-right HUD', () => {
    const canvas = readCanvas();
    expect(canvas).toContain('absolute top-14 left-3 z-20 pointer-events-none');
    expect(canvas).toContain('card card-border pointer-events-auto flex flex-row items-center gap-1.5');
    expect(canvas).toContain('aria-pressed={placementSettings.overlayVisible}');
    expect(canvas).toContain('setPlacementOverlayVisible(next)');
    const hud = canvas.match(/Top-Right Canvas HUD Controls[\s\S]*?<!-- Bottom-Left/)?.[0] ?? '';
    expect(hud).toContain('flex flex-row items-center gap-1');
    expect(hud).not.toContain('Placement');
    expect(readOverlay()).toContain('class="absolute inset-0 z-10 pointer-events-none"');
  });

  it('persists overlay rotation through every version-2 surface', () => {
    const rotated: WorkspaceState = {
      ...createEmptyWorkspace(chip.id),
      placementOverlayRotation: 90,
    };
    const cloned = cloneWorkspaceState(rotated);
    expect(cloned.placementOverlayRotation).toBe(90);
    expect(statesEqual(createEmptyWorkspace(chip.id), { ...rotated, placementOverlayRotation: 0 })).toBe(
      true,
    );
    expect(statesEqual(createEmptyWorkspace(chip.id), rotated)).toBe(false);

    const history = createWorkspaceHistory(createEmptyWorkspace(chip.id));
    expect(history.push(rotated)).toBe(true);
    expect(history.current.placementOverlayRotation).toBe(90);
    expect(history.undo()?.placementOverlayRotation).toBeUndefined();
    expect(history.redo()?.placementOverlayRotation).toBe(90);

    const decoded = decodeWorkspaceState(encodeWorkspaceState(rotated));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.placementOverlayRotation).toBe(90);
    const absentDecoded = decodeWorkspaceState(encodeWorkspaceState(createEmptyWorkspace(chip.id)));
    expect(absentDecoded.ok).toBe(true);
    if (absentDecoded.ok) expect(absentDecoded.state.placementOverlayRotation).toBeUndefined();

    const raw = exportPinoutJson(rotated);
    expect(raw).toContain('"placementOverlayRotation": 90');
    const parsed = parsePinoutJson(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.placementOverlayRotation).toBe(90);
    expect(exportPinoutJson(createEmptyWorkspace(chip.id))).not.toContain(
      'placementOverlayRotation',
    );
  });

  it('does not change scoring geometry or allocation when the overlay rotates', () => {
    const placement = { SPI1: { angle: 30, ring: 'high' as const, enabled: true } };
    const plain: WorkspaceState = { ...createEmptyWorkspace(chip.id), placement };
    const rotated: WorkspaceState = {
      ...plain,
      placementOverlayRotation: 90,
    };
    const geometry = buildPinGeometryMap(chip);
    const pin = chip.pins[1];
    expect(placementAffinityForPin(pin, chip, placement.SPI1, { geometry })).toBe(
      placementAffinityForPin(pin, chip, rotated.placement!.SPI1, { geometry }),
    );
    expect(buildPinGeometryMap(chip).byPos).toEqual(geometry.byPos);
    expect(orderPeripheralsByPlacement(['SPI1', 'USART1'], plain)).toEqual(
      orderPeripheralsByPlacement(['SPI1', 'USART1'], rotated),
    );
    expect(
      allocatePeripheralMode(chip, plain, 'SPI1', 'full_duplex').state.assignments,
    ).toEqual(allocatePeripheralMode(chip, rotated, 'SPI1', 'full_duplex').state.assignments);
    expect(
      allocatePeripheralMode(chip, createEmptyWorkspace(chip.id), 'SPI1', 'full_duplex').state
        .assignments,
    ).toEqual({
      '3': { peripheral: 'SPI1', signal: 'MISO', af: 5 },
      '5': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      '7': { peripheral: 'SPI1', signal: 'MOSI', af: 5 },
    });
  });

  it('previews drags without history entries and commits one change on pointer-up', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    stubCatalogChips(catalogStore, chip);
    await workspaceStore.openMcu(chip.id);

    workspaceStore.setPlacement('SPI1', { angle: 10, ring: 'high', enabled: true });
    workspaceStore.previewPlacement('SPI1', { angle: 20, ring: 'medium', enabled: true });
    expect(workspaceStore.state.placement?.SPI1?.angle).toBe(20);
    workspaceStore.undo();
    expect(workspaceStore.state.placement).toBeUndefined();
    workspaceStore.redo();
    expect(workspaceStore.state.placement?.SPI1).toEqual({
      angle: 10,
      ring: 'high',
      enabled: true,
    });

    workspaceStore.commitPlacement('SPI1', { angle: 30, ring: 'low', enabled: true });
    workspaceStore.undo();
    expect(workspaceStore.state.placement?.SPI1?.ring).toBe('high');

    workspaceStore.setPlacementOverlayRotation(90);
    expect(workspaceStore.state.placementOverlayRotation).toBe(90);
    let sessions = JSON.parse(storage.get('pinspec:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placementOverlayRotation).toBe(90);
    workspaceStore.undo();
    workspaceStore.redo();
    expect(workspaceStore.state.placementOverlayRotation).toBe(90);
    sessions = JSON.parse(storage.get('pinspec:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placementOverlayRotation).toBe(90);
    vi.unstubAllGlobals();
  });

  it('derives ring indicators from configured peripherals with enabled preferences', () => {
    const canvas = readCanvas();
    expect(canvas).toContain('configuredPeripheralNames');
    expect(canvas).toContain('.filter((name) => placementSettings.preferences[name]?.enabled)');
    expect(canvas).toContain('measureBodyFromDom()');
    expect(canvas).not.toContain('safeRadius');
    expect(canvas).toContain('data-placement-furniture');
    const panel = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementPanel.svelte'),
      'utf8',
    );
    expect(panel).toContain('configuredPeripheralNames');
    expect(panel).toContain("ring: 'low', enabled: true");
    expect(panel).toContain('setPlacement(');
    expect(panel).not.toContain('type="number"');
    expect(panel).not.toContain('Claimed:');
    expect(panel).not.toContain('setPlacementOverlayVisible');
  });
});

describe('priority ring identifiers', () => {
  const readChip = (id: string): ChipData =>
    JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public', 'data', 'chips', `${id}.json`), 'utf8'),
    ) as ChipData;

  it('uses high-first ranks and matching display labels', () => {
    expect(PLACEMENT_RINGS).toEqual(['high', 'medium', 'low']);
    expect(PLACEMENT_RING_RANK).toEqual({ high: 0, medium: 1, low: 2 });
    expect(PLACEMENT_RING_LABELS).toEqual({ high: 'High', medium: 'Medium', low: 'Low' });
    expect(PLACEMENT_RING_RANK.high).toBeLessThan(PLACEMENT_RING_RANK.medium);
    expect(PLACEMENT_RING_RANK.medium).toBeLessThan(PLACEMENT_RING_RANK.low);
    const overlay = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementOverlay.svelte'),
      'utf8',
    );
    expect(overlay).not.toContain('RING_FACTORS');
    expect(overlay).toContain('radii: PlacementRingRadii');
    expect(overlay).toContain('radii[preference.ring]');
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('placementZoomLimit(');
    expect(canvas).toContain('PLACEMENT_ZOOM_EPSILON');
    const panel = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementPanel.svelte'),
      'utf8',
    );
    expect(panel).toContain("ring: 'low', enabled: true");
  });

  it('rejects spatial ring names through every parse surface', () => {
    for (const value of ['inner', 'middle', 'outer', 'other', 1, null]) {
      expect(normalizePlacementRing(value)).toBeNull();
      expect(parsePinPlacementPreference({ angle: 45, ring: value, enabled: true })).toBeNull();
    }
    expect(
      canonicalPinPlacementPreference({
        angle: 45,
        ring: 'inner',
        enabled: true,
      } as unknown as PinPlacementPreference),
    ).toEqual({ angle: 45, ring: 'low', enabled: true });
    expect(
      normalizePlacement({
        placement: {
          SPI1: { angle: 90, ring: 'outer', enabled: true },
        },
      } as unknown as Pick<WorkspaceState, 'placement'>).preferences,
    ).toEqual({});
  });

  it('rejects spatial rings from share links and project files', () => {
    const raw = JSON.stringify({
      v: 2,
      m: chip.id,
      y: { SPI1: [123.5, 'inner', 1], USART1: [300, 'middle', 0] },
    });
    const encoded = Buffer.from(deflateSync(strToU8(raw), { level: 9 })).toString('base64url');
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state.placement).toBeUndefined();

    const parsed = parsePinoutJson(
      JSON.stringify({
        format: 'pinspec-pinout',
        version: 2,
        mcuId: chip.id,
        peripheralModes: {},
        assignments: {},
        labels: {},
        locked: [],
        placement: { SPI1: { angle: 10, ring: 'middle', enabled: true }, USART1: { angle: 20, ring: 'outer', enabled: false } },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state.placement).toBeUndefined();
  });

  it('round-trips current ring names through both codecs', () => {
    const state: WorkspaceState = {
      ...empty,
      placement: {
        SPI1: { angle: 30, ring: 'high', enabled: true },
        USART1: { angle: 200, ring: 'medium', enabled: true },
      },
    };
    const decoded = decodeWorkspaceState(encodeWorkspaceState(state));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(state);
    const parsed = parsePinoutJson(exportPinoutJson(state));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(state);
  });

  it('partitions configured peripherals for all three vendors', () => {
    const stm32 = readChip('STM32G431CBU6');
    expect(configuredPeripheralNames(stm32, {}, {})).toEqual([]);
    const stm32Modes = Object.fromEntries(
      Object.keys(stm32.peripherals).map((name) => [name, name === 'SPI1' ? 'full_duplex' : 'disabled']),
    );
    const stm32Configured = configuredPeripheralNames(stm32, {}, stm32Modes);
    expect(stm32Configured).toContain('SPI1');
    expect(stm32Configured).not.toContain('USART1');

    const ch32 = readChip('CH32V203C8T6');
    const rp = readChip('RP2350B');
    for (const part of [ch32, rp]) {
      const names = Object.keys(part.peripherals);
      const target = names.find((name) => name !== 'GPIO') ?? names[0];
      const modes = Object.fromEntries(
        names.map((name) => [name, name === target ? 'enabled' : 'disabled']),
      );
      const configured = configuredPeripheralNames(part, {}, modes);
      expect(configured).toEqual([target]);
      expect(configured.length).toBeLessThan(names.length);
    }
  });

  it('computes a finite safe radius that clears every reserved rectangle', () => {
    const bounds = { left: 0, top: 0, width: 800, height: 600 };
    const reserved = [
      { left: 600, top: 0, right: 790, bottom: 40 },
      { left: 340, top: 560, right: 460, bottom: 595 },
    ];
    const radius = measuredSafeRadius(400, 300, bounds, reserved, 40);
    expect(Number.isFinite(radius)).toBe(true);
    expect(radius).toBeGreaterThan(250);
    for (const rect of reserved) {
      const dx = Math.max(rect.left - 400, 0, 400 - rect.right);
      const dy = Math.max(rect.top - 300, 0, 300 - rect.bottom);
      expect(radius).toBeLessThan(Math.hypot(dx, dy));
    }
    expect(
      measuredSafeRadius(Number.NaN, 300, { left: 0, top: 0, width: 0, height: 0 }, [], 40),
    ).toBe(40);
    expect(measuredSafeRadius(400, 300, bounds, [])).toBe(300);
  });

  it('uses an arbitrary centre without assuming the stage midpoint', () => {
    const bounds = { left: 40, top: 60, width: 800, height: 600 };
    expect(measuredSafeRadius(240, 210, bounds, [])).toBe(150);
    const reserved = [{ left: 40, top: 60, right: 140, bottom: 160 }];
    expect(measuredSafeRadius(240, 210, bounds, reserved)).toBeCloseTo(Math.hypot(100, 50) - 6, 9);
  });
});

/** Synthetic matrix chip: 30 GPIOs carrying the same matrix routes. */
function matrixChip(withHazards = true): ChipData {
  const pins: PinInfo[] = [];
  for (let i = 1; i <= 30; i++) {
    const tags: PinTag[] = [];
    if (withHazards) {
      if (i === 1) tags.push('strapping', 'cap-restricted');
      if (i === 2) tags.push('input-only');
      if (i === 3) tags.push('flash');
      if (i === 4) tags.push('psram');
      if (i === 5) tags.push('adc');
    }
    const signals: PinSignal[] = [
      {
        peripheral: 'SPI2',
        signal: 'SCK',
        af: null,
        direction: 'output',
        ...(i <= 8 ? { resourceId: `LEDC${i}` } : {}),
      },
      {
        peripheral: 'SPI2',
        signal: 'MOSI',
        af: null,
        direction: 'output',
        ...(i <= 8 ? { resourceId: `RMT${i}` } : {}),
      },
      { peripheral: 'SPI2', signal: 'MISO', af: null, direction: 'input' },
    ];
    if (i === 5) {
      signals.push({ peripheral: 'ADC2', signal: 'CH0', af: null, direction: 'input' });
    }
    pins.push({ pos: String(i), name: `GPIO${i}`, type: 'io', tags, signals });
  }
  return {
    id: 'MATRIX30TEST',
    vendor: 'esp32',
    muxModel: 'gpio-matrix',
    family: 'MATRIX',
    core: 'Synthetic',
    flashKb: 0,
    ramKb: 520,
    matrixRouteCapacity: 100,
    package: { name: 'QFN-40', kind: 'perimeter', pinCount: 30, sides: [8, 7, 8, 7] },
    pins,
    peripherals: {
      SPI2: { kind: 'spi', signals: ['SCK', 'MOSI', 'MISO'] },
      ADC2: { kind: 'adc', signals: ['CH0'] },
      WIFI: { kind: 'other', signals: ['STA'] },
    },
  };
}

describe('matrix placement helpers', () => {
  it('derives finite geometry for every synthetic matrix pin', () => {
    for (const candidate of [matrixChip(), matrixChip(false)]) {
      const geometry = buildPinGeometryMap(candidate);
      expect(geometry.byPos.size).toBe(candidate.pins.length);
      for (const pin of candidate.pins) {
        const point = geometry.byPos.get(pin.pos)!;
        expect(Number.isFinite(point.angle)).toBe(true);
        expect(Number.isFinite(point.radius)).toBe(true);
      }
    }
  });

  it('derives electrical penalties from tags and radio state, zero when absent', () => {
    const c = matrixChip();
    const state = createEmptyWorkspace(c.id);
    const byPos = (pos: string) => c.pins.find((p) => p.pos === pos)!;
    expect(matrixElectricalPenalty(byPos('1'), c, state, 'SPI2', 'SCK')).toBe(40);
    expect(matrixElectricalPenalty(byPos('2'), c, state, 'SPI2', 'SCK')).toBe(60);
    expect(matrixElectricalPenalty(byPos('3'), c, state, 'SPI2', 'SCK')).toBe(80);
    expect(matrixElectricalPenalty(byPos('4'), c, state, 'SPI2', 'SCK')).toBe(80);
    expect(matrixElectricalPenalty(byPos('6'), c, state, 'SPI2', 'SCK')).toBe(0);
    expect(matrixElectricalPenalty(byPos('5'), c, state, 'ADC2', 'CH0')).toBe(0);
    state.peripheralModes.WIFI = 'sta';
    expect(matrixElectricalPenalty(byPos('5'), c, state, 'ADC2', 'CH0')).toBe(60);

    const plain = matrixChip(false);
    expect(
      matrixElectricalPenalty(
        plain.pins[0],
        plain,
        createEmptyWorkspace(plain.id),
        'SPI2',
        'SCK',
      ),
    ).toBe(0);
  });

  it('ranks electrical penalty ahead of geometry affinity', () => {
    const c: ChipData = {
      ...matrixChip(false),
      id: 'PENALTYGEOM',
      package: { name: 'SOP2', kind: 'perimeter', pinCount: 2, sides: [1, 0, 1, 0] },
      // The first pin maps to the left edge (180 deg) and the second to the
      // right edge (0 deg). Put the hazard on the angle-aligned pin.
      pins: [c1('2', [], 'CH0', 'ADC2'), c1('1', ['strapping', 'adc'], 'CH0', 'ADC2')],
    };
    const state = createEmptyWorkspace(c.id);
    state.peripheralModes.WIFI = 'sta';
    state.placement = { ADC2: { angle: 0, ring: 'high', enabled: true } };
    const alternates = rankMatrixAlternates(
      c.pins,
      c,
      state,
      'ADC2',
      'CH0',
      new Set(),
      new Set(),
    );
    expect(alternates.map((a) => a.pos)).toEqual(['2', '1']);
    expect(alternates[1].penalty).toBeGreaterThan(alternates[0].penalty);
    expect(alternates[1].affinity).toBeLessThan(alternates[0].affinity);
  });

  it('filters illegal and locked candidates and caps matrix alternates deterministically', () => {
    const c = matrixChip();
    const state = createEmptyWorkspace(c.id);
    state.locked['7'] = true;
    state.assignments['8'] = { peripheral: 'GPIO', signal: 'Input', af: null };
    const usedResources = new Set(['LEDC6']);
    const first = rankMatrixAlternates(
      c.pins,
      c,
      state,
      'SPI2',
      'SCK',
      new Set(),
      usedResources,
    );
    const second = rankMatrixAlternates(
      c.pins,
      c,
      state,
      'SPI2',
      'SCK',
      new Set(),
      usedResources,
    );
    expect(first).toHaveLength(MATRIX_ALTERNATE_CAP);
    expect(first).toEqual(second);
    for (const pos of ['2', '3', '4', '6', '7', '8']) {
      expect(first.some((a) => a.pos === pos), pos).toBe(false);
    }
    const legal = isMatrixCandidateLegal(
      c.pins.find((p) => p.pos === '2')!,
      {
        chip: c,
        state,
        peripheral: 'SPI2',
        signal: 'SCK',
        usedSignals: new Set(),
        usedPins: new Set(),
        usedResources: new Set(),
      },
    );
    expect(legal).toBe(false);
  });
});

function c1(pos: string, tags: PinTag[], signal = 'SCK', peripheral = 'SPI2'): PinInfo {
  return {
    pos,
    name: `GPIO${pos}`,
    type: 'io',
    tags,
    signals: [{ peripheral, signal, af: null, direction: 'input' }],
  };
}

describe('matrix placement reallocation', () => {
  it('uses backtracking to prefer a complete plan over a greedy first choice', () => {
    const search = searchBacktracking([
      {
        signal: 'AAA',
        options: [
          { key: 'p1', score: 0, item: 'a1' },
          { key: 'p2', score: 10, item: 'a2' },
        ],
      },
      { signal: 'BBB', options: [{ key: 'p1', score: 0, item: 'b1' }] },
    ]);
    expect(search.assignedCount).toBe(2);
    expect(search.picks.map((pick) => pick.option?.item)).toEqual(['a2', 'b1']);

    const allocationSource = fs.readFileSync(
      path.join(ROOT, 'src/core/solver-allocation.ts'),
      'utf8',
    );
    expect(allocationSource).toContain('export function searchBacktracking<T>(');
    expect(allocationSource).toContain('export function reallocateMatrixPlacement(');
  });

  it('assigns every required signal to a distinct legal pin', () => {
    const c = matrixChip();
    const state = createEmptyWorkspace(c.id);
    const next = reallocateMatrixPlacement(c, state, 'SPI2', null, ['SCK', 'MOSI', 'MISO']);
    const assigned = Object.entries(next.assignments);
    expect(assigned).toHaveLength(3);
    expect(new Set(assigned.map(([pos]) => pos)).size).toBe(3);
    for (const [pos] of assigned) expect(['1', '2', '3', '4']).not.toContain(pos);
    expect(validateMatrixPlan(c, next)).toEqual([]);
  });

  it('keeps locked pins fixed and satisfies their signals', () => {
    const c = matrixChip();
    const state = createEmptyWorkspace(c.id);
    state.assignments['5'] = { peripheral: 'SPI2', signal: 'SCK', af: null };
    state.locked['5'] = true;
    const next = reallocateMatrixPlacement(c, state, 'SPI2', null, ['SCK', 'MOSI', 'MISO']);
    expect(next.assignments['5']).toEqual(state.assignments['5']);
    expect(next.locked['5']).toBe(true);
    expect(Object.keys(next.assignments).length).toBe(3);
    expect(validateMatrixPlan(c, next)).toEqual([]);
  });

  it('leaves a signal unallocated when its only legal candidate is locked', () => {
    const c = matrixChip(false);
    c.pins = c.pins.filter((p) => p.pos === '1');
    c.peripherals = { SPI2: { kind: 'spi', signals: ['SCK'] } };
    c.pins[0].signals = [{ peripheral: 'SPI2', signal: 'SCK', af: null, direction: 'output' }];
    const state = createEmptyWorkspace(c.id);
    state.locked['1'] = true;
    const next = reallocateMatrixPlacement(c, state, 'SPI2', null, ['SCK']);
    expect(next.assignments['1']).toBeUndefined();
    expect(next.locked['1']).toBe(true);
  });

  it('validates duplicates and resource collisions without mutating the state', () => {
    const c = matrixChip(false);
    const state = createEmptyWorkspace(c.id);
    state.assignments = {
      '9': { peripheral: 'SPI2', signal: 'MISO', af: null, resourceId: 'LEDC1' },
      '10': { peripheral: 'SPI2', signal: 'MISO', af: null, resourceId: 'LEDC1' },
    };
    const before = structuredClone(state);
    const diagnostics = validateMatrixPlan(c, state);
    expect(state).toEqual(before);
    expect(diagnostics.some((d) => d.code === 'DUPLICATE_SIGNAL')).toBe(true);
    const conflict = diagnostics.find((d) => d.code === 'RESOURCE_CONFLICT');
    expect(conflict?.pins).toEqual(expect.arrayContaining(['9', '10']));
  });

  it('reports adapter hazard evidence as a diagnostic without changing assignments', () => {
    const c = matrixChip();
    const state = createEmptyWorkspace(c.id);
    state.assignments['1'] = { peripheral: 'GPIO', signal: 'Output', af: null };
    state.peripheralModes.WIFI = 'sta';
    state.assignments['5'] = { peripheral: 'ADC2', signal: 'CH0', af: null };
    const before = structuredClone(state.assignments);
    const diagnostics = validateMatrixPlan(c, state);
    expect(state.assignments).toEqual(before);
    expect(diagnostics.some((d) => d.code === 'STRAPPING_REPURPOSED')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'ADC2_WIFI_CONFLICT')).toBe(true);
  });

  it('allocates a matrix chip with no hazard fields without penalty or error', () => {
    const c = matrixChip(false);
    const state = createEmptyWorkspace(c.id);
    for (const pin of c.pins) {
      expect(matrixElectricalPenalty(pin, c, state, 'SPI2', 'SCK')).toBe(0);
    }
    const next = reallocateMatrixPlacement(c, state, 'SPI2', null, ['SCK', 'MOSI', 'MISO']);
    expect(Object.keys(next.assignments)).toHaveLength(3);
    expect(validateMatrixPlan(c, next)).toEqual([]);
  });
});

describe('matrix placement store dispatch', () => {
  it('previews legal matrix drags with one undo entry only on commit', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    const c = matrixChip();
    const initial = createEmptyWorkspace(c.id);
    initial.assignments = {
      '5': { peripheral: 'SPI2', signal: 'SCK', af: null },
      '6': { peripheral: 'SPI2', signal: 'MOSI', af: null },
      '7': { peripheral: 'SPI2', signal: 'MISO', af: null },
    };
    stubCatalogChips(catalogStore, c);
    await workspaceStore.openMcu(c.id, initial);
    const preference: PinPlacementPreference = { angle: 90, ring: 'high', enabled: true };

    workspaceStore.previewPlacement('SPI2', preference);
    expect(workspaceStore.canUndo).toBe(false);
    expect(Object.keys(workspaceStore.state.assignments)).toHaveLength(3);
    expect(validateMatrixPlan(c, workspaceStore.state)).toEqual([]);

    const preview = structuredClone(workspaceStore.state.assignments);
    workspaceStore.previewPlacement('SPI2', { ...preference, angle: 180 });
    expect(validateMatrixPlan(c, workspaceStore.state)).toEqual([]);
    expect(workspaceStore.canUndo).toBe(false);

    workspaceStore.cancelPlacementPreview();
    expect(workspaceStore.state.assignments).toEqual(initial.assignments);

    workspaceStore.previewPlacement('SPI2', preference);
    workspaceStore.commitPlacement('SPI2', preference);
    expect(workspaceStore.canUndo).toBe(true);
    expect(Object.keys(workspaceStore.state.assignments)).toHaveLength(3);
    expect(validateMatrixPlan(c, workspaceStore.state)).toEqual([]);
    workspaceStore.undo();
    expect(workspaceStore.state.assignments).toEqual(initial.assignments);
    vi.unstubAllGlobals();
  });

  it('keeps non-matrix chips on the greedy reallocation path', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src/state/workspace.svelte.ts'), 'utf8');
    expect(store).toContain("getChipMuxModel(this.chip) === 'gpio-matrix'");
    expect(store).toContain('reallocateMatrixPlacement(this.chip, next, peripheral, preference)');
    expect(store).toContain('reallocatePeripheralPlacement(this.chip, next, peripheral, preference)');
    const baseline = reallocatePeripheralPlacement(chip, empty, 'SPI1', null);
    expect(baseline.assignments).toEqual({});
    expect(validateMatrixPlan(chip, baseline)).toEqual([]);
  });
});
