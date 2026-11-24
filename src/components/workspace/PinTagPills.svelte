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
        class={`inline-flex items-center rounded-control border-ui border-hairline bg-subtle font-mono uppercase tracking-wide text-muted ${
          compact ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
        }`}
        title={`Pin tag: ${PIN_TAG_LABELS[tag]}`}
      >
        {PIN_TAG_LABELS[tag]}
      </span>
    {/each}
  </span>
{/if}
