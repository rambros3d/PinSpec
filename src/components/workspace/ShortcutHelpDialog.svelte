<script lang="ts">
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount } from 'svelte';
  import { SHORTCUTS } from '../../data/provenance';
  import { openDialogWithFocus } from '../../state/dialog-focus';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let closeButtonEl = $state<HTMLButtonElement | null>(null);

  function closeDialog(): void {
    dialogEl?.close();
  }

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogEl?.open) dialogEl?.showModal();
    openDialogWithFocus(dialogEl, closeButtonEl, opener);
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
  aria-label="Keyboard shortcuts"
>
  <div class="modal-box w-full max-w-md max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden">
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-base-300">
      <h2 class="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
      <button
        bind:this={closeButtonEl}
        type="button"
        onclick={closeDialog}
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
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close shortcut help">close</button>
  </form>
</dialog>
