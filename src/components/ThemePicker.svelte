<script lang="ts">
  import Monitor from '@solar-icons/svelte/bold-duotone/monitor';
  import Moon from '@solar-icons/svelte/bold-duotone/moon';
  import Sun from '@solar-icons/svelte/bold-duotone/sun';
  import { MODE_LABELS, themeStore } from '../state/theme.svelte';

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  let ModeIcon = $derived(
    themeStore.mode === 'system' ? Monitor : themeStore.mode === 'light' ? Sun : Moon,
  );
  let label = $derived(MODE_LABELS[themeStore.mode]);
</script>

<button
  type="button"
  onclick={() => themeStore.cycle()}
  title={`Appearance: ${label}`}
  aria-label={`Appearance: ${label}`}
  class={`btn btn-ghost btn-sm gap-1.5 ${compact ? 'btn-square' : ''}`}
>
  <ModeIcon class="size-4" />
  {#if !compact}
    <span class="text-xs font-medium whitespace-nowrap">{label}</span>
  {/if}
</button>
