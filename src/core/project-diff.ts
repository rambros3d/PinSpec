/**
 * Pure project-to-project pinout comparison.
 *
 * Snapshots hold a version-2 workspace plus its MCU identity. Pin names are
 * supplied from the corresponding chip shard when available, so cross-chip
 * diffs can match by display name when position keys differ. No Svelte or DOM
 * API is used here.
 */

import type { PinAssignment, WorkspaceState } from './types';

export type PinChangeKind = 'added' | 'removed' | 'moved' | 'relabeled' | 'reassigned';

export interface ProjectSnapshot {
  mcuId: string;
  state: WorkspaceState;
  /** Optional physical position -> display pin name map from the chip shard. */
  pinNames?: Record<string, string>;
}

export interface PinChange {
  kind: PinChangeKind;
  /** Primary position of the change: target for additions, source for removals. */
  pos: string;
  fromPos?: string;
  toPos?: string;
  pinName: string;
  from?: PinAssignment;
  to?: PinAssignment;
  fromLabel?: string;
  toLabel?: string;
}

export interface ProjectDiff {
  changes: PinChange[];
  /** Change kind by physical position on each side of the comparison. */
  markers: {
    before: Record<string, PinChangeKind>;
    after: Record<string, PinChangeKind>;
  };
}

interface PinEntry {
  pos: string;
  name: string;
  assignment?: PinAssignment;
  label: string;
}

const KIND_RANK: Record<PinChangeKind, number> = {
  added: 0,
  moved: 1,
  reassigned: 2,
  relabeled: 3,
  removed: 4,
};

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Entries include label-only pins so relabeling is visible without an assignment. */
function entriesOf(snapshot: ProjectSnapshot): PinEntry[] {
  const positions = new Set<string>([
    ...Object.keys(snapshot.state.assignments),
    ...Object.keys(snapshot.state.labels),
  ]);
  return Array.from(positions)
    .sort((a, b) => compareKeys(a, b))
    .map((pos) => ({
      pos,
      name: snapshot.pinNames?.[pos] ?? pos,
      assignment: snapshot.state.assignments[pos],
      label: snapshot.state.labels[pos] ?? '',
    }));
}

/**
 * Compare assignment fields that define a function. Cosmetic metadata outside
 * these fields is not part of the diff model.
 */
export function assignmentsEqual(a?: PinAssignment, b?: PinAssignment): boolean {
  if (!a || !b) return a === b;
  return (
    a.peripheral === b.peripheral &&
    a.signal === b.signal &&
    a.af === b.af &&
    a.funcLabel === b.funcLabel &&
    a.remapId === b.remapId &&
    a.resourceId === b.resourceId
  );
}

function changeFor(before: PinEntry | null, after: PinEntry | null): PinChange | null {
  if (!before && !after) return null;
  if (!before && after) {
    return {
      kind: 'added',
      pos: after.pos,
      pinName: after.name,
      to: after.assignment,
      toLabel: after.label || undefined,
    };
  }
  if (before && !after) {
    return {
      kind: 'removed',
      pos: before.pos,
      pinName: before.name,
      from: before.assignment,
      fromLabel: before.label || undefined,
    };
  }

  const from = before as PinEntry;
  const to = after as PinEntry;
  const common = {
    fromPos: from.pos,
    toPos: to.pos,
    pinName: to.name,
    from: from.assignment,
    to: to.assignment,
    fromLabel: from.label || undefined,
    toLabel: to.label || undefined,
  };
  if (from.pos !== to.pos) {
    return { kind: 'moved', pos: to.pos, ...common };
  }
  if (!assignmentsEqual(from.assignment, to.assignment)) {
    return { kind: 'reassigned', pos: from.pos, ...common };
  }
  if (from.label !== to.label) {
    return { kind: 'relabeled', pos: from.pos, ...common };
  }
  return null;
}

/**
 * Compare two snapshots. Physical position wins; when a position is absent on
 * the other side, a matching pin name is used and a position change is a move.
 * The inputs and their nested records are never modified.
 */
export function diffProjects(before: ProjectSnapshot, after: ProjectSnapshot): ProjectDiff {
  const beforeEntries = entriesOf(before);
  const afterEntries = entriesOf(after);
  const afterByPos = new Map(afterEntries.map((entry) => [entry.pos, entry]));
  const afterByName = new Map<string, PinEntry[]>();
  for (const entry of afterEntries) {
    const list = afterByName.get(entry.name) ?? [];
    list.push(entry);
    afterByName.set(entry.name, list);
  }
  const consumed = new Set<string>();
  const pairs: Array<[PinEntry | null, PinEntry | null]> = [];

  for (const from of beforeEntries) {
    const direct = afterByPos.get(from.pos);
    if (direct) {
      consumed.add(direct.pos);
      pairs.push([from, direct]);
      continue;
    }
    const byName = (afterByName.get(from.name) ?? [])
      .filter((entry) => !consumed.has(entry.pos))
      .sort((a, b) => compareKeys(a.pos, b.pos));
    const match = byName[0] ?? null;
    if (match) consumed.add(match.pos);
    pairs.push([from, match]);
  }
  for (const entry of afterEntries) {
    if (!consumed.has(entry.pos)) pairs.push([null, entry]);
  }

  const changes: PinChange[] = [];
  const markers: ProjectDiff['markers'] = { before: {}, after: {} };
  for (const [from, to] of pairs) {
    const change = changeFor(from, to);
    if (!change) continue;
    changes.push(change);
    if (from) markers.before[from.pos] = change.kind;
    if (to) markers.after[to.pos] = change.kind;
  }

  changes.sort((a, b) => {
    const aKey = a.pinName || a.pos;
    const bKey = b.pinName || b.pos;
    return (
      compareKeys(aKey, bKey) ||
      compareKeys(a.pos, b.pos) ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      compareKeys(a.fromPos ?? '', b.fromPos ?? '') ||
      compareKeys(a.toPos ?? '', b.toPos ?? '')
    );
  });

  return { changes, markers };
}
