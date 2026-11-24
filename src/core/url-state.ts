import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import {
  PINCRAFT_STATE_VERSION,
  normalizePackageRotation,
  parseGpioConfig,
  type GpioConfig,
  type PackageRotation,
  type PinPlacementPreference,
  type PinAssignment,
  type PioPinAssignment,
  type WorkspaceState,
} from './types';
import {
  canonicalPinPlacementPreference,
  normalizeAngle,
  parsePinPlacementPreference,
} from './placement';

type CompactAssignment = [
  string,
  string,
  number | null,
  (string | null)?,
  (number | null)?,
  (string | null)?,
];
type CompactPio = [string, number | undefined, string | undefined];
/** Physical position -> [level, drive, pull, speed], only when non-empty. */
type CompactGpio = [string, string, string, string];
/** Peripheral -> [angle, ring, enabled as 0/1], only when non-empty. */
type CompactPlacement = [number, string, number];

interface CompactUrlPayload {
  v: 2;
  m: string;
  a?: Record<string, CompactAssignment>;
  l?: Record<string, string>;
  k?: string[];
  p?: Record<string, string>;
  /** Peripheral -> active remap ID (only present when non-empty). */
  r?: Record<string, number>;
  /** Physical position -> [instance, state machine, role] (only when non-empty). */
  o?: Record<string, CompactPio>;
  /** Physical position -> [level, drive, pull, speed] (only when non-empty). */
  g?: Record<string, CompactGpio>;
  /** Peripheral -> [angle, ring, enabled] (only when non-empty). */
  y?: Record<string, CompactPlacement>;
  /** Placement overlay visibility (only when true). */
  w?: 1;
  /** Package rotation, emitted only for non-default clockwise values. */
  z?: PackageRotation;
  /** Display-only overlay rotation in degrees, emitted only when non-zero. */
  q?: number;
}

export type DecodeResult =
  | { ok: true; state: WorkspaceState }
  | { ok: false; error: string };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const cleaned = encoded.trim();
  if (!cleaned || !/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    throw new Error('Invalid Base64URL characters in shared link payload.');
  }
  const padLen = (4 - (cleaned.length % 4)) % 4;
  const base64 = cleaned.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function sortedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).sort((a, b) => a.localeCompare(b));
}

/**
 * Encode a workspace into a compressed, URL-safe share payload.
 * Remap, PIO, GPIO config and placement maps are included only when populated
 * to keep links short. View preferences such as the dock tab are deliberately
 * excluded because they are local UI state, not shareable pin configuration.
 */
export function encodeWorkspaceState(state: WorkspaceState): string {
  const payload: CompactUrlPayload = {
    v: PINCRAFT_STATE_VERSION,
    m: state.mcuId,
  };

  const assignmentEntries = sortedKeys(state.assignments as Record<string, unknown>);
  if (assignmentEntries.length > 0) {
    payload.a = {};
    for (const pos of assignmentEntries) {
      const asgn = state.assignments[pos];
      const row: CompactAssignment = [asgn.peripheral, asgn.signal, asgn.af];
      if (
        asgn.funcLabel !== undefined ||
        asgn.remapId !== undefined ||
        asgn.resourceId !== undefined
      ) {
        row.push(asgn.funcLabel ?? null, asgn.remapId ?? null, asgn.resourceId ?? null);
      }
      payload.a[pos] = row;
    }
  }

  const labelEntries = Object.entries(state.labels)
    .filter(([, val]) => val.trim().length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (labelEntries.length > 0) {
    payload.l = Object.fromEntries(labelEntries);
  }

  const lockedList = Object.entries(state.locked)
    .filter(([, isLocked]) => Boolean(isLocked))
    .map(([pos]) => pos)
    .sort((a, b) => a.localeCompare(b));
  if (lockedList.length > 0) {
    payload.k = lockedList;
  }

  const modeEntries = Object.entries(state.peripheralModes)
    .filter(([, mode]) => Boolean(mode) && mode !== 'disabled')
    .sort(([a], [b]) => a.localeCompare(b));
  if (modeEntries.length > 0) {
    payload.p = Object.fromEntries(modeEntries);
  }

  if (state.activeRemaps && Object.keys(state.activeRemaps).length > 0) {
    payload.r = {};
    for (const peripheral of sortedKeys(state.activeRemaps as Record<string, unknown>)) {
      payload.r[peripheral] = state.activeRemaps[peripheral];
    }
  }

  if (state.pioAssignments && Object.keys(state.pioAssignments).length > 0) {
    payload.o = {};
    for (const pos of sortedKeys(state.pioAssignments as Record<string, unknown>)) {
      const pio = state.pioAssignments[pos];
      payload.o[pos] = [pio.instance, pio.sm, pio.role];
    }
  }

  if (state.gpioConfig && Object.keys(state.gpioConfig).length > 0) {
    payload.g = {};
    for (const pos of sortedKeys(state.gpioConfig as Record<string, unknown>)) {
      const config = state.gpioConfig[pos];
      payload.g[pos] = [config.outputLevel, config.drive, config.pull, config.speed];
    }
  }

  if (state.placementOverlayVisible) payload.w = 1;
  const rotation = normalizePackageRotation(state.packageRotation);
  if (rotation !== 0) payload.z = rotation;
  const overlayRotation = normalizeAngle(state.placementOverlayRotation ?? 0);
  if (overlayRotation !== 0) payload.q = overlayRotation;
  if (state.placement && Object.keys(state.placement).length > 0) {
    payload.y = {};
    for (const peripheral of sortedKeys(state.placement as Record<string, unknown>)) {
      const pref = canonicalPinPlacementPreference(state.placement[peripheral]);
      payload.y[peripheral] = [pref.angle, pref.ring, pref.enabled ? 1 : 0];
    }
  }

  const json = JSON.stringify(payload);
  const deflated = deflateSync(strToU8(json), { level: 9 });
  return bytesToBase64Url(deflated);
}

/** Decode a share payload, returning a banner-friendly error for bad links. */
export function decodeWorkspaceState(encoded: string): DecodeResult {
  try {
    const compressed = base64UrlToBytes(encoded);
    const raw = strFromU8(inflateSync(compressed));
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Decoded share payload is not a valid object.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.v !== PINCRAFT_STATE_VERSION) {
      return {
        ok: false,
        error: `Unsupported share link version: ${String(obj.v)}.`,
      };
    }
    if (typeof obj.m !== 'string' || obj.m.trim().length === 0) {
      return { ok: false, error: 'Share link is missing a valid MCU identifier.' };
    }

    const assignments: Record<string, PinAssignment> = {};
    if (obj.a && typeof obj.a === 'object' && !Array.isArray(obj.a)) {
      for (const [pos, val] of Object.entries(obj.a as Record<string, unknown>)) {
        if (!Array.isArray(val) || val.length < 2) continue;
        const [peripheral, signal, af, funcLabel, remapId, resourceId] = val;
        if (typeof peripheral !== 'string' || typeof signal !== 'string') continue;
        assignments[pos] = {
          peripheral,
          signal,
          af: typeof af === 'number' ? af : null,
          ...(typeof funcLabel === 'string' ? { funcLabel } : {}),
          ...(typeof remapId === 'number' ? { remapId } : {}),
          ...(typeof resourceId === 'string' ? { resourceId } : {}),
        };
      }
    }

    const labels: Record<string, string> = {};
    if (obj.l && typeof obj.l === 'object' && !Array.isArray(obj.l)) {
      for (const [pos, val] of Object.entries(obj.l as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          labels[pos] = val;
        }
      }
    }

    const locked: Record<string, boolean> = {};
    if (Array.isArray(obj.k)) {
      for (const pos of obj.k) {
        if (typeof pos === 'string') locked[pos] = true;
      }
    }

    const peripheralModes: Record<string, string> = {};
    if (obj.p && typeof obj.p === 'object' && !Array.isArray(obj.p)) {
      for (const [periph, mode] of Object.entries(obj.p as Record<string, unknown>)) {
        if (typeof mode === 'string' && mode.trim().length > 0) {
          peripheralModes[periph] = mode;
        }
      }
    }

    const state: WorkspaceState = {
      mcuId: obj.m.trim(),
      assignments,
      labels,
      locked,
      peripheralModes,
    };

    if (obj.r && typeof obj.r === 'object' && !Array.isArray(obj.r)) {
      const remaps: Record<string, number> = {};
      for (const [peripheral, id] of Object.entries(obj.r as Record<string, unknown>)) {
        if (typeof id === 'number') remaps[peripheral] = id;
      }
      if (Object.keys(remaps).length > 0) state.activeRemaps = remaps;
    }

    if (obj.o && typeof obj.o === 'object' && !Array.isArray(obj.o)) {
      const pioAssignments: Record<string, PioPinAssignment> = {};
      for (const [pos, val] of Object.entries(obj.o as Record<string, unknown>)) {
        if (!Array.isArray(val) || typeof val[0] !== 'string') continue;
        pioAssignments[pos] = {
          instance: val[0],
          ...(typeof val[1] === 'number' ? { sm: val[1] } : {}),
          ...(typeof val[2] === 'string' ? { role: val[2] } : {}),
        };
      }
      if (Object.keys(pioAssignments).length > 0) state.pioAssignments = pioAssignments;
    }

    if (obj.g && typeof obj.g === 'object' && !Array.isArray(obj.g)) {
      const gpioConfig: Record<string, GpioConfig> = {};
      for (const [pos, val] of Object.entries(obj.g as Record<string, unknown>)) {
        if (!Array.isArray(val) || val.length < 4) continue;
        const [outputLevel, drive, pull, speed] = val;
        const config = parseGpioConfig({ outputLevel, drive, pull, speed });
        if (config) gpioConfig[pos] = config;
      }
      if (Object.keys(gpioConfig).length > 0) state.gpioConfig = gpioConfig;
    }

    if (obj.w === 1 || obj.w === true) state.placementOverlayVisible = true;
    // Legacy `d` values from earlier links are ignored: the dock tab is now a
    // localStorage-only UI preference and must not enter shared state.
    const rotation = normalizePackageRotation(obj.z);
    if (rotation !== 0) state.packageRotation = rotation;
    if (typeof obj.q === 'number') {
      const overlayRotation = normalizeAngle(obj.q);
      if (overlayRotation !== 0) state.placementOverlayRotation = overlayRotation;
    }
    if (obj.y && typeof obj.y === 'object' && !Array.isArray(obj.y)) {
      const placement: Record<string, PinPlacementPreference> = {};
      for (const [peripheral, val] of Object.entries(obj.y as Record<string, unknown>)) {
        if (!Array.isArray(val) || val.length < 3) continue;
        const [angle, ring, enabled] = val;
        const parsed = parsePinPlacementPreference({
          angle,
          ring,
          enabled: enabled === 1 || enabled === true,
        });
        if (parsed) placement[peripheral] = parsed;
      }
      if (Object.keys(placement).length > 0) state.placement = placement;
    }

    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Failed to decode shared pinout link: ${err.message}`
          : 'Failed to decode shared pinout link.',
    };
  }
}
