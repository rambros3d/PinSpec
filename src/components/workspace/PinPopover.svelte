<script lang="ts">
  import { Check, Lock, Search, Trash2, Unlock, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import {
    GPIO_MODES,
    type ChipData,
    type PinAssignment,
    type PinInfo,
    type PinSignal,
  } from '../../core/types';

  interface Props {
    chip: ChipData;
    pin: PinInfo;
    x: number;
    y: number;
    currentAssignment?: PinAssignment;
    currentLabel?: string;
    isLocked: boolean;
    allAssignments: Record<string, PinAssignment>;
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
    onAssign,
    onClear,
    onToggleLock,
    onClose,
  }: Props = $props();

  let query = $state('');
  let searchInput = $state<HTMLInputElement | null>(null);

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
      const afStr = sig.af !== null ? `AF${sig.af}` : 'AFIO';
      if (q && !full.includes(q) && !afStr.includes(q)) continue;
      const list = groups.get(sig.peripheral) ?? [];
      list.push(sig);
      groups.set(sig.peripheral, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  });

  onMount(() => {
    searchInput?.focus();
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
  class="fixed z-50 w-[310px] max-h-[410px] flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121722] shadow-xl overflow-hidden text-xs"
  style={`left: ${clampedPos.left}px; top: ${clampedPos.top}px;`}
  role="dialog"
  aria-label={`Assign signal to ${pin.name}`}
>
  <!-- Header -->
  <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f141e]">
    <div class="min-w-0">
      <div class="flex items-center gap-1.5 font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
        <span>{pin.name}</span>
        <span class="text-slate-400 dark:text-slate-500">·</span>
        <span class="text-slate-500 dark:text-slate-400">Pin {pin.pos}</span>
      </div>
      {#if currentLabel}
        <div class="text-[11px] font-mono text-sky-600 dark:text-sky-400 truncate">
          {currentLabel}
        </div>
      {/if}
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onclick={onToggleLock}
        title={isLocked ? 'Unlock pin' : 'Lock pin'}
        class="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
      >
        {#if isLocked}
          <Lock class="w-3.5 h-3.5 text-amber-500" />
        {:else}
          <Unlock class="w-3.5 h-3.5" />
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
          class="p-1.5 rounded hover:bg-red-500/15 text-red-500 disabled:opacity-40"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      {/if}
      <button
        type="button"
        onclick={onClose}
        title="Close"
        class="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Search Input -->
  <div class="px-2.5 py-2 border-b border-slate-200 dark:border-slate-800">
    <div class="relative flex items-center">
      <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
      <input
        bind:this={searchInput}
        bind:value={query}
        type="text"
        placeholder="Filter signals, peripheral, AF..."
        class="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 text-xs"
      />
    </div>
    {#if isLocked}
      <p class="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
        Pin is locked. Unlock above to change assignment.
      </p>
    {/if}
  </div>

  <!-- Signal Options List -->
  <div class="flex-1 overflow-y-auto p-1.5 space-y-2">
    {#if filteredGpio.length > 0}
      <div>
        <div class="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          GPIO
        </div>
        <div class="grid grid-cols-2 gap-1">
          {#each filteredGpio as mode}
            {@const isActive =
              currentAssignment?.peripheral === 'GPIO' && currentAssignment?.signal === mode}
            <button
              type="button"
              disabled={isLocked}
              onclick={() => {
                onAssign({ peripheral: 'GPIO', signal: mode, af: null });
                onClose();
              }}
              class={`flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors disabled:opacity-40 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span class="font-mono">GPIO_{mode}</span>
              {#if isActive}
                <Check class="w-3 h-3 shrink-0" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each groupedSignals as [peripheral, sigs] (peripheral)}
      <div>
        <div class="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/70">
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
                onAssign({
                  peripheral: sig.peripheral,
                  signal: sig.signal,
                  af: sig.af,
                });
                onClose();
              }}
              class={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors disabled:opacity-40 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span class="font-mono truncate">{sig.peripheral}_{sig.signal}</span>
              <span class="flex items-center gap-1.5 shrink-0 font-mono-tabular text-[11px]">
                {#if conflictPin}
                  <span class="text-red-500 dark:text-red-400" title={`Already assigned on ${conflictPin}`}>
                    on {conflictPin}
                  </span>
                {/if}
                <span class="text-slate-500 dark:text-slate-400">
                  {sig.af !== null ? `AF${sig.af}` : 'AFIO'}
                </span>
                {#if isActive}
                  <Check class="w-3 h-3 text-emerald-500" />
                {/if}
              </span>
            </button>
          {/each}
        </div>
      </div>
    {/each}

    {#if filteredGpio.length === 0 && groupedSignals.length === 0}
      <div class="py-6 text-center text-slate-500 dark:text-slate-400">
        No matching signals for "{query}".
      </div>
    {/if}
  </div>
</div>
