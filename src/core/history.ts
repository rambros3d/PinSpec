import { normalizeAngle, normalizePlacement } from './placement';
import { normalizePackageRotation, type WorkspaceState } from './types';

export function cloneWorkspaceState(state: WorkspaceState): WorkspaceState {
  const assignments: WorkspaceState['assignments'] = {};
  for (const [pos, a] of Object.entries(state.assignments)) {
    assignments[pos] = { ...a };
  }
  const cloned: WorkspaceState = {
    mcuId: state.mcuId,
    assignments,
    labels: { ...state.labels },
    locked: { ...state.locked },
    peripheralModes: { ...state.peripheralModes },
  };
  if (state.activeRemaps && Object.keys(state.activeRemaps).length > 0) {
    cloned.activeRemaps = { ...state.activeRemaps };
  }
  if (state.pioAssignments && Object.keys(state.pioAssignments).length > 0) {
    cloned.pioAssignments = {};
    for (const [pos, pio] of Object.entries(state.pioAssignments)) {
      cloned.pioAssignments[pos] = { ...pio };
    }
  }
  if (state.gpioConfig && Object.keys(state.gpioConfig).length > 0) {
    cloned.gpioConfig = {};
    for (const [pos, config] of Object.entries(state.gpioConfig)) {
      cloned.gpioConfig[pos] = { ...config };
    }
  }
  if (state.placement && Object.keys(state.placement).length > 0) {
    cloned.placement = {};
    for (const [peripheral, preference] of Object.entries(state.placement)) {
      cloned.placement[peripheral] = { ...preference };
    }
  }
  const rotation = normalizePackageRotation(state.packageRotation);
  if (rotation !== 0) cloned.packageRotation = rotation;
  if (state.placementOverlayRotation !== undefined) {
    cloned.placementOverlayRotation = normalizeAngle(state.placementOverlayRotation);
  }
  return cloned;
}

export function statesEqual(a: WorkspaceState, b: WorkspaceState): boolean {
  if (a.mcuId !== b.mcuId) return false;
  if (normalizePackageRotation(a.packageRotation) !== normalizePackageRotation(b.packageRotation)) {
    return false;
  }
  if (
    normalizeAngle(a.placementOverlayRotation ?? 0) !==
    normalizeAngle(b.placementOverlayRotation ?? 0)
  ) {
    return false;
  }

  const aKeys = Object.keys(a.assignments);
  const bKeys = Object.keys(b.assignments);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const av = a.assignments[k];
    const bv = b.assignments[k];
    if (
      !bv ||
      av.peripheral !== bv.peripheral ||
      av.signal !== bv.signal ||
      av.af !== bv.af ||
      av.remapId !== bv.remapId ||
      av.funcLabel !== bv.funcLabel ||
      av.resourceId !== bv.resourceId
    ) {
      return false;
    }
  }

  const alKeys = Object.keys(a.labels);
  const blKeys = Object.keys(b.labels);
  if (alKeys.length !== blKeys.length) return false;
  for (const k of alKeys) {
    if (a.labels[k] !== b.labels[k]) return false;
  }

  const akKeys = Object.keys(a.locked);
  const bkKeys = Object.keys(b.locked);
  if (akKeys.length !== bkKeys.length) return false;
  for (const k of akKeys) {
    if (Boolean(a.locked[k]) !== Boolean(b.locked[k])) return false;
  }

  const apKeys = Object.keys(a.peripheralModes);
  const bpKeys = Object.keys(b.peripheralModes);
  if (apKeys.length !== bpKeys.length) return false;
  for (const k of apKeys) {
    if (a.peripheralModes[k] !== b.peripheralModes[k]) return false;
  }

  const ar = a.activeRemaps ?? {};
  const br = b.activeRemaps ?? {};
  const arKeys = Object.keys(ar);
  const brKeys = Object.keys(br);
  if (arKeys.length !== brKeys.length) return false;
  for (const k of arKeys) {
    if (ar[k] !== br[k]) return false;
  }

  const apio = a.pioAssignments ?? {};
  const bpio = b.pioAssignments ?? {};
  const apioKeys = Object.keys(apio);
  const bpioKeys = Object.keys(bpio);
  if (apioKeys.length !== bpioKeys.length) return false;
  for (const k of apioKeys) {
    const av = apio[k];
    const bv = bpio[k];
    if (!bv || av.instance !== bv.instance || av.sm !== bv.sm || av.role !== bv.role) {
      return false;
    }
  }

  const ag = a.gpioConfig ?? {};
  const bg = b.gpioConfig ?? {};
  const agKeys = Object.keys(ag);
  const bgKeys = Object.keys(bg);
  if (agKeys.length !== bgKeys.length) return false;
  for (const k of agKeys) {
    const av = ag[k];
    const bv = bg[k];
    if (
      !bv ||
      av.outputLevel !== bv.outputLevel ||
      av.drive !== bv.drive ||
      av.pull !== bv.pull ||
      av.speed !== bv.speed
    ) {
      return false;
    }
  }

  const ap = normalizePlacement(a);
  const bp = normalizePlacement(b);
  const aplKeys = Object.keys(ap.preferences);
  const bplKeys = Object.keys(bp.preferences);
  if (aplKeys.length !== bplKeys.length) return false;
  for (const k of aplKeys) {
    const av = ap.preferences[k];
    const bv = bp.preferences[k];
    if (
      !bv ||
      av.angle !== bv.angle ||
      av.ring !== bv.ring ||
      av.enabled !== bv.enabled
    ) {
      return false;
    }
  }

  return true;
}

export class HistoryStack<T = WorkspaceState> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private readonly maxDepth: number;
  private readonly cloneFn: (value: T) => T;
  private readonly equalsFn: (a: T, b: T) => boolean;

  constructor(
    initial: T,
    options?: {
      maxDepth?: number;
      clone?: (value: T) => T;
      equals?: (a: T, b: T) => boolean;
    },
  ) {
    this.maxDepth = options?.maxDepth ?? 100;
    this.cloneFn = options?.clone ?? ((v) => structuredClone(v));
    this.equalsFn = options?.equals ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    this.present = this.cloneFn(initial);
  }

  get current(): T {
    return this.cloneFn(this.present);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoCount(): number {
    return this.past.length;
  }

  get redoCount(): number {
    return this.future.length;
  }

  push(next: T): boolean {
    if (this.equalsFn(this.present, next)) {
      return false;
    }
    this.past.push(this.cloneFn(this.present));
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.present = this.cloneFn(next);
    this.future = [];
    return true;
  }

  undo(): T | null {
    if (this.past.length === 0) return null;
    this.future.push(this.cloneFn(this.present));
    const prev = this.past.pop()!;
    this.present = this.cloneFn(prev);
    return this.cloneFn(this.present);
  }

  redo(): T | null {
    if (this.future.length === 0) return null;
    this.past.push(this.cloneFn(this.present));
    const next = this.future.pop()!;
    this.present = this.cloneFn(next);
    return this.cloneFn(this.present);
  }

  reset(initial: T): void {
    this.past = [];
    this.future = [];
    this.present = this.cloneFn(initial);
  }
}

export function createWorkspaceHistory(initial: WorkspaceState, maxDepth = 100): HistoryStack<WorkspaceState> {
  return new HistoryStack<WorkspaceState>(initial, {
    maxDepth,
    clone: cloneWorkspaceState,
    equals: statesEqual,
  });
}
