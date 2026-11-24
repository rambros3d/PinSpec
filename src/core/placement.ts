import {
  PLACEMENT_RINGS,
  PLACEMENT_RING_RANK,
  type ChipData,
  type PackageInfo,
  type PinInfo,
  type PinPlacementPreference,
  type PlacementRing,
  type WorkspaceState,
} from './types';

/** Normalized placement view used by every persistence surface. */
export interface PlacementSettings {
  overlayVisible: boolean;
  preferences: Record<string, PinPlacementPreference>;
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

/** Validate one untrusted persisted placement preference. */
export function parsePinPlacementPreference(value: unknown): PinPlacementPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.angle !== 'number' || !Number.isFinite(rec.angle)) return null;
  if (!PLACEMENT_RINGS.includes(rec.ring as PlacementRing)) return null;
  if (typeof rec.enabled !== 'boolean') return null;
  return { angle: normalizeAngle(rec.angle), ring: rec.ring as PlacementRing, enabled: rec.enabled };
}

/** Emit preference fields in a fixed order for deterministic project files. */
export function canonicalPinPlacementPreference(
  preference: PinPlacementPreference,
): PinPlacementPreference {
  return { angle: normalizeAngle(preference.angle), ring: preference.ring, enabled: preference.enabled };
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
  const rank = PLACEMENT_RING_RANK[preference.ring] ?? 2;
  const angularPenalty = (angularGap(angle, preference.angle) / 180) * 60;
  const radialPenalty = (1 - Math.min(1, radius / Math.max(1e-6, geometry.maxRadius))) * 30;
  return rank * 10000 + angularPenalty + radialPenalty;
}

/**
 * Stable peripheral order for placement-driven allocation: enabled inner-ring
 * preferences first, then middle, then outer; unconfigured peripherals keep
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
    const ra = pa?.enabled ? PLACEMENT_RING_RANK[pa.ring] : Number.MAX_SAFE_INTEGER;
    const rb = pb?.enabled ? PLACEMENT_RING_RANK[pb.ring] : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
}
