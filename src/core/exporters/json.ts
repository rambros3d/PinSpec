import {
  PINCRAFT_STATE_VERSION,
  normalizePackageRotation,
  parseGpioConfig,
  type GpioConfig,
  type PinAssignment,
  type PinPlacementPreference,
  type PioPinAssignment,
  type VendorId,
  type WorkspaceState,
} from '../types';
import {
  canonicalPinPlacementPreference,
  normalizeAngle,
  parsePinPlacementPreference,
} from '../placement';

/** The single PinCraft project-file schema (no legacy version shim). */
export interface PinCraftProjectFile {
  format: 'pincraft-pinout';
  version: 2;
  mcuId: string;
  vendor?: VendorId;
  peripheralModes: Record<string, string>;
  assignments: Record<string, PinAssignment>;
  labels: Record<string, string>;
  locked: string[];
  activeRemaps?: Record<string, number>;
  pioAssignments?: Record<string, PioPinAssignment>;
  gpioConfig?: Record<string, GpioConfig>;
  placement?: Record<string, PinPlacementPreference>;
  placementOverlayVisible?: boolean;
  /** Package rotation, emitted only for the non-default -90 value. */
  packageRotation?: 0 | -90;
  /** Display-only placement overlay rotation, omitted at zero. */
  placementOverlayRotation?: number;
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

/** Emit assignment fields in a fixed order so serialized files diff stably. */
function canonicalAssignment(a: PinAssignment): PinAssignment {
  return {
    peripheral: a.peripheral,
    signal: a.signal,
    af: a.af,
    ...(a.funcLabel !== undefined ? { funcLabel: a.funcLabel } : {}),
    ...(a.remapId !== undefined ? { remapId: a.remapId } : {}),
    ...(a.resourceId !== undefined ? { resourceId: a.resourceId } : {}),
  };
}

/** Emit PIO bindings in a fixed field order. */
function canonicalPio(pio: PioPinAssignment): PioPinAssignment {
  return {
    instance: pio.instance,
    ...(pio.sm !== undefined ? { sm: pio.sm } : {}),
    ...(pio.role !== undefined ? { role: pio.role } : {}),
  };
}

/** Emit GPIO electrical settings in a fixed field order. */
function canonicalGpio(config: GpioConfig): GpioConfig {
  return {
    outputLevel: config.outputLevel,
    drive: config.drive,
    pull: config.pull,
    speed: config.speed,
  };
}

/**
 * Serialize a workspace to the current project-file schema.
 * `vendor` is recorded as provenance metadata; the MCU ID remains authoritative
 * on import. Remaps, PIO bindings, GPIO settings and placement preferences
 * are omitted when empty.
 */
export function exportPinoutJson(state: WorkspaceState, vendor?: VendorId): string {
  const cleanAssignments: Record<string, PinAssignment> = {};
  for (const key of Object.keys(state.assignments).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )) {
    cleanAssignments[key] = canonicalAssignment(state.assignments[key]);
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
    version: PINCRAFT_STATE_VERSION,
    mcuId: state.mcuId,
    ...(vendor ? { vendor } : {}),
    peripheralModes: sortRecordKeys(cleanModes),
    assignments: cleanAssignments,
    labels: sortRecordKeys(cleanLabels),
    locked,
  };

  if (state.activeRemaps && Object.keys(state.activeRemaps).length > 0) {
    doc.activeRemaps = sortRecordKeys({ ...state.activeRemaps });
  }
  if (state.pioAssignments && Object.keys(state.pioAssignments).length > 0) {
    const cleanPio: Record<string, PioPinAssignment> = {};
    for (const [pos, pio] of Object.entries(state.pioAssignments)) {
      cleanPio[pos] = canonicalPio(pio);
    }
    doc.pioAssignments = sortRecordKeys(cleanPio);
  }
  if (state.gpioConfig && Object.keys(state.gpioConfig).length > 0) {
    const cleanGpio: Record<string, GpioConfig> = {};
    for (const [pos, config] of Object.entries(state.gpioConfig)) {
      cleanGpio[pos] = canonicalGpio(config);
    }
    doc.gpioConfig = sortRecordKeys(cleanGpio);
  }
  if (state.placementOverlayVisible) doc.placementOverlayVisible = true;
  if (state.placement && Object.keys(state.placement).length > 0) {
    const cleanPlacement: Record<string, PinPlacementPreference> = {};
    for (const [peripheral, pref] of Object.entries(state.placement)) {
      cleanPlacement[peripheral] = canonicalPinPlacementPreference(pref);
    }
    doc.placement = sortRecordKeys(cleanPlacement);
  }
  const rotation = normalizePackageRotation(state.packageRotation);
  if (rotation !== 0) doc.packageRotation = rotation;
  const overlayRotation = normalizeAngle(state.placementOverlayRotation ?? 0);
  if (overlayRotation !== 0) doc.placementOverlayRotation = overlayRotation;

  return JSON.stringify(doc, null, 2) + '\n';
}

/**
 * Parse a project file. Any version other than the current schema is rejected
 * with a typed error so the UI can show it in its dismissible banner.
 */
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
    if (obj.version !== PINCRAFT_STATE_VERSION) {
      return {
        ok: false,
        error: `Unsupported project file version: ${String(obj.version)}.`,
      };
    }

    const assignments: Record<string, PinAssignment> = {};
    if (obj.assignments && typeof obj.assignments === 'object' && !Array.isArray(obj.assignments)) {
      for (const [pos, val] of Object.entries(obj.assignments as Record<string, unknown>)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const rec = val as Record<string, unknown>;
          if (typeof rec.peripheral === 'string' && typeof rec.signal === 'string') {
            assignments[pos] = canonicalAssignment({
              peripheral: rec.peripheral,
              signal: rec.signal,
              af: typeof rec.af === 'number' ? rec.af : null,
              ...(typeof rec.funcLabel === 'string' ? { funcLabel: rec.funcLabel } : {}),
              ...(typeof rec.remapId === 'number' ? { remapId: rec.remapId } : {}),
              ...(typeof rec.resourceId === 'string' ? { resourceId: rec.resourceId } : {}),
            });
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

    const state: WorkspaceState = {
      mcuId: obj.mcuId.trim(),
      assignments: sortRecordKeys(assignments),
      labels: sortRecordKeys(labels),
      locked,
      peripheralModes: sortRecordKeys(peripheralModes),
    };

    if (obj.activeRemaps && typeof obj.activeRemaps === 'object' && !Array.isArray(obj.activeRemaps)) {
      const remaps: Record<string, number> = {};
      for (const [peripheral, id] of Object.entries(obj.activeRemaps as Record<string, unknown>)) {
        if (typeof id === 'number') remaps[peripheral] = id;
      }
      if (Object.keys(remaps).length > 0) state.activeRemaps = sortRecordKeys(remaps);
    }

    if (
      obj.pioAssignments &&
      typeof obj.pioAssignments === 'object' &&
      !Array.isArray(obj.pioAssignments)
    ) {
      const pioAssignments: Record<string, PioPinAssignment> = {};
      for (const [pos, val] of Object.entries(obj.pioAssignments as Record<string, unknown>)) {
        if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
        const rec = val as Record<string, unknown>;
        if (typeof rec.instance !== 'string') continue;
        pioAssignments[pos] = canonicalPio({
          instance: rec.instance,
          ...(typeof rec.sm === 'number' ? { sm: rec.sm } : {}),
          ...(typeof rec.role === 'string' ? { role: rec.role } : {}),
        });
      }
      if (Object.keys(pioAssignments).length > 0) {
        state.pioAssignments = sortRecordKeys(pioAssignments);
      }
    }

    if (obj.gpioConfig && typeof obj.gpioConfig === 'object' && !Array.isArray(obj.gpioConfig)) {
      const gpioConfig: Record<string, GpioConfig> = {};
      for (const [pos, val] of Object.entries(obj.gpioConfig as Record<string, unknown>)) {
        const config = parseGpioConfig(val);
        if (config) gpioConfig[pos] = canonicalGpio(config);
      }
      if (Object.keys(gpioConfig).length > 0) {
        state.gpioConfig = sortRecordKeys(gpioConfig);
      }
    }

    if (obj.placementOverlayVisible === true) state.placementOverlayVisible = true;
    // Legacy `dockTab` values are ignored so older project files keep their
    // pin configuration without importing a local view preference.
    const rotation = normalizePackageRotation(obj.packageRotation);
    if (rotation !== 0) state.packageRotation = rotation;
    if (typeof obj.placementOverlayRotation === 'number') {
      const overlayRotation = normalizeAngle(obj.placementOverlayRotation);
      if (overlayRotation !== 0) state.placementOverlayRotation = overlayRotation;
    }
    if (obj.placement && typeof obj.placement === 'object' && !Array.isArray(obj.placement)) {
      const placement: Record<string, PinPlacementPreference> = {};
      for (const [peripheral, val] of Object.entries(obj.placement as Record<string, unknown>)) {
        const parsed = parsePinPlacementPreference(val);
        if (parsed) placement[peripheral] = canonicalPinPlacementPreference(parsed);
      }
      if (Object.keys(placement).length > 0) {
        state.placement = sortRecordKeys(placement);
      }
    }

    return { ok: true, state };
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
