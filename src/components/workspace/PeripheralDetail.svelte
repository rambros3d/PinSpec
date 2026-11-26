<script lang="ts">
  /** Configuration surface for the peripheral selected in the compact tree. */
  import { getModesForPeripheral } from '../../core/solver';
  import { PERIPHERAL_STATUS_VIEW } from '../../core/pin-view';
  import {
    formatMuxLabel,
    getChipMuxModel,
    type ChipData,
    type PeripheralStatus,
    type PinAssignment,
    type PinTag,
  } from '../../core/types';
  import {
    peripheralCategoryForKind,
    summarizeRemapSignals,
  } from '../../core/vendor-view';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    peripheralName: string | null;
    assignments: Record<string, PinAssignment>;
    peripheralModes: Record<string, string>;
    peripheralStatus: Record<string, PeripheralStatus>;
    activeRemaps: Record<string, number>;
    onModeChange: (peripheralName: string, modeId: string) => void;
    onRemapChange: (peripheralName: string, remapId: number) => void;
    onToggleSignal: (peripheralName: string, signal: string) => void;
    onFocusPin: (pos: string) => void;
  }

  let {
    chip,
    peripheralName,
    assignments,
    peripheralModes,
    peripheralStatus,
    activeRemaps,
    onModeChange,
    onRemapChange,
    onToggleSignal,
    onFocusPin,
  }: Props = $props();

  const muxModel = $derived(getChipMuxModel(chip));

  const pInfo = $derived(peripheralName ? chip.peripherals[peripheralName] ?? null : null);
  const pStatus = $derived(
    peripheralName ? peripheralStatus[peripheralName] ?? 'none' : 'none',
  );
  const activeMode = $derived(
    peripheralName ? peripheralModes[peripheralName] ?? 'disabled' : 'disabled',
  );
  const modes = $derived(peripheralName ? getModesForPeripheral(chip, peripheralName) : []);
  const categoryLabel = $derived(pInfo ? peripheralCategoryForKind(pInfo.kind).label : '');

  // Map (peripheral:signal) -> assigned pin for the selected peripheral only.
  const assignedLookup = $derived.by(() => {
    const pinMap = new Map(chip.pins.map((pin) => [pin.pos, pin.name]));
    const map = new Map<string, { pos: string; pinName: string; muxLabel: string }>();
    for (const [pos, asgn] of Object.entries(assignments)) {
      if (!peripheralName || asgn.peripheral !== peripheralName) continue;
      map.set(asgn.signal, {
        pos,
        pinName: pinMap.get(pos) ?? pos,
        muxLabel: formatMuxLabel(asgn, muxModel),
      });
    }
    return map;
  });

  /** Tags of pins that host or are assigned to the selected peripheral. */
  const peripheralTags = $derived.by(() => {
    const tags: PinTag[] = [];
    if (!peripheralName) return tags;
    const add = (candidates: PinTag[] | undefined) => {
      for (const tag of candidates ?? []) if (!tags.includes(tag)) tags.push(tag);
    };
    for (const pin of chip.pins) {
      if (pin.signals.some((sig) => sig.peripheral === peripheralName)) add(pin.tags);
    }
    for (const [pos, asgn] of Object.entries(assignments)) {
      if (asgn.peripheral === peripheralName) add(chip.pins.find((pin) => pin.pos === pos)?.tags);
    }
    return tags;
  });

  function statusLabel(status: PeripheralStatus): string {
    return PERIPHERAL_STATUS_VIEW[status ?? 'none'].label;
  }

  function statusBadge(status: PeripheralStatus): string {
    return PERIPHERAL_STATUS_VIEW[status ?? 'none'].badge;
  }
</script>

<div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
  {#if !peripheralName || !pInfo}
    <div class="p-6 text-center text-xs text-base-content/60 space-y-1">
      <p class="font-medium text-foreground">No peripheral selected</p>
      <p>Select a peripheral in the tree to edit its mode, remap and signals.</p>
    </div>
  {:else}
    <div class="card card-border bg-base-200 p-2.5 text-xs space-y-1">
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono font-semibold text-foreground">{peripheralName}</span>
        <span class={`badge badge-sm ${statusBadge(pStatus)}`}>{statusLabel(pStatus)}</span>
      </div>
      <div class="text-[11px] text-base-content/60">{categoryLabel}</div>
      {#if peripheralTags.length > 0}
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] text-base-content/60">Pins:</span>
          <PinTagPills tags={peripheralTags} compact={true} />
        </div>
      {/if}
    </div>

    {#if modes.length > 1}
      <div class="space-y-1">
        <label for={`detail-mode-${peripheralName}`} class="block text-[11px] font-medium text-base-content/60">
          Mode
        </label>
        <select
          id={`detail-mode-${peripheralName}`}
          value={activeMode}
          onchange={(e) =>
            onModeChange(peripheralName, (e.currentTarget as HTMLSelectElement).value)}
          class="select select-xs w-full"
        >
          {#each modes as mode (mode.id)}
            <option value={mode.id}>{mode.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if pInfo.remaps && pInfo.remaps.length > 1}
      {@const selectedRemap =
        pInfo.remaps.find((remap) => remap.id === (activeRemaps[peripheralName] ?? 0)) ?? pInfo.remaps[0]}
      <div class="space-y-1">
        <label for={`detail-remap-${peripheralName}`} class="block text-[11px] font-medium text-base-content/60">
          Remap group
        </label>
        <select
          id={`detail-remap-${peripheralName}`}
          value={activeRemaps[peripheralName] ?? 0}
          onchange={(e) =>
            onRemapChange(peripheralName, Number((e.currentTarget as HTMLSelectElement).value))}
          class="select select-xs w-full"
        >
          {#each pInfo.remaps as option (option.id)}
            <option value={option.id}>{option.name}</option>
          {/each}
        </select>
        <div class="font-mono text-[11px] text-base-content/60 break-words">
          {summarizeRemapSignals(selectedRemap.signals)}
        </div>
        {#if selectedRemap.registerNote}
          <div class="font-mono text-[11px] text-base-content/60">
            {selectedRemap.registerNote}
          </div>
        {/if}
      </div>
    {/if}

    <div class="space-y-0.5">
      <div class="text-[11px] font-medium text-base-content/60">Signals</div>
      {#if pInfo.signals.length === 0}
        <p class="text-[11px] text-base-content/60">This peripheral has no named signals in the catalog.</p>
      {/if}
      {#each pInfo.signals as sig (sig)}
        {@const assigned = assignedLookup.get(sig)}
        <div class="flex items-center justify-between gap-2 py-0.5">
          <label class="flex items-center gap-2 min-w-0 cursor-pointer text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={Boolean(assigned)}
              onchange={() => onToggleSignal(peripheralName, sig)}
              class="checkbox checkbox-xs"
            />
            <span class="font-mono truncate">{sig}</span>
          </label>
          {#if assigned}
            <button
              type="button"
              onclick={() => onFocusPin(assigned.pos)}
              title="Locate pin on package"
              class="btn btn-link btn-xs font-mono-tabular shrink-0"
            >
              {assigned.pinName} / {assigned.muxLabel}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
