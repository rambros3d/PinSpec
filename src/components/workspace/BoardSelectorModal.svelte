<script lang="ts">
  import { CircuitBoard, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { BoardPreset } from '../../data/boards';

  interface Props {
    presets: readonly BoardPreset[];
    onSelect: (preset: BoardPreset) => void;
    onClose: () => void;
  }

  let { presets, onSelect, onClose }: Props = $props();

  let query = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const results = $derived.by(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [...presets];
    return presets.filter((preset) =>
      `${preset.board} ${preset.mcuId} ${preset.package} ${preset.description}`
        .toUpperCase()
        .includes(q),
    );
  });

  onMount(() => {
    inputEl?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 bg-overlay flex items-start justify-center pt-[10vh] px-4" onclick={onClose}>
  <div
    class="w-full max-w-2xl rounded-panel border-ui border-hairline bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[76vh]"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Select a board preset"
  >
    <div class="flex items-center justify-between px-4 py-3.5 border-ui-b border-hairline">
      <div>
        <h2 class="text-sm font-semibold text-primary">Official ST Board Presets</h2>
        <p class="text-xs text-muted mt-0.5">
          Start from a curated board configuration; assignments and labels are applied on open.
        </p>
      </div>
      <button type="button" onclick={onClose} class="p-1 rounded-control hover:bg-elevated text-muted" title="Close (Esc)">
        <X class="size-ui" />
      </button>
    </div>

    <div class="flex items-center gap-2.5 px-4 py-2.5 border-ui-b border-hairline bg-subtle">
      <Search class="size-ui text-faint shrink-0" />
      <input
        bind:this={inputEl}
        bind:value={query}
        type="text"
        placeholder="Filter by board, MCU, or package..."
        class="flex-1 bg-transparent text-sm text-primary placeholder:text-faint focus:outline-none font-mono"
      />
      <span class="font-mono-tabular text-[11px] text-muted">{results.length} shown</span>
    </div>

    <div class="flex-1 overflow-y-auto divide-y divide-hairline">
      {#if results.length === 0}
        <div class="py-10 text-center text-xs text-muted">No board presets match "{query}".</div>
      {:else}
        {#each results as preset (preset.id)}
          <button
            type="button"
            onclick={() => onSelect(preset)}
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-elevated transition-colors"
          >
            <CircuitBoard class="size-ui-md text-hint shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-semibold text-sm text-primary">{preset.board}</span>
                <span class="px-1 py-px rounded-control border-ui border-hairline bg-subtle font-mono text-[9px] uppercase text-muted">
                  {preset.mcuId}
                </span>
              </div>
              <p class="text-[11px] text-muted mt-1">{preset.description}</p>
            </div>
            <div class="text-right shrink-0 font-mono-tabular text-[11px] text-muted">
              <div class="text-primary">{preset.package}</div>
              <div>{preset.pins.length} configured pins</div>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <div class="px-4 py-2.5 border-ui-t border-hairline bg-subtle text-[11px] text-muted">
      Source: STMicroelectronics/STM32_open_pin_data board files (BSD-3-Clause). Curated subset.
    </div>
  </div>
</div>
