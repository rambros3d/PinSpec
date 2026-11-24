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
  normalizeAngle,
  normalizePlacement,
  orderPeripheralsByPlacement,
  placementAffinityForPin,
} from '../src/core/placement';
import {
  allocatePeripheralMode,
  computePinScarcityScore,
  createEmptyWorkspace,
  findOneHopFixForSignal,
  reallocatePeripheralPlacement,
  reallocatePlacementOrdered,
  togglePeripheralSignal,
} from '../src/core/solver';
import type { ChipData, WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

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
      placementAffinityForPin(chip.pins[3], chip, { angle: 0, ring: 'inner', enabled: false }, { geometry }),
    ).toBe(0);
  });

  it('enforces strict inter-ring ordering before angular score', () => {
    const make = (ring: 'inner' | 'middle' | 'outer') =>
      placementAffinityForPin(chip.pins[3], chip, { angle: target.angle, ring, enabled: true }, { geometry });
    const inner = make('inner');
    const middle = make('middle');
    const outer = make('outer');
    expect(inner).toBeLessThan(middle);
    expect(middle).toBeLessThan(outer);
    expect(outer - middle).toBe(10000);
    expect(middle - inner).toBe(10000);
  });

  it('prefers the angularly closer pin and, on a tie, the outer ball', () => {
    const preference = { angle: target.angle, ring: 'inner' as const, enabled: true };
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
    const gridPreference = { angle: 0, ring: 'inner' as const, enabled: true };
    // Centre and right-edge pins both lie on angle 0; the outer ball wins.
    const centre = placementAffinityForPin(grid.pins[4], grid, gridPreference, { geometry: gridGeometry });
    const outer = placementAffinityForPin(grid.pins[5], grid, gridPreference, { geometry: gridGeometry });
    expect(outer).toBeLessThan(centre);
  });

  it('orders enabled peripherals by ring and keeps unconfigured ones last', () => {
    const state: WorkspaceState = {
      ...empty,
      placement: {
        OUT: { angle: 0, ring: 'outer', enabled: true },
        MID: { angle: 0, ring: 'middle', enabled: true },
        IN: { angle: 0, ring: 'inner', enabled: true },
        OFF: { angle: 0, ring: 'inner', enabled: false },
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
      placement: { SPI1: { angle: 90, ring: 'inner', enabled: false } },
      placementOverlayVisible: true,
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
        SPI1: { angle: geometry.byPos.get('5')!.angle, ring: 'inner', enabled: true },
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
        SPI1: { angle: preferredAngle, ring: 'inner', enabled: true },
        USART1: { angle: preferredAngle, ring: 'outer', enabled: true },
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
    catalogStore.primeChip(chip);
    await workspaceStore.openMcu(chip.id);
    workspaceStore.assignPin('2', { peripheral: 'SPI1', signal: 'SCK', af: 5 });
    workspaceStore.assignPin('6', { peripheral: 'SPI1', signal: 'MISO', af: 5 });
    workspaceStore.toggleLock('6');
    workspaceStore.assignPin('4', { peripheral: 'SPI1', signal: 'MOSI', af: 5 });

    const geometry = buildPinGeometryMap(chip);
    const preference = {
      angle: geometry.byPos.get('5')!.angle,
      ring: 'inner' as const,
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
    placementOverlayVisible: true,
    placement: {
      SPI1: { angle: 123.5, ring: 'inner', enabled: true },
      USART1: { angle: 300, ring: 'outer', enabled: false },
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
          SPI1: { angle: 90, ring: 'inner', enabled: true },
        },
      }),
    ).toBe(false);
    expect(statesEqual(placementState, { ...placementState, placementOverlayVisible: false })).toBe(false);
  });

  it('normalizes absent fields to disabled defaults', () => {
    expect(normalizePlacement(empty)).toEqual({ overlayVisible: false, preferences: {} });
    const normalized = normalizePlacement({
      placement: { BAD: { angle: Number.NaN, ring: 'inner', enabled: true } },
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
    expect(decodeRawPayload(encodeWorkspaceState(placementState))).toHaveProperty('w', 1);
    expect(decodeRawPayload(encodeWorkspaceState(empty))).not.toHaveProperty('y');
    expect(decodeRawPayload(encodeWorkspaceState(empty))).not.toHaveProperty('w');

    const text = exportPinoutJson(placementState, 'stm32');
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(doc.version).toBe(2);
    expect(doc.placementOverlayVisible).toBe(true);
    expect(Object.keys(doc.placement as object)).toEqual(['SPI1', 'USART1']);
    const parsed = parsePinoutJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(placementState);
    expect(parsePinoutJson(exportPinoutJson(empty))).toEqual({ ok: true, state: empty });
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

  it('persists placement and the overlay toggle in localStorage sessions', async () => {
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
    catalogStore.primeChip(chip);
    await workspaceStore.openMcu(chip.id);
    workspaceStore.setPlacement('SPI1', { angle: 123.5, ring: 'inner', enabled: true });
    workspaceStore.setPlacementOverlayVisible(true);

    const sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placement).toEqual({ SPI1: { angle: 123.5, ring: 'inner', enabled: true } });
    expect(sessions[0].state.placementOverlayVisible).toBe(true);
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
      'type="number"',
      'indicator.name',
      'ringFromEvent',
      'overlayRotation',
      'onRotate',
    ]) {
      expect(overlay, token).toContain(token);
    }
    expect(overlay).not.toContain('onRing');
    expect(overlay).not.toContain('handleRingChange');
    expect(canvas).not.toContain('onRing=');
    expect(canvas).not.toContain('handlePlacementRing');
  });

  it('forwards the persisted rotation alongside the overlay', () => {
    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('rotation: PackageRotation');
    expect(canvas).toContain('{rotation}');
    expect(canvas).toContain('rotation === -90');
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

  it('uses tighter ring spacing with a larger outer ring', () => {
    const overlay = readOverlay();
    expect(overlay).toContain('inner: 0.5');
    expect(overlay).toContain('middle: 0.72');
    expect(overlay).toContain('outer: 0.98');
    expect(overlay).not.toContain('0.34');
    expect(overlay).not.toContain('0.66');
    expect(overlay).not.toContain('0.96');
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

  it('keeps the bottom-centre toggle separate from the horizontal top-right view HUD', () => {
    const canvas = readCanvas();
    expect(canvas).toContain('absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none');
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
    const placement = { SPI1: { angle: 30, ring: 'inner' as const, enabled: true } };
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
    catalogStore.primeChip(chip);
    await workspaceStore.openMcu(chip.id);

    workspaceStore.setPlacement('SPI1', { angle: 10, ring: 'inner', enabled: true });
    workspaceStore.previewPlacement('SPI1', { angle: 20, ring: 'middle', enabled: true });
    expect(workspaceStore.state.placement?.SPI1?.angle).toBe(20);
    workspaceStore.undo();
    expect(workspaceStore.state.placement).toBeUndefined();
    workspaceStore.redo();
    expect(workspaceStore.state.placement?.SPI1).toEqual({
      angle: 10,
      ring: 'inner',
      enabled: true,
    });

    workspaceStore.commitPlacement('SPI1', { angle: 30, ring: 'outer', enabled: true });
    workspaceStore.undo();
    expect(workspaceStore.state.placement?.SPI1?.ring).toBe('inner');

    workspaceStore.setPlacementOverlayRotation(90);
    expect(workspaceStore.state.placementOverlayRotation).toBe(90);
    let sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placementOverlayRotation).toBe(90);
    workspaceStore.undo();
    workspaceStore.redo();
    expect(workspaceStore.state.placementOverlayRotation).toBe(90);
    sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
      state: WorkspaceState;
    }>;
    expect(sessions[0].state.placementOverlayRotation).toBe(90);
    vi.unstubAllGlobals();
  });

  it('derives ring indicators only from enabled preferences', () => {
    const canvas = readCanvas();
    expect(canvas).toContain('placementOptions');
    expect(canvas).toContain('info.signals.length > 0 || info.kind === \'sys\'');
    expect(canvas).toContain('placementSettings.preferences[name]?.enabled');
    expect(canvas).toContain('if (preference.enabled) names.add(name)');
    expect(canvas).toContain(
      "workspaceStore.setPlacement(name, { angle: 0, ring: 'outer', enabled: true })",
    );
    const overlay = readOverlay();
    expect(overlay).toContain('{enabledNames.has(option) ? \'\' : \' (off)\'}');
    expect(overlay).toContain('Enable {selected}');
  });
});
