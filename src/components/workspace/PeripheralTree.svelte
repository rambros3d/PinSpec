<script lang="ts">
  import { ChevronDown, ChevronRight, Search } from 'lucide-svelte';
  import { getModesForPeripheral } from '../../core/solver';
  import type {
    ChipData,
    PeripheralKind,
    PeripheralStatus,
    PinAssignment,
  } from '../../core/types';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    peripheralModes: Record<string, string>;
    peripheralStatus: Record<string, PeripheralStatus>;
    onModeChange: (peripheralName: string, modeId: string) => void;
    onToggleSignal: (peripheralName: string, signal: string) => void;
    onFocusPin: (pos: string) => void;
  }

  let {
    chip,
    assignments,
    peripheralModes,
    peripheralStatus,
    onModeChange,
    onToggleSignal,
    onFocusPin,
  }: Props = $props();

  type CategoryId = 'system' | 'analog' | 'timers' | 'connectivity' | 'other';

  const CATEGORIES: Array<{ id: CategoryId; label: string; kinds: PeripheralKind[] }> = [
    { id: 'system', label: 'System Core', kinds: ['sys'] },
    { id: 'analog', label: 'Analog', kinds: ['adc', 'dac'] },
    { id: 'timers', label: 'Timers', kinds: ['tim'] },
    { id: 'connectivity', label: 'Connectivity', kinds: ['spi', 'i2c', 'usart', 'can', 'usb'] },
    { id: 'other', label: 'Other', kinds: ['other'] },
  ];

  let filterText = $state('');
  let openCategories = $state<Record<string, boolean>>({
    system: true,
    analog: false,
    timers: true,
    connectivity: true,
    other: false,
  });
  let expandedPeriphs = $state<Record<string, boolean>>({});

  // Map (peripheral:signal) -> { pos, pinName, af }
  const assignedLookup = $derived.by(() => {
    const pinMap = new Map(chip.pins.map((p) => [p.pos, p.name]));
    const map = new Map<string, { pos: string; pinName: string; af: number | null }>();
    for (const [pos, asgn] of Object.entries(assignments)) {
      if (asgn.peripheral === 'GPIO') continue;
      map.set(`${asgn.peripheral}:${asgn.signal}`, {
        pos,
        pinName: pinMap.get(pos) ?? pos,
        af: asgn.af,
      });
    }
    return map;
  });

  const grouped = $derived.by(() => {
    const q = filterText.trim().toUpperCase();
    return CATEGORIES.map((cat) => {
      const names = Object.entries(chip.peripherals)
        .filter(([name, info]) => {
          if (!cat.kinds.includes(info.kind)) return false;
          if (!q) return true;
          return (
            name.toUpperCase().includes(q) ||
            info.signals.some((s) => `${name}_${s}`.toUpperCase().includes(q))
          );
        })
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return { ...cat, names };
    }).filter((cat) => cat.names.length > 0);
  });

  function statusColor(status: PeripheralStatus): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-500';
      case 'partial':
        return 'bg-orange-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-400/50 dark:bg-slate-600';
    }
  }

  function statusLabel(status: PeripheralStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'partial':
        return 'Partial';
      case 'error':
        return 'Conflict';
      default:
        return 'Unused';
    }
  }

  function toggleCategory(id: string): void {
    openCategories[id] = !openCategories[id];
  }

  function togglePeripheral(name: string): void {
    expandedPeriphs[name] = !expandedPeriphs[name];
  }
</script>

<aside class="h-full flex flex-col bg-white dark:bg-[#121722] border-r border-slate-200 dark:border-slate-800 select-none overflow-hidden">
  <!-- Header + Filter -->
  <div class="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold text-slate-900 dark:text-slate-100">Peripherals</h2>
      <span class="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
        {Object.keys(chip.peripherals).length} blocks
      </span>
    </div>
    <div class="relative flex items-center">
      <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
      <input
        bind:value={filterText}
        type="text"
        placeholder="Filter SPI, TIM, USART..."
        class="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
      />
    </div>
  </div>

  <!-- Grouped Accordion -->
  <div class="flex-1 overflow-y-auto py-1">
    {#each grouped as cat (cat.id)}
      {@const isCatOpen = filterText.trim().length > 0 || openCategories[cat.id]}
      <div class="border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
        <button
          type="button"
          onclick={() => toggleCategory(cat.id)}
          class="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
        >
          <span class="flex items-center gap-1.5">
            {#if isCatOpen}
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            {:else}
              <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
            {/if}
            <span>{cat.label}</span>
          </span>
          <span class="font-mono-tabular text-[11px] text-slate-400 dark:text-slate-500">
            {cat.names.length}
          </span>
        </button>

        {#if isCatOpen}
          <div class="pb-1">
            {#each cat.names as pName (pName)}
              {@const pInfo = chip.peripherals[pName]}
              {@const pStatus = peripheralStatus[pName] ?? 'none'}
              {@const isOpen = Boolean(expandedPeriphs[pName])}
              {@const modes = getModesForPeripheral(chip, pName)}
              {@const activeMode = peripheralModes[pName] ?? 'disabled'}

              <div>
                <button
                  type="button"
                  onclick={() => togglePeripheral(pName)}
                  class={`w-full flex items-center justify-between px-4 py-1.5 text-left text-xs transition-colors ${
                    isOpen
                      ? 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/35 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span class="flex items-center gap-2 min-w-0">
                    {#if isOpen}
                      <ChevronDown class="w-3 h-3 text-slate-400 shrink-0" />
                    {:else}
                      <ChevronRight class="w-3 h-3 text-slate-400 shrink-0" />
                    {/if}
                    <span class="font-mono font-medium truncate">{pName}</span>
                  </span>
                  <span class="flex items-center gap-1.5 shrink-0" title={statusLabel(pStatus)}>
                    {#if pStatus !== 'none'}
                      <span
                        class={`text-[10px] font-medium ${
                          pStatus === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : pStatus === 'partial'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {statusLabel(pStatus)}
                      </span>
                    {/if}
                    <span class={`w-2 h-2 rounded-full ${statusColor(pStatus)}`}></span>
                  </span>
                </button>

                {#if isOpen}
                  <div class="px-4 py-2 bg-slate-50/70 dark:bg-[#0d111a] border-y border-slate-100 dark:border-slate-800/70 space-y-2">
                    <!-- Mode Selector Dropdown -->
                    {#if modes.length > 1}
                      <div class="space-y-1">
                        <label
                          for={`mode-${pName}`}
                          class="block text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Mode
                        </label>
                        <select
                          id={`mode-${pName}`}
                          value={activeMode}
                          onchange={(e) =>
                            onModeChange(pName, (e.currentTarget as HTMLSelectElement).value)}
                          class="w-full px-2 py-1.5 rounded bg-white dark:bg-[#121722] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                        >
                          {#each modes as m (m.id)}
                            <option value={m.id}>{m.label}</option>
                          {/each}
                        </select>
                      </div>
                    {/if}

                    <!-- Individual Signal Toggles -->
                    <div class="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
                      {#each pInfo.signals as sig (sig)}
                        {@const assigned = assignedLookup.get(`${pName}:${sig}`)}
                        <div class="flex items-center justify-between gap-2 py-0.5">
                          <label class="flex items-center gap-2 min-w-0 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(assigned)}
                              onchange={() => onToggleSignal(pName, sig)}
                              class="rounded border-slate-300 dark:border-slate-600 text-sky-500 focus:ring-sky-500/40"
                            />
                            <span class="font-mono truncate">{sig}</span>
                          </label>
                          {#if assigned}
                            <button
                              type="button"
                              onclick={() => onFocusPin(assigned.pos)}
                              title="Locate pin on package"
                              class="font-mono-tabular text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                            >
                              {assigned.pinName}{assigned.af !== null ? ` / AF${assigned.af}` : ''}
                            </button>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</aside>
