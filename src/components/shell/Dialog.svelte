<script lang="ts">
  /** Native modal wrapper shared by every dialog surface. */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { openDialogWithFocus } from '../../state/dialog-focus';

  interface Props {
    ariaLabel: string;
    boxClass: string;
    onClose: () => void;
    focusTarget?: HTMLElement | null;
    backdropLabel?: string;
    children: Snippet;
  }

  let {
    ariaLabel,
    boxClass,
    onClose,
    focusTarget = $bindable(null),
    backdropLabel = 'Close',
    children,
  }: Props = $props();

  let dialogEl = $state<HTMLDialogElement | null>(null);

  /** Close path exposed to callers that act before notifying their owner. */
  export function close(): void {
    dialogEl?.close();
  }

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogEl?.open) dialogEl.showModal();
    openDialogWithFocus(dialogEl, focusTarget, opener);
  });
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclose={onClose}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
  onclick={(e) => {
    if (e.target === dialogEl) close();
  }}
  aria-label={ariaLabel}
>
  <div class={`modal-box ${boxClass}`}>
    {@render children()}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={backdropLabel}>close</button>
  </form>
</dialog>
