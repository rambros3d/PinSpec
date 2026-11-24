<script lang="ts">
  import { FileUp, X } from 'lucide-svelte';
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
    added: 'border-pin-success',
    removed: 'border-pin-conflict',
    moved: 'border-pin-remap',
    relabeled: 'border-pin-power',
    reassigned: 'border-pin-partial',
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

  let beforeGeneration = 0;
  let afterGeneration = 0;
  let diffGeneration = 0;

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

  async function recomputeDiff(token: number): Promise<void> {
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
      beforeChip = await catalogStore.loadChip(beforeSnapshot.mcuId);
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
      afterChip = await catalogStore.loadChip(afterSnapshot.mcuId);
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
      await recomputeDiff(token);
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

  function close(): void {
    diffGeneration += 1;
    beforeGeneration += 1;
    afterGeneration += 1;
    onClose();
  }

  function changeValues(change: PinChange): string {
    const format = (assignment?: PinChange['from']): string =>
      assignment ? `${assignment.peripheral}_${assignment.signal}` : '-';
    return `${format(change.from)} -> ${format(change.to)}`;
  }

  onMount(() => () => {
    diffGeneration += 1;
    beforeGeneration += 1;
    afterGeneration += 1;
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" onclick={close}>
  <div
    class="w-full max-w-5xl max-h-[92dvh] min-h-0 flex flex-col rounded-panel border-ui border-hairline bg-surface shadow-2xl overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Compare two pinouts"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-ui-b border-hairline shrink-0">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-primary">Compare Project Pinouts</h2>
        <p class="text-[11px] text-muted">
          Select two version-2 project files. Previews are read-only and the active workspace is unchanged.
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        class="p-1 rounded-control hover:bg-elevated text-muted shrink-0"
        title="Close comparison"
      >
        <X class="size-ui" />
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 py-3 border-ui-b border-hairline bg-subtle shrink-0">
      <div class="min-w-0 space-y-1.5">
        <label class="flex items-center gap-2 text-xs font-medium text-primary">
          <FileUp class="size-ui-md text-faint" />
          Before
          <input
            type="file"
            accept=".json,.ioc,application/json"
            class="min-w-0 flex-1 text-[11px] text-muted"
            onchange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) void readFile('before', file);
              (e.currentTarget as HTMLInputElement).value = '';
            }}
          />
        </label>
        <p class="font-mono text-[11px] text-muted truncate" title={beforeSlot.fileName}>
          {beforeSlot.status === 'idle' ? 'No file selected' : beforeSlot.fileName}
        </p>
        {#if beforeSlot.status === 'loading'}
          <p class="text-[11px] text-muted">Loading project file...</p>
        {:else if beforeSlot.status === 'error'}
          <p class="unsupported-format text-[11px] text-pin-conflict">{beforeSlot.error}</p>
        {:else if beforeSlot.status === 'ready'}
          <p class="text-[11px] text-pin-success">
            {beforeSlot.snapshot?.mcuId}{beforeSlot.chip ? ` - ${beforeSlot.chip.package.name}` : ' - shard loading'}
          </p>
        {/if}
      </div>

      <div class="min-w-0 space-y-1.5">
        <label class="flex items-center gap-2 text-xs font-medium text-primary">
          <FileUp class="size-ui-md text-faint" />
          After
          <input
            type="file"
            accept=".json,.ioc,application/json"
            class="min-w-0 flex-1 text-[11px] text-muted"
            onchange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) void readFile('after', file);
              (e.currentTarget as HTMLInputElement).value = '';
            }}
          />
        </label>
        <p class="font-mono text-[11px] text-muted truncate" title={afterSlot.fileName}>
          {afterSlot.status === 'idle' ? 'No file selected' : afterSlot.fileName}
        </p>
        {#if afterSlot.status === 'loading'}
          <p class="text-[11px] text-muted">Loading project file...</p>
        {:else if afterSlot.status === 'error'}
          <p class="unsupported-format text-[11px] text-pin-conflict">{afterSlot.error}</p>
        {:else if afterSlot.status === 'ready'}
          <p class="text-[11px] text-pin-success">
            {afterSlot.snapshot?.mcuId}{afterSlot.chip ? ` - ${afterSlot.chip.package.name}` : ' - shard loading'}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {#if !diff}
        <p class="text-xs text-muted">
          Select two valid project files to compute the pinout difference.
        </p>
      {:else}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="min-w-0 rounded-panel border-ui border-hairline bg-subtle p-2">
            <p class="font-mono text-[11px] text-primary mb-2">
              Before: {beforeSlot.snapshot?.mcuId}
            </p>
            {#if beforeSlot.chip && beforeSlot.snapshot}
              <div class="relative overflow-auto max-h-[40dvh] bg-mcu-canvas bg-dot-grid">
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
                      class={`diff-marker absolute rounded-control border-ui-strong ${MARKER_CLASSES[marker.kind]}`}
                      style={`left: ${marker.left}px; top: ${marker.top}px; width: ${marker.width}px; height: ${marker.height}px;`}
                    ></div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <div class="min-w-0 rounded-panel border-ui border-hairline bg-subtle p-2">
            <p class="font-mono text-[11px] text-primary mb-2">
              After: {afterSlot.snapshot?.mcuId}
            </p>
            {#if afterSlot.chip && afterSlot.snapshot}
              <div class="relative overflow-auto max-h-[40dvh] bg-mcu-canvas bg-dot-grid">
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
                      class={`diff-marker absolute rounded-control border-ui-strong ${MARKER_CLASSES[marker.kind]}`}
                      style={`left: ${marker.left}px; top: ${marker.top}px; width: ${marker.width}px; height: ${marker.height}px;`}
                    ></div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap gap-3 text-[11px] text-muted">
          <span><span class="diff-legend inline-block w-3 h-3 border-pin-success border-ui-strong rounded-control"></span> added</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-pin-conflict border-ui-strong rounded-control"></span> removed</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-pin-remap border-ui-strong border-ui rounded-control"></span> moved</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-pin-power border-ui-strong rounded-control"></span> relabeled</span>
          <span><span class="diff-legend inline-block w-3 h-3 border-pin-partial border-ui-strong rounded-control"></span> reassigned</span>
        </div>

        <table class="w-full text-left border-collapse text-xs">
          <thead class="text-[11px] text-muted uppercase tracking-wide">
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
              <tr class="border-ui-t border-hairline">
                <td class="px-2 py-1.5 font-medium text-primary">{change.kind}</td>
                <td class="px-2 py-1.5 font-mono-tabular text-muted">
                  {change.fromPos ?? '-'} -> {change.toPos ?? '-'}
                </td>
                <td class="px-2 py-1.5 font-mono text-primary">{change.pinName}</td>
                <td class="px-2 py-1.5 font-mono text-muted">{changeValues(change)}</td>
                <td class="px-2 py-1.5 font-mono text-muted">
                  {change.fromLabel ?? '-'} -> {change.toLabel ?? '-'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if diff.changes.length === 0}
          <p class="text-xs text-muted">The two projects have no pin-level differences.</p>
        {/if}
      {/if}
    </div>
  </div>
</div>
