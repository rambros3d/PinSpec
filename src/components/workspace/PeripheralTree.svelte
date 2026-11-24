<script lang="ts">
  /** Compact, navigable peripheral tree. Editing happens in the right drawer. */
  import { ChevronDown, ChevronRight, Search } from 'lucide-svelte';
  import { getModesForPeripheral } from '../../core/solver';
  import type { ChipData, PeripheralStatus } from '../../core/types';
  import {
    orderPeripheralNames,
    partitionPeripherals,
    PERIPHERAL_CATEGORIES,
  } from '../../core/vendor-view';
  import { viewPreferences } from '../../state/workspace-preferences.svelte';

  interface Props {
    chip: ChipData;
    peripheralStatus: Record<string, PeripheralStatus>;
    peripheralModes: Record<string, string>;
    onSelectPeripheral: (peripheralName: string) => void;
  }

  let { chip, peripheralStatus, peripheralModes, onSelectPeripheral }: Props = $props();

  const partition = $derived(partitionPeripherals(peripheralStatus, peripheralModes));
  const hasConfigured = $derived(partition.configured.length > 0);

  const grouped = $derived.by(() => {
    const query = viewPreferences.filterText.trim().toUpperCase();
    return PERIPHERAL_CATEGORIES.map((category) => {
      const names = Object.entries(chip.peripherals)
        .filter(([name, info]) => {
          if (!category.kinds.includes(info.kind)) return false;
          if (!query) return true;
          return (
            name.toUpperCase().includes(query) ||
            info.signals.some((signal) => `${name}_${signal}`.toUpperCase().includes(query))
          );
        })
        .map(([name]) => name);
      return { ...category, names: orderPeripheralNames(names, partition) };
    }).filter((category) => category.names.length > 0);
  });

  function statusColor(status: PeripheralStatus): string {
    switch (status) {
      case 'active':
        return 'bg-success';
      case 'partial':
        return 'bg-warning';
      case 'error':
        return 'bg-error';
      default:
        return 'bg-base-300';
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

  function inlineModeLabel(name: string): string {
    const modeId = peripheralModes[name] ?? 'disabled';
    return getModesForPeripheral(chip, name).find((mode) => mode.id === modeId)?.label ?? modeId;
  }
</script>

<aside class="h-full min-h-0 flex flex-col bg-base-100 border-r border-base-300 select-none overflow-hidden">
  <!-- Header + Filter -->
  <div class="p-2.5 border-b border-base-300 space-y-2">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold text-foreground">Peripherals</h2>
      <span class="font-mono-tabular text-[11px] text-base-content/60">
        {Object.keys(chip.peripherals).length} blocks
      </span>
    </div>
    <div class="relative flex items-center">
      <Search class="size-3.5 text-base-content/40 absolute left-2.5 pointer-events-none" />
      <input
        bind:value={viewPreferences.filterText}
        type="text"
        placeholder="Filter SPI, TIM, USART, PWM, PIO..."
        class="input input-xs w-full pl-8 pr-2.5"
      />
    </div>
  </div>

  <!-- Grouped Accordion -->
  <div class="flex-1 min-h-0 overflow-y-auto py-1">
    {#if !hasConfigured}
      <p class="px-3 py-2 text-[11px] text-base-content/60">
        No peripherals configured. Select one below to open its configuration.
      </p>
    {/if}

    {#each grouped as category (category.id)}
      {@const isCategoryOpen =
        viewPreferences.filterText.trim().length > 0 || viewPreferences.isCategoryOpen(category.id)}
      <div class="border-b border-base-300 last:border-b-0">
        <button
          type="button"
          onclick={() =>
            viewPreferences.setCategoryOpen(category.id, !viewPreferences.isCategoryOpen(category.id))}
          class="btn btn-ghost btn-sm w-full justify-between text-xs font-semibold"
        >
          <span class="flex items-center gap-1.5">
            {#if isCategoryOpen}
              <ChevronDown class="size-3.5 text-base-content/40" />
            {:else}
              <ChevronRight class="size-3.5 text-base-content/40" />
            {/if}
            <span>
              {category.id === 'other'
                ? `${category.label} (${category.names.length})`
                : category.label}
            </span>
          </span>
          <span class="font-mono-tabular text-[11px] text-base-content/60">
            {category.names.length}
          </span>
        </button>

        {#if isCategoryOpen}
          <div class="pb-1">
            {#each category.names as name (name)}
              {@const status = peripheralStatus[name] ?? 'none'}
              {@const isSelected = viewPreferences.selectedPeripheral === name}
              <button
                type="button"
                onclick={() => onSelectPeripheral(name)}
                class={`btn btn-ghost btn-sm w-full justify-between gap-2 text-xs ${
                  isSelected ? 'btn-active' : ''
                }`}
                aria-current={isSelected ? 'true' : undefined}
              >
                <span class="flex items-center gap-2 min-w-0">
                  <span class="font-mono font-medium truncate">{name}</span>
                  <span class="badge badge-ghost badge-xs font-mono text-[10px] text-base-content/60">
                    {inlineModeLabel(name)}
                  </span>
                </span>
                <span class="flex items-center gap-1.5 shrink-0" title={statusLabel(status)}>
                  <span class={`status status-sm ${statusColor(status)}`}></span>
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</aside>
