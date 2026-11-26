import {
  PLACEMENT_RINGS,
  PLACEMENT_RING_RANK,
  type ChipData,
  type AlternatePinCandidate,
  type PackageInfo,
  type PeripheralStatus,
  type PinAssignment,
  type PinInfo,
  type PinPlacementPreference,
  type PinSignal,
  type PinTag,
  type PlacementRing,
  type WorkspaceState,
} from './types';
import { RING_RADIUS_FACTORS } from './placement-rings';
import { partitionPeripherals } from './vendor-view';

/** Normalized shareable placement preferences used by every persistence surface. */
export interface PlacementSettings {
  preferences: Record<string, PinPlacementPreference>;
}

/** One draggable peripheral indicator shown by the placement overlay. */
export interface PlacementIndicator {
  name: string;
  preference: PinPlacementPreference | null;
  claimed: string[];
}

/** Normalize a persisted ring name to the current priority identifiers. */
export function normalizePlacementRing(value: unknown): PlacementRing | null {
  if (typeof value !== 'string') return null;
  return (PLACEMENT_RINGS as readonly string[]).includes(value) ? (value as PlacementRing) : null;
}

/** Derive an angle from a peripheral preference, wrapping into [0, 360). */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

/** Angular separation in degrees, always in [0, 180]. */
export function angularGap(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return Math.min(diff, 360 - diff);
}

/** Validate one untrusted persisted placement preference against current rings. */
export function parsePinPlacementPreference(value: unknown): PinPlacementPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.angle !== 'number' || !Number.isFinite(rec.angle)) return null;
  const ring = normalizePlacementRing(rec.ring);
  if (!ring) return null;
  if (typeof rec.enabled !== 'boolean') return null;
  return { angle: normalizeAngle(rec.angle), ring, enabled: rec.enabled };
}

/** Emit preference fields in a fixed order, with only current ring names. */
export function canonicalPinPlacementPreference(
  preference: PinPlacementPreference,
): PinPlacementPreference {
  return {
    angle: normalizeAngle(preference.angle),
    ring: normalizePlacementRing(preference.ring) ?? 'low',
    enabled: preference.enabled,
  };
}

/**
 * Supply disabled defaults for missing placement data. All codecs and the UI
 * read this normalizer so version-2 payloads without placement remain valid.
 * Overlay visibility is a local view preference and is deliberately omitted.
 */
export function normalizePlacement(
  state: Pick<WorkspaceState, 'placement'>,
): PlacementSettings {
  const preferences: Record<string, PinPlacementPreference> = {};
  if (state.placement && typeof state.placement === 'object') {
    for (const [peripheral, raw] of Object.entries(state.placement)) {
      const parsed = parsePinPlacementPreference(raw);
      if (parsed) preferences[peripheral] = parsed;
    }
  }
  return { preferences };
}

/** One pad centre in package space, in both Cartesian and polar form. */
export interface PinGeometry {
  pos: string;
  angle: number;
  radius: number;
  x: number;
  y: number;
}

/** Precomputed pin geometry plus the largest radius for radial normalization. */
export interface PinGeometryMap {
  byPos: Map<string, PinGeometry>;
  maxRadius: number;
}

function fallbackSides(packageInfo: PackageInfo): [number, number, number, number] {
  const n = Math.max(0, packageInfo.pinCount || 0);
  const left = Math.ceil(n / 4);
  const bottom = Math.ceil(n / 4);
  const right = Math.ceil(n / 4);
  return [left, bottom, right, Math.max(0, n - left - bottom - right)];
}

function perimeterGeometry(pins: PinInfo[], packageInfo: PackageInfo): PinGeometryMap {
  const sides = packageInfo.sides ?? fallbackSides(packageInfo);
  const [left, bottom, right, top] = sides.map((n) => Math.max(0, n)) as [
    number,
    number,
    number,
    number,
  ];
  const total = left + bottom + right + top;
  const byPos = new Map<string, PinGeometry>();
  let maxRadius = 1;

  for (const [index, pin] of pins.entries()) {
    const i = total > 0 ? index % total : 0;
    let x = -1;
    let y = 1;
    if (i < left) {
      x = -1;
      y = 1 - (2 * (i + 0.5)) / Math.max(1, left);
    } else if (i < left + bottom) {
      x = -1 + (2 * (i - left + 0.5)) / Math.max(1, bottom);
      y = -1;
    } else if (i < left + bottom + right) {
      x = 1;
      y = -1 + (2 * (i - left - bottom + 0.5)) / Math.max(1, right);
    } else {
      x = 1 - (2 * (i - left - bottom - right + 0.5)) / Math.max(1, top);
      y = 1;
    }
    const radius = Math.hypot(x, y);
    maxRadius = Math.max(maxRadius, radius);
    byPos.set(pin.pos, {
      pos: pin.pos,
      angle: normalizeAngle((Math.atan2(y, x) * 180) / Math.PI),
      radius,
      x,
      y,
    });
  }
  return { byPos, maxRadius };
}

function gridGeometry(pins: PinInfo[], packageInfo: PackageInfo): PinGeometryMap {
  const n = pins.length;
  const rowCount = packageInfo.rows?.length || Math.max(1, Math.ceil(Math.sqrt(n)));
  const colCount = packageInfo.cols?.length || Math.max(1, Math.ceil(n / rowCount));
  const xCenter = (colCount - 1) / 2;
  const yCenter = (rowCount - 1) / 2;
  const byPos = new Map<string, PinGeometry>();
  let maxRadius = 1;

  for (const [index, pin] of pins.entries()) {
    const row = Math.floor(index / colCount);
    const col = index % colCount;
    const x = (col - xCenter) / Math.max(1, xCenter);
    const y = (yCenter - row) / Math.max(1, yCenter);
    const radius = Math.hypot(x, y);
    maxRadius = Math.max(maxRadius, radius);
    byPos.set(pin.pos, {
      pos: pin.pos,
      angle: normalizeAngle((Math.atan2(y, x) * 180) / Math.PI),
      radius,
      x,
      y,
    });
  }
  return { byPos, maxRadius };
}

/**
 * Derive every pin's pad centre from the package centre in one coordinate
 * system. Perimeter packages use `sides` with the canonical pin order; grid
 * packages use `rows`/`cols`. Both retain angle and radius for existing
 * consumers and add Cartesian x/y for distance-based scoring. No DOM value
 * enters this pure helper.
 */
export function buildPinGeometryMap(chip: ChipData): PinGeometryMap {
  return chip.package.kind === 'grid'
    ? gridGeometry(chip.pins, chip.package)
    : perimeterGeometry(chip.pins, chip.package);
}

/** A placement bubble point in the same package-space coordinates as pad centres. */
export interface PlacementBubblePoint {
  x: number;
  y: number;
  radius: number;
}

/**
 * Map the stored angle and priority ring to a bubble point. Ring radii reuse
 * the canvas factors (1.4 / 1.55 / 1.7) applied to the shared geometry's
 * largest pad-centre radius, so scoring and the visible rings stay aligned.
 */
export function placementBubblePoint(
  preference: PinPlacementPreference,
  geometry: PinGeometryMap,
): PlacementBubblePoint {
  const ring = normalizePlacementRing(preference.ring) ?? 'low';
  const radius = RING_RADIUS_FACTORS[ring] * Math.max(1e-6, geometry.maxRadius);
  const radians = (normalizeAngle(preference.angle) * Math.PI) / 180;
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius, radius };
}

/** Optional scoring input: a preference and a reusable geometry cache. */
export interface PlacementAffinityContext {
  preference?: PinPlacementPreference | null;
  geometry?: PinGeometryMap;
}

/**
 * Additive placement term; exactly zero when no preference is enabled. The
 * ring rank dominates every other term; within one ring the penalty is the
 * normalized Euclidean distance from the bubble to the pad centre, scaled into
 * 0-60 by the bubble radius plus the farthest pad-centre radius.
 */
export function placementAffinityForPin(
  pin: PinInfo,
  chip: ChipData,
  preference: PinPlacementPreference | null | undefined,
  context: Pick<PlacementAffinityContext, 'geometry'> = {},
): number {
  if (!preference?.enabled) return 0;
  const geometry = context.geometry ?? buildPinGeometryMap(chip);
  const pinGeometry = geometry.byPos.get(pin.pos);
  const bubble = placementBubblePoint(preference, geometry);
  const distance = Math.hypot(
    (pinGeometry?.x ?? 0) - bubble.x,
    (pinGeometry?.y ?? 0) - bubble.y,
  );
  const worstCase = Math.max(1e-6, bubble.radius + geometry.maxRadius);
  const penalty = Math.min(1, distance / worstCase) * 60;

  const rank = PLACEMENT_RING_RANK[normalizePlacementRing(preference.ring) ?? 'low'] ?? 2;
  return rank * 10000 + penalty;
}

/** Fixed cap for matrix alternate lists after legality filtering. */
export const MATRIX_ALTERNATE_CAP = 12;

function pinHasTag(pin: PinInfo, tag: PinTag): boolean {
  return Boolean(pin.tags?.includes(tag));
}

/** True when a declared Wi-Fi or Bluetooth peripheral is active. */
function radioActive(chip: ChipData, state: WorkspaceState): boolean {
  return Object.entries(chip.peripherals).some(([name]) => {
    if (!/WIFI|BLUETOOTH|BLE|(^|_)BT($|_)/i.test(name)) return false;
    const mode = state.peripheralModes[name];
    if (mode !== undefined) return mode !== 'disabled';
    return Object.values(state.assignments).some((asgn) => asgn.peripheral === name);
  });
}

/** The matrix signal matching a request, using the emitted pin signal list. */
function matrixSignal(pin: PinInfo, peripheral: string, signal: string): PinSignal | null {
  return (
    pin.signals.find((s) => s.peripheral === peripheral && s.signal === signal) ?? null
  );
}

/**
 * Deterministic electrical penalty derived from chip shard hazard facts.
 * Missing hazard data yields zero, so chips without ESP32 tags are unaffected.
 */
export function matrixElectricalPenalty(
  pin: PinInfo,
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  signal: string,
): number {
  if (!pinHasTag(pin, 'strapping') && !pinHasTag(pin, 'input-only') && !pinHasTag(pin, 'adc') &&
      !pinHasTag(pin, 'flash') && !pinHasTag(pin, 'psram')) {
    return 0;
  }
  const match = matrixSignal(pin, peripheral, signal);
  const drives = peripheral === 'GPIO' ? signal === 'Output' : match?.direction === 'output';
  let penalty = 0;
  if (pinHasTag(pin, 'strapping')) penalty += 40;
  if (drives && pinHasTag(pin, 'input-only')) penalty += 60;
  if (
    radioActive(chip, state) &&
    (peripheral === 'ADC2' || /^ADC2/.test(signal)) &&
    (pinHasTag(pin, 'adc') || pinHasTag(pin, 'adc-only'))
  ) {
    penalty += 60;
  }
  if (pinHasTag(pin, 'flash') || pinHasTag(pin, 'psram')) penalty += 80;
  return penalty;
}

/** Inputs used by a matrix legality check and its search state. */
export interface MatrixLegalityContext {
  chip: ChipData;
  state: WorkspaceState;
  peripheral: string;
  signal: string;
  /** Signals already claimed from another pin; matrix outputs are exempt. */
  usedSignals: ReadonlySet<string>;
  /** Pins already claimed by the search or by an existing assignment. */
  usedPins: ReadonlySet<string>;
  /** Exclusive channel resources already claimed. */
  usedResources: ReadonlySet<string>;
}

/**
 * Pure matrix candidate legality. Rejects occupied or locked pins, duplicated
 * inputs, repeated channel resources, input-only output roles, and pins
 * reserved for flash or PSRAM. Geometry is never part of legality.
 */
export function isMatrixCandidateLegal(
  pin: PinInfo,
  context: MatrixLegalityContext,
): boolean {
  if (pin.type !== 'io') return false;
  if (context.state.locked[pin.pos] || context.usedPins.has(pin.pos)) return false;
  if (context.state.assignments[pin.pos]) return false;
  const match = matrixSignal(pin, context.peripheral, context.signal);
  if (!match) return false;
  const drives =
    context.peripheral === 'GPIO' ? context.signal === 'Output' : match.direction === 'output';
  if (drives && pinHasTag(pin, 'input-only')) return false;
  if (pinHasTag(pin, 'flash') || pinHasTag(pin, 'psram')) return false;
  if (match.resourceId && context.usedResources.has(match.resourceId)) return false;
  if (match.direction !== 'output' && context.usedSignals.has(`${context.peripheral}:${context.signal}`)) {
    return false;
  }
  return true;
}

/** Matrix alternate with the ranking inputs exposed for diagnostics and tests. */
export interface MatrixAlternateCandidate extends AlternatePinCandidate {
  penalty: number;
  affinity: number;
}

/**
 * Rank matrix alternates by legality, electrical penalty, unchanged geometry
 * affinity, then physical position, and cap the result deterministically.
 */
export function rankMatrixAlternates(
  pins: readonly PinInfo[],
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  signal: string,
  usedSignals: ReadonlySet<string>,
  usedResources: ReadonlySet<string>,
  geometry?: PinGeometryMap,
): MatrixAlternateCandidate[] {
  const usedPins = new Set(Object.keys(state.assignments));
  const context: MatrixLegalityContext = {
    chip,
    state,
    peripheral,
    signal,
    usedSignals,
    usedPins,
    usedResources,
  };
  const preference = state.placement?.[peripheral];
  const affinityContext: PlacementAffinityContext = { preference, geometry };
  const candidates: MatrixAlternateCandidate[] = [];
  for (const pin of pins) {
    if (!isMatrixCandidateLegal(pin, context)) continue;
    const match = matrixSignal(pin, peripheral, signal)!;
    candidates.push({
      pos: pin.pos,
      pinName: pin.name,
      af: match.af,
      ...(match.funcLabel !== undefined ? { funcLabel: match.funcLabel } : {}),
      ...(match.resourceId !== undefined ? { resourceId: match.resourceId } : {}),
      status: 'free',
      penalty: matrixElectricalPenalty(pin, chip, state, peripheral, signal),
      affinity: placementAffinityForPin(pin, chip, preference, affinityContext),
    });
  }
  candidates.sort(
    (a, b) =>
      a.penalty - b.penalty ||
      a.affinity - b.affinity ||
      a.pos.localeCompare(b.pos, undefined, { numeric: true }),
  );
  return candidates.slice(0, MATRIX_ALTERNATE_CAP);
}

/**
 * Stable peripheral order for placement-driven allocation: enabled high-ring
 * preferences first, then medium, then low; unconfigured peripherals keep
 * their original relative order at the end.
 */
export function orderPeripheralsByPlacement(
  peripherals: readonly string[],
  state: WorkspaceState,
): string[] {
  const { preferences } = normalizePlacement(state);
  const originalIndex = new Map(peripherals.map((name, index) => [name, index]));
  return [...peripherals].sort((a, b) => {
    const pa = preferences[a];
    const pb = preferences[b];
    const ra = pa?.enabled
      ? PLACEMENT_RING_RANK[normalizePlacementRing(pa.ring) ?? 'low']
      : Number.MAX_SAFE_INTEGER;
    const rb = pb?.enabled
      ? PLACEMENT_RING_RANK[normalizePlacementRing(pb.ring) ?? 'low']
      : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
}

/**
 * Derive the configured peripheral names eligible for a placement bubble.
 * Reuses the shared configured/unconfigured partition so solver status and
 * selected modes stay authoritative; assigned system peripherals are included
 * because they hold real pin configuration even without assignable signals.
 */
export function configuredPeripheralNames(
  chip: ChipData,
  peripheralStatus: Record<string, PeripheralStatus>,
  peripheralModes: Record<string, string>,
  assignments: Record<string, PinAssignment> | null = null,
): string[] {
  const { configured } = partitionPeripherals(peripheralStatus, peripheralModes);
  const assigned = new Set<string>();
  if (assignments) {
    for (const asgn of Object.values(assignments)) {
      if (asgn.peripheral && asgn.peripheral !== 'GPIO') assigned.add(asgn.peripheral);
    }
  }
  const names = new Set(
    configured.filter(
      (name) => name !== 'GPIO' && (Boolean(chip.peripherals[name]) || assigned.has(name)),
    ),
  );
  // An assigned system peripheral stays eligible even without catalog signals.
  for (const name of assigned) names.add(name);
  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Axis-aligned rectangle expressed in stage-local CSS pixels. */
export interface MeasuredRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Stage bounds expressed in the same stage-local coordinate space. */
export interface StageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Largest radius centred on the stage that stays inside the stage bounds and
 * clears every measured furniture rectangle. Components measure rectangles in
 * the DOM; this helper only does arithmetic on plain numbers, so it stays
 * host-testable with no Svelte or browser imports. Degenerate input falls back
 * to a finite radius; transient overlays are never passed in as rectangles.
 */
export function measuredSafeRadius(
  centerX: number,
  centerY: number,
  bounds: StageBounds,
  reserved: readonly MeasuredRect[],
  fallback = 40,
): number {
  const safeFallback = Number.isFinite(fallback) && fallback > 0 ? fallback : 40;
  if (
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return safeFallback;
  }
  const left = Number.isFinite(bounds.left) ? bounds.left : 0;
  const top = Number.isFinite(bounds.top) ? bounds.top : 0;
  const margin = 6;
  let radius = Math.min(
    centerX - left,
    left + bounds.width - centerX,
    centerY - top,
    top + bounds.height - centerY,
  );
  for (const rect of reserved) {
    if (!rect) continue;
    const dx = Math.max(rect.left - centerX, 0, centerX - rect.right);
    const dy = Math.max(rect.top - centerY, 0, centerY - rect.bottom);
    radius = Math.min(radius, Math.hypot(dx, dy) - margin);
  }
  return Number.isFinite(radius) && radius >= 1 ? radius : safeFallback;
}
