import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { PinAssignment, WorkspaceState } from './types';

interface CompactUrlPayload {
  v: 1;
  m: string;
  a?: Record<string, [string, string, number | null]>;
  l?: Record<string, string>;
  k?: string[];
  p?: Record<string, string>;
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

export function encodeWorkspaceState(state: WorkspaceState): string {
  const payload: CompactUrlPayload = {
    v: 1,
    m: state.mcuId,
  };

  const assignmentEntries = Object.entries(state.assignments).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (assignmentEntries.length > 0) {
    payload.a = {};
    for (const [pos, asgn] of assignmentEntries) {
      payload.a[pos] = [asgn.peripheral, asgn.signal, asgn.af];
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

  const json = JSON.stringify(payload);
  const deflated = deflateSync(strToU8(json), { level: 9 });
  return bytesToBase64Url(deflated);
}

export function decodeWorkspaceState(encoded: string): DecodeResult {
  try {
    const compressed = base64UrlToBytes(encoded);
    const raw = strFromU8(inflateSync(compressed));
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Decoded share payload is not a valid object.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.v !== 1) {
      return { ok: false, error: `Unsupported share link version: ${String(obj.v)}.` };
    }
    if (typeof obj.m !== 'string' || obj.m.trim().length === 0) {
      return { ok: false, error: 'Share link is missing a valid MCU identifier.' };
    }

    const assignments: Record<string, PinAssignment> = {};
    if (obj.a && typeof obj.a === 'object' && !Array.isArray(obj.a)) {
      for (const [pos, val] of Object.entries(obj.a as Record<string, unknown>)) {
        if (Array.isArray(val) && val.length >= 2) {
          const [peripheral, signal, af] = val;
          if (typeof peripheral === 'string' && typeof signal === 'string') {
            assignments[pos] = {
              peripheral,
              signal,
              af: typeof af === 'number' ? af : null,
            };
          }
        } else if (val && typeof val === 'object') {
          const rec = val as Record<string, unknown>;
          if (typeof rec.peripheral === 'string' && typeof rec.signal === 'string') {
            assignments[pos] = {
              peripheral: rec.peripheral,
              signal: rec.signal,
              af: typeof rec.af === 'number' ? rec.af : null,
            };
          }
        }
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
    } else if (obj.k && typeof obj.k === 'object') {
      for (const [pos, val] of Object.entries(obj.k as Record<string, unknown>)) {
        if (Boolean(val)) locked[pos] = true;
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

    return {
      ok: true,
      state: {
        mcuId: obj.m.trim(),
        assignments,
        labels,
        locked,
        peripheralModes,
      },
    };
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
