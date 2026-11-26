<script lang="ts">
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { SHORTCUTS } from '../../data/provenance';
  import Dialog from '../shell/Dialog.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let closeButtonEl = $state<HTMLButtonElement | null>(null);
  let dialogRef = $state<{ close: () => void } | null>(null);
</script>

<Dialog
  bind:this={dialogRef}
  ariaLabel="Keyboard shortcuts"
  boxClass="w-full max-w-md max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden"
  {onClose}
  bind:focusTarget={closeButtonEl}
>
  <div class="flex items-center justify-between px-5 py-3.5 border-b border-base-300">
    <h2 class="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
    <button
      bind:this={closeButtonEl}
      type="button"
      onclick={() => dialogRef?.close()}
      class="btn btn-ghost btn-sm btn-square"
      aria-label="Close shortcut help"
      title="Close"
    >
      <X class="size-4" />
    </button>
  </div>
  <div class="px-5 py-4 min-h-0 overflow-y-auto">
    <dl class="space-y-2 text-xs">
      {#each SHORTCUTS as shortcut (shortcut.keys)}
        <div class="flex items-center justify-between gap-4">
          <dt class="font-mono font-medium text-foreground">{shortcut.keys}</dt>
          <dd class="text-right text-base-content/60">{shortcut.action}</dd>
        </div>
      {/each}
    </dl>
  </div>
</Dialog>
