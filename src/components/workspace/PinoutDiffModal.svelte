<script lang="ts">
  import FileUp from '@solar-icons/svelte/bold-duotone/import';
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount, tick } from 'svelte';
  import { parsePinoutJson } from '../../core/exporters/json';
  import {
    diffProjects,
    type PinChange,
    type PinChangeKind,
    type ProjectDiff,
    type ProjectSnapshot,
  } from '../../core/project-diff';
  import { getChipMuxModel, type ChipData, type PinVisualStatus } from '../../core/types';
  import { catalogStore } from '../../state/catalog.svelte';
  import { openDialogWithFocus } from '../../state/dialog-focus';
  import GridPackage from './GridPackage.svelte';
  import PerimeterPackage from './PerimeterPackage.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  type SlotStatus = 'idle' | 'loading' | 'ready' | 'error';

  interface SlotState {
    status: SlotStatus;
    fileName: string;
    snapshot: ProjectSnapshot | null;
    chip: ChipData | null;
    error: string | null;
  }

  interface MarkerRect {
    pos: string;
    kind: PinChangeKind;
    left: number;
    top: number;
    width: number;
    height: number;
  }

  const MARKER_CLASSES: Record<PinChangeKind, string> = {
    added: 'border-success',
    removed: 'border-error',
    moved: 'border-info',
    relabeled: 'border-warning',
    reassigned: 'border-warning',
  };

  function emptySlot(): SlotState {
    return { status: 'idle', fileName: '', snapshot: null, chip: null, error: null };
  }

  let beforeSlot = $state<SlotState>(emptySlot());
  let afterSlot = $state<SlotState>(emptySlot());
  let diff = $state<ProjectDiff | null>(null);
  let beforePreviewEl = $state<HTMLDivElement | null>(null);
  let afterPreviewEl = $state<HTMLDivElement | null>(null);
  let beforeMarkers = $state<MarkerRect[]>([]);
  let afterMarkers = $state<MarkerRect[]>([]);
  let dialogEl = $state<HTMLDialogElement | null>(null);

  let beforeGeneration = 0;
  let afterGeneration = 0;
  let diffGeneration = 0;
  let diffController: AbortController | null = null;

  const beforeStatus = $derived.by<Record<string, PinVisualStatus>>(() =>
    beforeSlot.chip && beforeSlot.snapshot
      ? statusFor(beforeSlot.chip, beforeSlot.snapshot)
      : {},
  );
  const afterStatus = $derived.by<Record<string, PinVisualStatus>>(() =>
    afterSlot.chip && afterSlot.snapshot ? statusFor(afterSlot.chip, afterSlot.snapshot) : {},
  );

  function statusFor(chip: ChipData, snapshot: ProjectSnapshot): Record<string, PinVisualStatus> {
    const status: Record<string, PinVisualStatus> = {};
    const ioTypes = new Set(chip.pins.filter((pin) => pin.type === 'io').map((pin) => pin.pos));
    for (const pin of chip.pins) {
      status[pin.pos] = ioTypes.has(pin.pos)
        ? snapshot.state.assignments[pin.pos]
          ? 'assigned'
          : 'unused'
        : pin.type === 'power' || pin.type === 'reset' || pin.type === 'boot'
          ? 'power'
          : 'unused';
    }
    return status;
  }

  function pinNames(chip: ChipData): Record<string, string> {
    const names: Record<string, string> = {};
    for (const pin of chip.pins) names[pin.pos] = pin.name;
    return names;
  }

  async function recomputeDiff(token: number, signal: AbortSignal): Promise<void> {
    if (
      beforeSlot.status !== 'ready' ||
      afterSlot.status !== 'ready' ||
      !beforeSlot.snapshot ||
      !afterSlot.snapshot
    ) {
      diff = null;
      return;
    }
    const beforeSnapshot = beforeSlot.snapshot;
    const afterSnapshot = afterSlot.snapshot;
    let beforeChip: ChipData;
    let afterChip: ChipData;
    try {
      beforeChip = await catalogStore.loadChip(beforeSnapshot.mcuId, signal);
    } catch (err) {
      if (token === diffGeneration) {
        beforeSlot = {
          ...beforeSlot,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unable to load the first chip shard.',
        };
        diff = null;
      }
      return;
    }
    try {
      afterChip = await catalogStore.loadChip(afterSnapshot.mcuId, signal);
    } catch (err) {
      if (token === diffGeneration) {
        afterSlot = {
          ...afterSlot,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unable to load the second chip shard.',
        };
        diff = null;
      }
      return;
    }
    if (token !== diffGeneration) return;
    beforeSlot = { ...beforeSlot, chip: beforeChip };
    afterSlot = { ...afterSlot, chip: afterChip };
    diff = diffProjects(
      { ...beforeSnapshot, pinNames: pinNames(beforeChip) },
      { ...afterSnapshot, pinNames: pinNames(afterChip) },
    );
  }

  async function readFile(slot: 'before' | 'after', file: File): Promise<void> {
    const token = ++diffGeneration;
    diffController?.abort();
    const controller = new AbortController();
    diffController = controller;
    const slotToken = slot === 'before' ? ++beforeGeneration : ++afterGeneration;
    const isBefore = slot === 'before';
    const loading: SlotState = {
      status: 'loading',
      fileName: file.name,
      snapshot: null,
      chip: null,
      error: null,
    };
    if (isBefore) beforeSlot = loading;
    else afterSlot = loading;
    diff = null;

    if (file.name.toLowerCase().endsWith('.ioc')) {
      const unsupported: SlotState = {
        ...loading,
        status: 'error',
        error: 'Unsupported file format: .ioc import is not available for the diff view.',
      };
      if (slotToken === (isBefore ? beforeGeneration : afterGeneration)) {
        if (isBefore) beforeSlot = unsupported;
        else afterSlot = unsupported;
      }
      return;
    }

    try {
      const parsed = parsePinoutJson(await file.text());
      if (!parsed.ok) {
        const failed: SlotState = { ...loading, status: 'error', error: parsed.error };
        if (slotToken === (isBefore ? beforeGeneration : afterGeneration)) {
          if (isBefore) beforeSlot = failed;
          else afterSlot = failed;
        }
        return;
      }
      const ready: SlotState = {
        ...loading,
        status: 'ready',
        snapshot: { mcuId: parsed.state.mcuId, state: parsed.state },
      };
      if (slotToken !== (isBefore ? beforeGeneration : afterGeneration)) return;
      if (isBefore) beforeSlot = ready;
      else afterSlot = ready;
      await recomputeDiff(token, controller.signal);
    } catch (err) {
      const failed: SlotState = {
        ...loading,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unable to read the selected file.',
      };
      if (slotToken === (isBefore ? beforeGeneration : afterGeneration)) {
        if (isBefore) beforeSlot = failed;
        else afterSlot = failed;
      }
    }
  }

  function collectMarkers(
    element: HTMLDivElement | null,
    markers: Record<string, PinChangeKind>,
  ): MarkerRect[] {
    if (!element) return [];
    const base = element.getBoundingClientRect();
    const found: MarkerRect[] = [];
    for (const node of Array.from(element.querySelectorAll('[data-pin-pos]'))) {
      const pos = node.getAttribute('data-pin-pos');
      const kind = pos ? markers[pos] : undefined;
      if (!pos || !kind) continue;
      const rect = node.getBoundingClientRect();
      found.push({
        pos,
        kind,
        left: rect.left - base.left,
        top: rect.top - base.top,
        width: rect.width,
        height: rect.height,
      });
    }
    return found;
  }

  $effect(() => {
    const current = diff;
    const beforeChip = beforeSlot.chip;
    const afterChip = afterSlot.chip;
    void tick().then(() => {
      if (current !== diff || !current) return;
      beforeMarkers = current ? collectMarkers(beforePreviewEl, current.markers.before) : [];
      afterMarkers = current ? collectMarkers(afterPreviewEl, current.markers.after) : [];
      void beforeChip;
      void afterChip;
    });
  });

  /** Native dialog close path; the close event notifies the parent once. */
  function close(): void {
    dialogEl?.close();
  }

  function handleClose(): void {
    diffGeneration += 1;
    diffController?.abort();
    beforeGeneration += 1;
    afterGeneration += 1;
    onClose();
  }

  function changeValues(change: PinChange): string {
    const format = (assignment?: PinChange['from']): string =>
      assignment ? `${assignment.peripheral}_${assignment.signal}` : '-';
    return `${format(change.from)} -> ${format(change.to)}`;
  }

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogEl?.open) dialogEl?.showModal();
    openDialogWithFocus(dialogEl, undefined, opener);
    return () => {
      diffGeneration += 1;
      diffController?.abort();
      beforeGeneration += 1;
      afterGeneration += 1;
    };
  });
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclose={handleClose}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
  onclick={(e) => {
    if (e.target === dialogEl) close();
  }}
  aria-label="Compare two pinouts"
>
  <div
    class="modal-box w-full max-w-5xl max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-base-300 shrink-0">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-foreground">Compare Project Pinouts</h2>
        <p class="text-[11px] text-base-content/60">
          Select two version-2 project files. Previews are read-only and the active workspace is unchanged.
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        class="btn btn-ghost btn-sm btn-square shrink-0"
        aria-label="Close pinout comparison"
        title="Close comparison"
      >
        <X class="size-4" />
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 py-3 border-b border-base-300 bg-base-200 shrink-0">
      <div class="min-w-0 space-y-1.5">
        <label class="flex items-center gap-2 text-xs font-medium text-foreground">
          <FileUp class="size-3.5 text-base-content/40" />
          Before
          <input
            type="file"
            accept=".json,application/json"
            class="file-input file-input-xs min-w-0 flex-1 text-[11px]"
            onchange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) void readFile('before', file);
              (e.currentTarget as HTMLInputElement).value = '';
            }}
          />
        </label>
        <p class="font-mono text-[11px] text-base-content/60 truncate" title={beforeSlot.fileName}>
          {beforeSlot.status === 'idle' ? 'No file selected' : beforeSlot.fileName}
        </p>
        {#if beforeSlot.status === 'loading'}
          <p class="text-[11px] text-base-content/60">Loading project file...</p>
        {:else if beforeSlot.status === 'error'}
          <p role="alert" class="unsupported-format alert alert-error py-1 text-[11px]">{beforeSlot.error}</p>
        {:else if beforeSlot.status === 'ready'}
          <p class="text-[11px] text-success">
            {beforeSlot.snapshot?.mcuId}{beforeSlot.chip ? ` - ${beforeSlot.chip.package.name}` : ' - shard loading'}
          </p>
        {/if}
      </div>

      <div class="min-w-0 space-y-1.5">
        <label class="flex items-center gap-2 text-xs font-medium text-foreground">
          <FileUp class="size-3.5 text-base-content/40" />
          After
          <input
            type="file"
            accept=".json,application/json"
            class="file-input file-input-xs min-w-0 flex-1 text-[11px]"
            onchange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) void readFile('after', file);
              (e.currentTarget as HTMLInputElement).value = '';
            }}
          />
        </label>
        <p class="font-mono text-[11px] text-base-content/60 truncate" title={afterSlot.fileName}>
          {afterSlot.status === 'idle' ? 'No file selected' : afterSlot.fileName}
        </p>
        {#if afterSlot.status === 'loading'}
          <p class="text-[11px] text-base-content/60">Loading project file...</p>
        {:else if afterSlot.status === 'error'}
          <p role="alert" class="unsupported-format alert alert-error py-1 text-[11px]">{afterSlot.error}</p>
        {:else if afterSlot.status === 'ready'}
          <p class="text-[11px] text-success">
            {afterSlot.snapshot?.mcuId}{afterSlot.chip ? ` - ${afterSlot.chip.package.name}` : ' - shard loading'}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {#if !diff}
        <p class="text-xs text-base-content/60">
          Select two valid project files to compute the pinout difference.
        </p>
      {:else}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="min-w-0 rounded-box border border-base-300 bg-base-200 p-2">
            <p class="font-mono text-[11px] text-foreground mb-2">
              Before: {beforeSlot.snapshot?.mcuId}
            </p>
            {#if beforeSlot.chip && beforeSlot.snapshot}
              <div class="relative overflow-auto max-h-[40dvh] bg-base-100 bg-dot-grid">
                <div bind:this={beforePreviewEl}>
                  {#if beforeSlot.chip.package.kind === 'grid'}
                    <GridPackage
                      chip={beforeSlot.chip}
                      assignments={beforeSlot.snapshot.state.assignments}
                      labels={beforeSlot.snapshot.state.labels}
                      locked={beforeSlot.snapshot.state.locked}
                      pinStatus={beforeStatus}
                      muxModel={getChipMuxModel(beforeSlot.chip)}
                      zoom={0.8}
                    />
                  {:else}
                    <PerimeterPackage
                      chip={beforeSlot.chip}
                      assignments={beforeSlot.snapshot.state.assignments}
                      labels={beforeSlot.snapshot.state.labels}
                      locked={beforeSlot.snapshot.state.locked}
                      pinStatus={beforeStatus}
                      muxModel={getChipMuxModel(beforeSlot.chip)}
                      zoom={0.8}
                      compact={true}
                    />
                  {/if}
                </div>
                <div class="pointer-events-none absolute inset-0">
                  {#each beforeMarkers as marker (marker.pos)}
                    <div
                      class={`diff-marker absolute rounded-field border-2 ${MARKER_CLASSES[marker.kind]}`}
                      style={`left: ${marker.left}px; top: ${marker.top}px; width: ${marker.width}px; height: ${marker.height}px;`}
                    ></div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <div class="min-w-0 rounded-box border border-base-300 bg-base-200 p-2">
            <p class="font-mono text-[11px] text-foreground mb-2">
              After: {afterSlot.snapshot?.mcuId}
            </p>
            {#if afterSlot.chip && afterSlot.snapshot}
              <div class="relative overflow-auto max-h-[40dvh] bg-base-100 bg-dot-grid">
                <div bind:this={afterPreviewEl}>
                  {#if afterSlot.chip.package.kind === 'grid'}
                    <GridPackage
                      chip={afterSlot.chip}
                      assignments={afterSlot.snapshot.state.assignments}
                      labels={afterSlot.snapshot.state.labels}
                      locked={afterSlot.snapshot.state.locked}
                      pinStatus={afterStatus}
                      muxModel={getChipMuxModel(afterSlot.chip)}
                      zoom={0.8}
                    />
                  {:else}
                    <PerimeterPackage
                      chip={afterSlot.chip}
                      assignments={afterSlot.snapshot.state.assignments}
                      labels={afterSlot.snapshot.state.labels}
                      locked={afterSlot.snapshot.state.locked}
                      pinStatus={afterStatus}
                      muxModel={getChipMuxModel(afterSlot.chip)}
                      zoom={0.8}
                      compact={true}
                    />
                  {/if}
                </div>
                <div class="pointer-events-none absolute inset-0">
                  {#each afterMarkers as marker (marker.pos)}
                    <div
                      class={`diff-marker absolute rounded-field border-2 ${MARKER_CLASSES[marker.kind]}`}
                      style={`left: ${marker.left}px; top: ${marker.top}px; width: ${marker.width}px; height: ${marker.height}px;`}
                    ></div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap gap-3 text-[11px] text-base-content/60">
          <span><span class="diff-legend inline-block w-3 h-3 border-success border-2 rounded-field"></span> added</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-error border-2 rounded-field"></span> removed</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-info border-2 border rounded-field"></span> moved</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-warning border-2 rounded-field"></span> relabeled</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-warning border-2 rounded-field"></span> reassigned</span>
        </div>

        <table class="table table-sm w-full text-left text-xs">
          <thead class="text-[11px] text-base-content/60 uppercase tracking-wide">
            <tr>
              <th class="px-2 py-1.5 font-medium">Change</th>
              <th class="px-2 py-1.5 font-medium">Position</th>
              <th class="px-2 py-1.5 font-medium">Pin</th>
              <th class="px-2 py-1.5 font-medium">Assignment</th>
              <th class="px-2 py-1.5 font-medium">Label</th>
            </tr>
          </thead>
          <tbody>
            {#each diff.changes as change (`${change.kind}:${change.pinName}:${change.fromPos ?? ''}:${change.toPos ?? ''}`)}
              <tr class="border-t border-base-300">
                <td class="px-2 py-1.5 font-medium text-foreground">{change.kind}</td>
                <td class="px-2 py-1.5 font-mono-tabular text-base-content/60">
                  {change.fromPos ?? '-'} -> {change.toPos ?? '-'}
                </td>
                <td class="px-2 py-1.5 font-mono text-foreground">{change.pinName}</td>
                <td class="px-2 py-1.5 font-mono text-base-content/60">{changeValues(change)}</td>
                <td class="px-2 py-1.5 font-mono text-base-content/60">
                  {change.fromLabel ?? '-'} -> {change.toLabel ?? '-'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if diff.changes.length === 0}
          <p class="text-xs text-base-content/60">The two projects have no pin-level differences.</p>
        {/if}
      {/if}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close pinout comparison">close</button>
  </form>
</dialog>
