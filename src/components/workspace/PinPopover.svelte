<script lang="ts">
  import Check from '@solar-icons/svelte/bold-duotone/check';
  import Lock from '@solar-icons/svelte/bold-duotone/lock';
  import Search from '@solar-icons/svelte/bold-duotone/magnifier';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import Unlock from '@solar-icons/svelte/bold-duotone/lock-unlocked';
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount } from 'svelte';
  import {
    formatMuxLabel,
    getChipMuxModel,
    GPIO_MODES,
    type ChipData,
    type PinAssignment,
    type PinInfo,
    type PinSignal,
  } from '../../core/types';
  import { deriveExtiLineId } from '../../core/solver';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    pin: PinInfo;
    x: number;
    y: number;
    currentAssignment?: PinAssignment;
    currentLabel?: string;
    isLocked: boolean;
    allAssignments: Record<string, PinAssignment>;
    /** Reports measured overlay bounds so the canvas can clamp to the viewport. */
    onMeasure?: (size: { width: number; height: number }) => void;
    onAssign: (assignment: PinAssignment) => void;
    onClear: () => void;
    onToggleLock: () => void;
    onClose: () => void;
  }

  let {
    chip,
    pin,
    x,
    y,
    currentAssignment,
    currentLabel = '',
    isLocked,
    allAssignments,
    onMeasure,
    onAssign,
    onClear,
    onToggleLock,
    onClose,
  }: Props = $props();

  let query = $state('');
  let searchInput = $state<HTMLInputElement | null>(null);
  let measuredWidth = $state(0);
  let measuredHeight = $state(0);

  $effect(() => {
    onMeasure?.({ width: measuredWidth, height: measuredHeight });
  });

  const muxModel = $derived(getChipMuxModel(chip));
  const bondedNames = $derived(pin.bondedNames ?? []);
  const extiLine = $derived(
    currentAssignment?.peripheral === 'GPIO' && currentAssignment.signal === 'EXTI'
      ? deriveExtiLineId(pin.name)
      : null,
  );

  const clampedPos = $derived.by(() => {
    if (typeof window === 'undefined') return { left: x, top: y };
    const width = 310;
    const height = 400;
    const left = Math.max(12, Math.min(x + 12, window.innerWidth - width - 12));
    const top = Math.max(56, Math.min(y - 24, window.innerHeight - height - 12));
    return { left, top };
  });

  // Track which (peripheral, signal) pairs are already assigned on OTHER pins
  const usedElsewhere = $derived.by(() => {
    const map = new Map<string, string>();
    const pinMap = new Map(chip.pins.map((p) => [p.pos, p.name]));
    for (const [pos, asgn] of Object.entries(allAssignments)) {
      if (pos === pin.pos || asgn.peripheral === 'GPIO') continue;
      map.set(`${asgn.peripheral}:${asgn.signal}`, pinMap.get(pos) ?? pos);
    }
    return map;
  });

  const filteredGpio = $derived.by(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [...GPIO_MODES];
    return GPIO_MODES.filter((m) => `GPIO_${m}`.toUpperCase().includes(q));
  });

  const groupedSignals = $derived.by(() => {
    const q = query.trim().toUpperCase();
    const groups = new Map<string, PinSignal[]>();
    for (const sig of pin.signals) {
      const full = `${sig.peripheral}_${sig.signal}`.toUpperCase();
      const muxStr = formatMuxLabel(sig, muxModel).toUpperCase();
      if (q && !full.includes(q) && !muxStr.includes(q)) continue;
      const list = groups.get(sig.peripheral) ?? [];
      list.push(sig);
      groups.set(sig.peripheral, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  });

  onMount(() => {
    // Do not open the on-screen keyboard on touch devices when a pin is tapped.
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      searchInput?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- Backdrop click catcher -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" onclick={onClose}></div>

<div
  bind:clientWidth={measuredWidth}
  bind:clientHeight={measuredHeight}
  class="card card-border fixed z-50 w-[310px] flex flex-col bg-base-100 shadow-xl overflow-hidden text-xs"
  style={`left: ${clampedPos.left}px; top: ${clampedPos.top}px; max-height: min(410px, 88dvh);`}
  role="dialog"
  aria-label={`Assign signal to ${pin.name}`}
>
  <!-- Header -->
  <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-base-300 bg-base-200">
    <div class="min-w-0">
      <div class="flex items-center gap-1.5 font-mono-tabular font-semibold text-foreground">
        <span>{pin.name}</span>
        <span class="text-base-content/60">·</span>
        <span class="text-base-content/60">Pin {pin.pos}</span>
      </div>
      {#if bondedNames.length > 0}
        <div class="text-[11px] font-mono text-info truncate" title={bondedNames.join(' / ')}>
          Bonded: {bondedNames.join(' / ')}
        </div>
      {/if}
      {#if currentLabel}
        <div class="text-[11px] font-mono text-info truncate">
          {currentLabel}
        </div>
      {/if}
      {#if extiLine}
        <div
          class="text-[11px] font-mono text-info truncate"
          title={`GPIO_EXTI uses hardware line ${extiLine}`}
        >
          EXTI line: {extiLine}
        </div>
      {/if}
      <div class="mt-1 flex items-center gap-1">
        <PinTagPills tags={pin.tags} compact={true} />
      </div>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onclick={onToggleLock}
        title={isLocked ? 'Unlock pin' : 'Lock pin'}
        class="btn btn-ghost btn-sm btn-square"
      >
        {#if isLocked}
          <Lock class="size-3.5 text-warning" />
        {:else}
          <Unlock class="size-3.5" />
        {/if}
      </button>
      {#if currentAssignment}
        <button
          type="button"
          onclick={() => {
            onClear();
            onClose();
          }}
          disabled={isLocked}
          title="Clear assignment"
          class="btn btn-ghost btn-sm btn-square text-error"
        >
          <Trash2 class="size-3.5" />
        </button>
      {/if}
      <button
        type="button"
        onclick={onClose}
        title="Close"
        class="btn btn-ghost btn-sm btn-square"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </div>

  <!-- Search Input -->
  <div class="px-2.5 py-2 border-b border-base-300">
    <div class="relative flex items-center">
      <Search class="size-3.5 text-base-content/40 absolute left-2.5 pointer-events-none" />
      <input
        bind:this={searchInput}
        bind:value={query}
        type="text"
        placeholder="Filter signals, peripheral, mux..."
        class="input input-xs w-full pl-8 pr-2.5"
      />
    </div>
    {#if isLocked}
      <p class="mt-1.5 text-[11px] text-warning">
        Pin is locked. Unlock above to change assignment.
      </p>
    {/if}
  </div>

  <!-- Signal Options List -->
  <div class="flex-1 overflow-y-auto p-1.5 space-y-2">
    {#if filteredGpio.length > 0}
      <div>
        <div class="px-2 py-1 text-[11px] font-medium text-base-content/60">
          GPIO
        </div>
        <div class="grid grid-cols-2 gap-1">
          {#each filteredGpio as mode}
            {@const isActive =
              currentAssignment?.peripheral === 'GPIO' && currentAssignment?.signal === mode}
            <button
              type="button"
              disabled={isLocked}
              title={mode === 'EXTI'
                ? extiLine
                  ? `Uses hardware line ${extiLine}`
                  : 'No EXTI line is derived from this pin name'
                : undefined}
              onclick={() => {
                onAssign({ peripheral: 'GPIO', signal: mode, af: null });
                onClose();
              }}
              class={`btn btn-ghost btn-sm w-full justify-between text-left ${
                isActive
                  ? 'bg-success/20 text-success font-medium'
                  : 'hover:bg-base-300 text-foreground'
              }`}
            >
              <span class="font-mono">GPIO_{mode}</span>
              {#if isActive}
                <Check class="size-3 shrink-0" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each groupedSignals as [peripheral, sigs] (peripheral)}
      <div>
        <div class="px-2 py-1 text-[11px] font-semibold text-base-content/60 border-t border-base-300">
          {peripheral}
        </div>
        <div class="space-y-0.5">
          {#each sigs as sig (`${sig.peripheral}:${sig.signal}`)}
            {@const isActive =
              currentAssignment?.peripheral === sig.peripheral &&
              currentAssignment?.signal === sig.signal}
            {@const conflictPin = usedElsewhere.get(`${sig.peripheral}:${sig.signal}`)}
            <button
              type="button"
              disabled={isLocked}
              onclick={() => {
                onAssign({ ...sig });
                onClose();
              }}
              class={`btn btn-ghost btn-sm w-full justify-between gap-2 text-left ${
                isActive
                  ? 'bg-success/20 text-success font-medium'
                  : 'hover:bg-base-300 text-foreground'
              }`}
            >
              <span class="font-mono truncate">{sig.peripheral}_{sig.signal}</span>
              <span class="flex items-center gap-1.5 shrink-0 font-mono-tabular text-[11px]">
                {#if conflictPin}
                  <span class="text-error" title={`Already assigned on ${conflictPin}`}>
                    on {conflictPin}
                  </span>
                {/if}
                <span class="text-base-content/60">
                  {formatMuxLabel(sig, muxModel)}
                </span>
                {#if isActive}
                  <Check class="size-3 text-success" />
                {/if}
              </span>
            </button>
          {/each}
        </div>
      </div>
    {/each}

    {#if filteredGpio.length === 0 && groupedSignals.length === 0}
      <div class="py-6 text-center text-base-content/60">
        No matching signals for "{query}".
      </div>
    {/if}
  </div>
</div>
