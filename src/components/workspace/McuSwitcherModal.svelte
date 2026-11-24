<script lang="ts">
  import { Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';

  interface Props {
    activeMcuId: string;
    onSelect: (mcuId: string) => void;
    onClose: () => void;
  }

  let { activeMcuId, onSelect, onClose }: Props = $props();

  let query = $state('');
  let familyFilter = $state('');
  let pkgFilter = $state('');
  let activeIdx = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const familyOptions = ['F1', 'F4', 'G4', 'H7', 'U5', 'C0'];
  const pkgOptions = ['LQFP', 'QFN', 'BGA'];

  const results = $derived.by(() =>
    searchCatalogEntries(
      catalogStore.index,
      query,
      { family: familyFilter, packageKind: pkgFilter },
      50,
    ),
  );

  $effect(() => {
    // Reset highlighted index when results change
    results.length;
    activeIdx = 0;
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      onSelect(results[activeIdx].id);
      onClose();
    }
  }

  onMount(() => {
    catalogStore.ensureLoaded();
    inputEl?.focus();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-overlay flex items-start justify-center pt-[8vh] px-4"
  onclick={onClose}
>
  <div
    class="w-full max-w-2xl rounded-xl border border-hairline bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[78vh]"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Switch STM32 MCU"
  >
    <!-- Search bar -->
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
      <Search class="w-4 h-4 text-faint shrink-0" />
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search STM32 part number, family, or package (e.g. G431, H743 BGA, F411)..."
        class="flex-1 bg-transparent text-sm text-primary placeholder:text-faint focus:outline-none font-mono"
      />
      <button
        type="button"
        onclick={onClose}
        class="p-1 rounded hover:bg-elevated text-muted"
        title="Close (Esc)"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Filter Controls -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-hairline bg-subtle text-xs">
      <div class="flex flex-wrap items-center gap-1">
        {#each familyOptions as fam}
          <button
            type="button"
            onclick={() => (familyFilter = familyFilter === fam ? '' : fam)}
            class={`px-2 py-1 rounded font-mono whitespace-nowrap transition-colors ${
              familyFilter === fam
                ? 'bg-action text-on-action font-medium'
                : 'bg-elevated text-primary hover:bg-elevated'
            }`}
          >
            {fam}
          </button>
        {/each}
        <span class="mx-1 text-faint">|</span>
        {#each pkgOptions as pkg}
          <button
            type="button"
            onclick={() => (pkgFilter = pkgFilter === pkg ? '' : pkg)}
            class={`px-2 py-1 rounded font-mono whitespace-nowrap transition-colors ${
              pkgFilter === pkg
                ? 'bg-action text-on-action font-medium'
                : 'bg-elevated text-primary hover:bg-elevated'
            }`}
          >
            {pkg}
          </button>
        {/each}
      </div>
      <span class="font-mono-tabular text-[11px] text-muted">
        {results.length} shown of {catalogStore.index.length}
      </span>
    </div>

    <!-- Results List -->
    <div class="flex-1 overflow-y-auto divide-y divide-hairline">
      {#if catalogStore.loadingIndex}
        <div class="py-10 text-center text-xs text-muted">Loading STM32 catalog...</div>
      {:else if results.length === 0}
        <div class="py-10 text-center text-xs text-muted">
          No STM32 parts matched "{query}".
        </div>
      {:else}
        {#each results as entry, i (entry.id)}
          {@const isSelected = i === activeIdx}
          {@const isCurrent = entry.id === activeMcuId}
          <button
            type="button"
            onclick={() => {
              onSelect(entry.id);
              onClose();
            }}
            onmouseenter={() => (activeIdx = i)}
            class={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
              isSelected
                ? 'bg-info-soft'
                : 'hover:bg-elevated'
            }`}
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Cpu class="w-4 h-4 text-faint shrink-0" />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold text-sm text-primary">
                    {entry.id}
                  </span>
                  {#if isCurrent}
                    <span class="text-[11px] font-medium text-pin-success">
                      Active
                    </span>
                  {/if}
                </div>
                <div class="text-[11px] font-mono-tabular text-muted">
                  {entry.core} · {entry.flashKb} KB Flash · {entry.ramKb} KB RAM
                </div>
              </div>
            </div>
            <div class="text-right font-mono-tabular text-xs shrink-0">
              <div class="text-primary font-medium">{entry.package}</div>
              <div class="text-[11px] text-muted">
                {entry.pinCount} pins
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
