<script lang="ts">
  import { orderedPinTags, PIN_TAG_LABELS } from '../../core/vendor-view';
  import type { PinTag } from '../../core/types';

  interface Props {
    tags?: PinTag[];
    compact?: boolean;
  }

  let { tags = [], compact = false }: Props = $props();

  const pills = $derived(orderedPinTags(tags));
</script>

{#if pills.length > 0}
  <span class="inline-flex flex-wrap items-center gap-1">
    {#each pills as tag (tag)}
      <span
        class={`badge badge-ghost badge-xs font-mono uppercase tracking-wide ${
          compact ? 'text-[9px]' : 'text-[10px]'
        }`}
        title={`Pin tag: ${PIN_TAG_LABELS[tag]}`}
      >
        {PIN_TAG_LABELS[tag]}
      </span>
    {/each}
  </span>
{/if}
