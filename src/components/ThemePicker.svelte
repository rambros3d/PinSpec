<script lang="ts">
  import { Check, Palette } from 'lucide-svelte';
  import { themeStore, themes } from '../state/theme.svelte';

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  function handlePointerDown(event: PointerEvent): void {
    if (rootEl && !rootEl.contains(event.target as Node)) open = false;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') open = false;
  }
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeyDown} />

<div class="relative shrink-0" bind:this={rootEl}>
  <button
    type="button"
    onclick={() => (open = !open)}
    title={`Theme: ${themeStore.label}`}
    aria-label="Select theme"
    aria-expanded={open}
    class={`inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface text-muted hover:border-hint hover:text-primary transition-colors ${
      compact ? 'p-1.5' : 'px-2.5 py-2'
    }`}
  >
    <Palette class="w-4 h-4" />
    {#if !compact}
      <span class="text-xs font-medium whitespace-nowrap">{themeStore.label}</span>
    {/if}
  </button>

  {#if open}
    <div
      class="absolute right-0 top-10 z-50 w-40 rounded-lg border border-hairline bg-surface shadow-xl p-1 text-xs"
      role="menu"
    >
      {#each themes as theme (theme.id)}
        <button
          type="button"
          role="menuitem"
          onclick={() => {
            themeStore.set(theme.id);
            open = false;
          }}
          class={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors ${
            themeStore.id === theme.id
              ? 'bg-action-soft text-primary font-medium'
              : 'text-muted hover:bg-elevated hover:text-primary'
          }`}
        >
          <span>{theme.label}</span>
          {#if themeStore.id === theme.id}
            <Check class="w-3.5 h-3.5 text-hint" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
