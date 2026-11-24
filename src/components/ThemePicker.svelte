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

<div class="dropdown dropdown-end relative shrink-0" bind:this={rootEl}>
  <button
    type="button"
    onclick={() => (open = !open)}
    title={`Theme: ${themeStore.label}`}
    aria-label="Select theme"
    aria-expanded={open}
    class={`btn btn-ghost btn-sm gap-1.5 ${compact ? 'btn-square' : ''}`}
  >
    <Palette class="size-4" />
    {#if !compact}
      <span class="text-xs font-medium whitespace-nowrap">{themeStore.label}</span>
    {/if}
  </button>

  {#if open}
    <div
      class="menu menu-sm dropdown-content absolute right-0 top-10 z-50 w-40 rounded-box border border-base-300 bg-base-100 shadow-xl p-1 text-xs"
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
          class={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-field text-left transition-colors ${
            themeStore.id === theme.id
              ? 'bg-primary/10 text-foreground font-medium'
              : 'text-base-content/60 hover:bg-base-300 hover:text-foreground'
          }`}
        >
          <span>{theme.label}</span>
          {#if themeStore.id === theme.id}
            <Check class="size-3.5 text-info" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
