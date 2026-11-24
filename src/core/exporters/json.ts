import type { PinAssignment, WorkspaceState } from '../types';

export interface PinCraftProjectFile {
  format: 'pincraft-pinout';
  version: 1;
  mcuId: string;
  peripheralModes: Record<string, string>;
  assignments: Record<string, PinAssignment>;
  labels: Record<string, string>;
  locked: string[];
}

export type JsonImportResult =
  | { ok: true; state: WorkspaceState }
  | { ok: false; error: string };

function sortRecordKeys<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(record).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )) {
    sorted[key] = record[key];
  }
  return sorted;
}

export function exportPinoutJson(state: WorkspaceState): string {
  const cleanAssignments: Record<string, PinAssignment> = {};
  for (const key of Object.keys(state.assignments).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )) {
    const a = state.assignments[key];
    cleanAssignments[key] = { ...a };
  }

  const cleanLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.labels)) {
    if (v.trim().length > 0) cleanLabels[k] = v.trim();
  }

  const cleanModes: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.peripheralModes)) {
    if (v && v !== 'disabled') cleanModes[k] = v;
  }

  const locked = Object.entries(state.locked)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const doc: PinCraftProjectFile = {
    format: 'pincraft-pinout',
    version: 1,
    mcuId: state.mcuId,
    peripheralModes: sortRecordKeys(cleanModes),
    assignments: cleanAssignments,
    labels: sortRecordKeys(cleanLabels),
    locked,
  };

  return JSON.stringify(doc, null, 2) + '\n';
}

export function parsePinoutJson(raw: string): JsonImportResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Project file must contain a JSON object.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.mcuId !== 'string' || obj.mcuId.trim().length === 0) {
      return { ok: false, error: 'Missing required "mcuId" string field in JSON project file.' };
    }
    if (obj.version !== undefined && obj.version !== 1) {
      return { ok: false, error: `Unsupported project file version: ${String(obj.version)}.` };
    }

    const assignments: Record<string, PinAssignment> = {};
    if (obj.assignments && typeof obj.assignments === 'object' && !Array.isArray(obj.assignments)) {
      for (const [pos, val] of Object.entries(obj.assignments as Record<string, unknown>)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const rec = val as Record<string, unknown>;
          if (typeof rec.peripheral === 'string' && typeof rec.signal === 'string') {
            assignments[pos] = {
              peripheral: rec.peripheral,
              signal: rec.signal,
              af: typeof rec.af === 'number' ? rec.af : null,
              ...(typeof rec.funcLabel === 'string' ? { funcLabel: rec.funcLabel } : {}),
              ...(typeof rec.remapId === 'number' ? { remapId: rec.remapId } : {}),
              ...(typeof rec.resourceId === 'string' ? { resourceId: rec.resourceId } : {}),
            };
          }
        }
      }
    }

    const labels: Record<string, string> = {};
    if (obj.labels && typeof obj.labels === 'object' && !Array.isArray(obj.labels)) {
      for (const [pos, val] of Object.entries(obj.labels as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          labels[pos] = val.trim();
        }
      }
    }

    const locked: Record<string, boolean> = {};
    if (Array.isArray(obj.locked)) {
      for (const pos of obj.locked) {
        if (typeof pos === 'string') locked[pos] = true;
      }
    } else if (obj.locked && typeof obj.locked === 'object') {
      for (const [pos, val] of Object.entries(obj.locked as Record<string, unknown>)) {
        if (Boolean(val)) locked[pos] = true;
      }
    }

    const peripheralModes: Record<string, string> = {};
    if (
      obj.peripheralModes &&
      typeof obj.peripheralModes === 'object' &&
      !Array.isArray(obj.peripheralModes)
    ) {
      for (const [periph, val] of Object.entries(obj.peripheralModes as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          peripheralModes[periph] = val.trim();
        }
      }
    }

    return {
      ok: true,
      state: {
        mcuId: obj.mcuId.trim(),
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
          ? `Invalid JSON file: ${err.message}`
          : 'Invalid JSON file.',
    };
  }
}
