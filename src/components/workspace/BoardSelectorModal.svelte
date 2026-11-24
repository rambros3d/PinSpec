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
  let dialogEl = $state<HTMLDialogElement | null>(null);

  const results = $derived.by(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [...presets];
    return presets.filter((preset) =>
      `${preset.board} ${preset.mcuId} ${preset.package} ${preset.description}`
        .toUpperCase()
        .includes(q),
    );
  });

  /** Native dialog close path; the close event notifies the parent once. */
  function closeDialog(): void {
    dialogEl?.close();
  }

  onMount(() => {
    dialogEl?.showModal();
    inputEl?.focus();
  });
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclose={onClose}
  oncancel={(e) => {
    e.preventDefault();
    closeDialog();
  }}
  onclick={(e) => {
    if (e.target === dialogEl) closeDialog();
  }}
  aria-label="Select a board preset"
>
  <div
    class="modal-box w-full max-w-2xl p-0 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] min-h-0"
  >
    <div class="flex items-center justify-between px-4 py-3.5 border-b border-base-300">
      <div>
        <h2 class="text-sm font-semibold text-foreground">Official ST Board Presets</h2>
        <p class="text-xs text-base-content/60 mt-0.5">
          Start from a curated board configuration; assignments and labels are applied on open.
        </p>
      </div>
      <button type="button" onclick={closeDialog} class="btn btn-ghost btn-sm btn-square" aria-label="Close board selector" title="Close (Esc)">
        <X class="size-4" />
      </button>
    </div>

    <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-base-300 bg-base-200">
      <Search class="size-4 text-base-content/40 shrink-0" />
      <input
        bind:this={inputEl}
        bind:value={query}
        type="text"
        placeholder="Filter by board, MCU, or package..."
        class="input input-ghost flex-1 bg-transparent text-sm font-mono"
        aria-label="Filter board presets"
      />
      <span class="font-mono-tabular text-[11px] text-base-content/60">{results.length} shown</span>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-base-300">
      {#if results.length === 0}
        <div class="py-10 text-center text-xs text-base-content/60">No board presets match "{query}".</div>
      {:else}
        {#each results as preset (preset.id)}
          <button
            type="button"
            onclick={() => {
              closeDialog();
              onSelect(preset);
            }}
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-300 transition-colors"
          >
            <CircuitBoard class="size-3.5 text-info shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-semibold text-sm text-foreground">{preset.board}</span>
                <span class="badge badge-xs badge-ghost font-mono text-[9px] uppercase">
                  {preset.mcuId}
                </span>
              </div>
              <p class="text-[11px] text-base-content/60 mt-1">{preset.description}</p>
            </div>
            <div class="text-right shrink-0 font-mono-tabular text-[11px] text-base-content/60">
              <div class="text-foreground">{preset.package}</div>
              <div>{preset.pins.length} configured pins</div>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <div class="px-4 py-2.5 border-t border-base-300 bg-base-200 text-[11px] text-base-content/60">
      Source: STMicroelectronics/STM32_open_pin_data board files (BSD-3-Clause). Curated subset.
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close board selector">close</button>
  </form>
</dialog>
