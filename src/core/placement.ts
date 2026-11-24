import {
  PLACEMENT_RINGS,
  PLACEMENT_RING_RANK,
  type ChipData,
  type LegacyPlacementRing,
  type PackageInfo,
  type PeripheralStatus,
  type PinAssignment,
  type PinInfo,
  type PinPlacementPreference,
  type PlacementRing,
  type WorkspaceState,
} from './types';
import { partitionPeripherals } from './vendor-view';

/** Normalized placement view used by every persistence surface. */
export interface PlacementSettings {
  overlayVisible: boolean;
  preferences: Record<string, PinPlacementPreference>;
}

/** One draggable peripheral indicator shown by the placement overlay. */
export interface PlacementIndicator {
  name: string;
  preference: PinPlacementPreference | null;
  claimed: string[];
}

/** Legacy spatial names mapped onto the current priority ring identifiers. */
const LEGACY_RING_MAP: Record<LegacyPlacementRing, PlacementRing> = {
  inner: 'high',
  middle: 'medium',
  outer: 'low',
};

/** Normalize a persisted ring name, accepting legacy spatial identifiers. */
export function normalizePlacementRing(value: unknown): PlacementRing | null {
  if (typeof value !== 'string') return null;
  if ((PLACEMENT_RINGS as readonly string[]).includes(value)) return value as PlacementRing;
  if (Object.prototype.hasOwnProperty.call(LEGACY_RING_MAP, value)) {
    return LEGACY_RING_MAP[value as LegacyPlacementRing];
  }
  return null;
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

/** Validate one untrusted persisted placement preference, normalizing legacy rings. */
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
 */
export function normalizePlacement(
  state: Pick<WorkspaceState, 'placement' | 'placementOverlayVisible'>,
): PlacementSettings {
  const preferences: Record<string, PinPlacementPreference> = {};
  if (state.placement && typeof state.placement === 'object') {
    for (const [peripheral, raw] of Object.entries(state.placement)) {
      const parsed = parsePinPlacementPreference(raw);
      if (parsed) preferences[peripheral] = parsed;
    }
  }
  return { overlayVisible: Boolean(state.placementOverlayVisible), preferences };
}

/** One pin's polar position relative to the package centre. */
export interface PinGeometry {
  pos: string;
  angle: number;
  radius: number;
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
    });
  }
  return { byPos, maxRadius };
}

/**
 * Derive every pin's angle and radius from the package centre. Perimeter
 * packages use `sides` with the canonical pin order; grid packages use
 * `rows`/`cols`. Two-sided packages simply have no bottom/top segment, so all
 * pins still receive finite polar coordinates.
 */
export function buildPinGeometryMap(chip: ChipData): PinGeometryMap {
  return chip.package.kind === 'grid'
    ? gridGeometry(chip.pins, chip.package)
    : perimeterGeometry(chip.pins, chip.package);
}

/** Optional scoring input: a preference and a reusable geometry cache. */
export interface PlacementAffinityContext {
  preference?: PinPlacementPreference | null;
  geometry?: PinGeometryMap;
}

/** Additive placement term; exactly zero when no preference is enabled. */
export function placementAffinityForPin(
  pin: PinInfo,
  chip: ChipData,
  preference: PinPlacementPreference | null | undefined,
  context: Pick<PlacementAffinityContext, 'geometry'> = {},
): number {
  if (!preference?.enabled) return 0;
  const geometry = context.geometry ?? buildPinGeometryMap(chip);
  const pinGeometry = geometry.byPos.get(pin.pos);
  const angle = pinGeometry?.angle ?? 0;
  const radius = pinGeometry?.radius ?? 1;

  // Inter-ring priority dominates scarcity; intra-ring ranking combines
  // angular closeness with a smaller radial term that favors outer balls.
  const rank = PLACEMENT_RING_RANK[normalizePlacementRing(preference.ring) ?? 'low'] ?? 2;
  const angularPenalty = (angularGap(angle, preference.angle) / 180) * 60;
  const radialPenalty = (1 - Math.min(1, radius / Math.max(1e-6, geometry.maxRadius))) * 30;
  return rank * 10000 + angularPenalty + radialPenalty;
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
