import { cloneWorkspaceState, createWorkspaceHistory, type HistoryStack } from '../core/history';
import {
  allocatePeripheralMode,
  applyOneHopFix,
  createEmptyWorkspace,
  evaluateWorkspace,
  findAlternatePins,
  pinSupportsSignal,
  remapPinAssignment,
  togglePeripheralSignal,
} from '../core/solver';
import type {
  AlternatePinCandidate,
  ChipData,
  OneHopFix,
  PinAssignment,
  SolverReport,
  WorkspaceState,
} from '../core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../core/url-state';
import { catalogStore } from './catalog.svelte';

export interface RecentSession {
  mcuId: string;
  packageName: string;
  pinCount: number;
  assignedCount: number;
  updatedAt: number;
  state: WorkspaceState;
}

const RECENT_STORAGE_KEY = 'pincraft:recent_sessions_v1';
const MAX_RECENT = 10;

function loadRecentFromStorage(): RecentSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentToStorage(sessions: RecentSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota errors
  }
}

class WorkspaceStore {
  chip = $state<ChipData | null>(null);
  state = $state<WorkspaceState>(createEmptyWorkspace(''));
  loading = $state(false);
  loadError = $state<string | null>(null);
  bannerError = $state<string | null>(null);
  toast = $state<{ id: number; text: string; tone: 'info' | 'success' | 'warning' } | null>(null);

  // Interactive workspace view controls
  rotation = $state<0 | 90 | 180 | 270>(0);
  globalSearch = $state('');
  remapSourcePos = $state<string | null>(null);
  highlightedPins = $state<string[]>([]);
  focusPinRequest = $state<{ pos: string; nonce: number } | null>(null);

  recentSessions = $state<RecentSession[]>(loadRecentFromStorage());

  // Reactive history indicators
  canUndo = $state(false);
  canRedo = $state(false);

  private history: HistoryStack<WorkspaceState> = createWorkspaceHistory(createEmptyWorkspace(''));
  private pendingHandoffState: WorkspaceState | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  report = $derived.by<SolverReport | null>(() => {
    if (!this.chip) return null;
    return evaluateWorkspace(this.chip, this.state);
  });

  remapCandidates = $derived.by<AlternatePinCandidate[]>(() => {
    if (!this.chip || !this.remapSourcePos) return [];
    return findAlternatePins(this.chip, this.state, this.remapSourcePos);
  });

  searchMatchingPins = $derived.by<string[]>(() => {
    if (!this.chip) return [];
    const q = this.globalSearch.trim().toUpperCase();
    if (!q) return [];
    const matched: string[] = [];
    for (const pin of this.chip.pins) {
      const asgn = this.state.assignments[pin.pos];
      const label = this.state.labels[pin.pos] ?? '';
      if (
        pin.name.toUpperCase().includes(q) ||
        pin.pos.toUpperCase() === q ||
        label.toUpperCase().includes(q) ||
        (asgn && `${asgn.peripheral}_${asgn.signal}`.toUpperCase().includes(q)) ||
        pin.signals.some((s) => `${s.peripheral}_${s.signal}`.toUpperCase().includes(q))
      ) {
        matched.push(pin.pos);
      }
    }
    return matched;
  });

  assignedCount = $derived(Object.keys(this.state.assignments).length);

  setPendingHandoff(state: WorkspaceState): void {
    this.pendingHandoffState = cloneWorkspaceState(state);
  }

  showToast(text: string, tone: 'info' | 'success' | 'warning' = 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { id: Date.now(), text, tone };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 3200);
  }

  dismissBanner(): void {
    this.bannerError = null;
  }

  private syncHistoryFlags(): void {
    this.canUndo = this.history.canUndo;
    this.canRedo = this.history.canRedo;
  }

  private persistCurrentSession(): void {
    if (!this.chip) return;
    const mcuId = this.chip.id;
    const entry: RecentSession = {
      mcuId,
      packageName: this.chip.package.name,
      pinCount: this.chip.package.pinCount,
      assignedCount: Object.keys(this.state.assignments).length,
      updatedAt: Date.now(),
      state: cloneWorkspaceState(this.state),
    };
    const filtered = this.recentSessions.filter((s) => s.mcuId !== mcuId);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    this.recentSessions = updated;
    saveRecentToStorage(updated);
  }

  deleteRecentSession(mcuId: string): void {
    const updated = this.recentSessions.filter((s) => s.mcuId !== mcuId);
    this.recentSessions = updated;
    saveRecentToStorage(updated);
  }

  private commit(next: WorkspaceState): void {
    if (this.history.push(next)) {
      this.state = this.history.current;
      this.syncHistoryFlags();
      this.persistCurrentSession();
    }
  }

  async openMcu(mcuId: string, overrideState?: WorkspaceState): Promise<void> {
    this.loading = true;
    this.loadError = null;
    this.remapSourcePos = null;
    this.highlightedPins = [];
    this.globalSearch = '';

    try {
      const chip = await catalogStore.loadChip(mcuId);
      this.chip = chip;

      let initialState: WorkspaceState;
      if (overrideState && overrideState.mcuId.toUpperCase() === chip.id.toUpperCase()) {
        initialState = cloneWorkspaceState({ ...overrideState, mcuId: chip.id });
      } else if (
        this.pendingHandoffState &&
        this.pendingHandoffState.mcuId.toUpperCase() === chip.id.toUpperCase()
      ) {
        initialState = cloneWorkspaceState({ ...this.pendingHandoffState, mcuId: chip.id });
        this.pendingHandoffState = null;
      } else {
        const existing = this.recentSessions.find(
          (s) => s.mcuId.toUpperCase() === chip.id.toUpperCase(),
        );
        initialState = existing
          ? cloneWorkspaceState(existing.state)
          : createEmptyWorkspace(chip.id);
      }

      this.history.reset(initialState);
      this.state = this.history.current;
      this.rotation = 0;
      this.syncHistoryFlags();
      this.persistCurrentSession();
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : `Failed to load ${mcuId}.`;
    } finally {
      this.loading = false;
    }
  }

  async openSharedPayload(payload: string): Promise<string | null> {
    const decoded = decodeWorkspaceState(payload);
    if (!decoded.ok) {
      this.bannerError = decoded.error;
      return null;
    }
    this.bannerError = null;
    await this.openMcu(decoded.state.mcuId, decoded.state);
    if (!this.loadError) {
      this.showToast(`Loaded shared pinout for ${decoded.state.mcuId}.`, 'success');
      return decoded.state.mcuId;
    }
    return null;
  }

  assignPin(pos: string, assignment: PinAssignment): void {
    if (!this.chip) return;
    if (this.state.locked[pos]) {
      this.showToast('Pin is locked. Unlock before reassigning.', 'warning');
      return;
    }
    const pin = this.chip.pins.find((p) => p.pos === pos);
    if (!pin || pin.type !== 'io') return;

    const match = pinSupportsSignal(pin, assignment.peripheral, assignment.signal);
    if (!match) return;

    const next = cloneWorkspaceState(this.state);
    next.assignments[pos] = {
      ...assignment,
      ...match,
      peripheral: assignment.peripheral,
      signal: match.signal,
      af: match.af,
    };
    this.remapSourcePos = null;
    this.commit(next);
  }

  clearPin(pos: string): void {
    if (this.state.locked[pos]) {
      this.showToast('Pin is locked. Unlock before clearing.', 'warning');
      return;
    }
    if (!this.state.assignments[pos] && !this.state.labels[pos]) return;
    const next = cloneWorkspaceState(this.state);
    delete next.assignments[pos];
    if (this.remapSourcePos === pos) this.remapSourcePos = null;
    this.commit(next);
  }

  setLabel(pos: string, label: string): void {
    const next = cloneWorkspaceState(this.state);
    const trimmed = label.trim();
    if (trimmed) {
      next.labels[pos] = trimmed;
    } else {
      delete next.labels[pos];
    }
    this.commit(next);
  }

  toggleLock(pos: string): void {
    const next = cloneWorkspaceState(this.state);
    if (next.locked[pos]) {
      delete next.locked[pos];
    } else {
      next.locked[pos] = true;
    }
    this.commit(next);
  }

  setPeripheralMode(peripheralName: string, modeId: string): void {
    if (!this.chip) return;
    const res = allocatePeripheralMode(this.chip, this.state, peripheralName, modeId);
    this.remapSourcePos = null;
    this.commit(res.state);
    if (res.unallocated.length > 0) {
      this.showToast(
        `${peripheralName}: ${res.unallocated.join(', ')} could not be placed automatically. Check Diagnostics.`,
        'warning',
      );
    }
  }

  toggleSignal(peripheralName: string, signal: string): void {
    if (!this.chip) return;
    const res = togglePeripheralSignal(this.chip, this.state, peripheralName, signal);
    if (res.assignedPos || res.state !== this.state) {
      this.commit(res.state);
    }
    if (!res.assignedPos && res.fix) {
      this.showToast(
        `No free pin for ${peripheralName}_${signal}. Use 1-hop remap in Diagnostics.`,
        'warning',
      );
    }
  }

  applyFix(fix: OneHopFix): void {
    const next = applyOneHopFix(this.state, fix);
    this.commit(next);
    this.showToast(`Applied remap: ${fix.displacedPeripheral}_${fix.displacedSignal} moved.`, 'success');
  }

  enterRemapMode(pos: string): void {
    if (!this.chip) return;
    const asgn = this.state.assignments[pos];
    if (!asgn || asgn.peripheral === 'GPIO') {
      this.showToast('Only peripheral alternate-function pins can be remapped.', 'info');
      return;
    }
    const alts = findAlternatePins(this.chip, this.state, pos);
    if (alts.length === 0) {
      this.showToast(`No alternate pins exist on this package for ${asgn.peripheral}_${asgn.signal}.`, 'warning');
      return;
    }
    this.remapSourcePos = pos;
    this.highlightedPins = alts.map((a) => a.pos);
    this.showToast(
      `Remap mode: click any highlighted pin to move ${asgn.peripheral}_${asgn.signal} (Esc to cancel).`,
      'info',
    );
  }

  cancelRemapMode(): void {
    this.remapSourcePos = null;
    this.highlightedPins = [];
  }

  completeRemap(targetPos: string): boolean {
    if (!this.chip || !this.remapSourcePos) return false;
    const candidate = this.remapCandidates.find((c) => c.pos === targetPos);
    if (!candidate) return false;
    if (candidate.status === 'locked') {
      this.showToast('Target pin is locked.', 'warning');
      return false;
    }
    const sourceAsgn = this.state.assignments[this.remapSourcePos];
    const next = remapPinAssignment(this.chip, this.state, this.remapSourcePos, targetPos);
    this.remapSourcePos = null;
    this.highlightedPins = [];
    this.commit(next);
    if (sourceAsgn) {
      this.showToast(
        `Remapped ${sourceAsgn.peripheral}_${sourceAsgn.signal} to ${candidate.pinName}.`,
        'success',
      );
    }
    return true;
  }

  highlightAlternates(pos: string): void {
    if (!this.chip) return;
    const alts = findAlternatePins(this.chip, this.state, pos);
    this.highlightedPins = alts.map((a) => a.pos);
    if (alts.length === 0) {
      this.showToast('No alternate pins support this signal on this package.', 'info');
    } else {
      this.showToast(`Highlighted ${alts.length} alternate pin${alts.length > 1 ? 's' : ''}.`, 'info');
    }
  }

  focusPin(pos: string): void {
    this.highlightedPins = [pos];
    this.focusPinRequest = { pos, nonce: Date.now() };
  }

  clearAll(): void {
    if (!this.chip) return;
    const next = createEmptyWorkspace(this.chip.id);
    // Preserve locked pins if any exist? Clear All resets full board cleanly
    this.remapSourcePos = null;
    this.highlightedPins = [];
    this.commit(next);
    this.showToast('Cleared all pin assignments.', 'info');
  }

  undo(): void {
    const prev = this.history.undo();
    if (prev) {
      this.state = prev;
      this.remapSourcePos = null;
      this.syncHistoryFlags();
      this.persistCurrentSession();
    }
  }

  redo(): void {
    const next = this.history.redo();
    if (next) {
      this.state = next;
      this.remapSourcePos = null;
      this.syncHistoryFlags();
      this.persistCurrentSession();
    }
  }

  rotateClockwise(): void {
    const order: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    const idx = order.indexOf(this.rotation);
    this.rotation = order[(idx + 1) % order.length];
  }

  buildShareUrl(): string {
    const encoded = encodeWorkspaceState(this.state);
    if (typeof window === 'undefined') return `#/s/${encoded}`;
    return `${window.location.origin}${window.location.pathname}#/s/${encoded}`;
  }
}

export const workspaceStore = new WorkspaceStore();
