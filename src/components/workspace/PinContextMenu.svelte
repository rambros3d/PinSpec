<script lang="ts">
  import ArrowLeftRight from '@solar-icons/svelte/bold-duotone/transfer-horizontal';
  import Crosshair from '@solar-icons/svelte/bold-duotone/target';
  import Lock from '@solar-icons/svelte/bold-duotone/lock';
  import Tag from '@solar-icons/svelte/bold-duotone/tag';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import Unlock from '@solar-icons/svelte/bold-duotone/lock-unlocked';
  import { onMount } from 'svelte';
  import { formatMuxLabel, getChipMuxModel, type ChipData, type PinAssignment, type PinInfo } from '../../core/types';
  import { deriveExtiLineId } from '../../core/solver';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    pin: PinInfo;
    x: number;
    y: number;
    assignment?: PinAssignment;
    label: string;
    isLocked: boolean;
    /** Reports measured overlay bounds so the canvas can clamp to the viewport. */
    onMeasure?: (size: { width: number; height: number }) => void;
    onSetLabel: (label: string) => void;
    onToggleLock: () => void;
    onHighlightAlternates: () => void;
    onEnterRemap: () => void;
    onClear: () => void;
    onClose: () => void;
  }

  let {
    chip,
    pin,
    x,
    y,
    assignment,
    label,
    isLocked,
    onMeasure,
    onSetLabel,
    onToggleLock,
    onHighlightAlternates,
    onEnterRemap,
    onClear,
    onClose,
  }: Props = $props();

  let editingLabel = $state(false);
  let draftLabel = $state('');
  let labelInput = $state<HTMLInputElement | null>(null);
  let measuredWidth = $state(0);
  let measuredHeight = $state(0);

  $effect(() => {
    onMeasure?.({ width: measuredWidth, height: measuredHeight });
  });

  $effect(() => {
    draftLabel = label;
  });

  const clampedPos = $derived.by(() => {
    if (typeof window === 'undefined') return { left: x, top: y };
    const width = 236;
    const height = 230;
    return {
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(52, Math.min(y, window.innerHeight - height - 8)),
    };
  });

  const canRemap = $derived(Boolean(assignment && assignment.peripheral !== 'GPIO'));
  const muxLabel = $derived(
    assignment ? formatMuxLabel(assignment, getChipMuxModel(chip)) : '',
  );
  const extiLine = $derived(
    assignment?.peripheral === 'GPIO' && assignment.signal === 'EXTI'
      ? deriveExtiLineId(pin.name)
      : null,
  );

  function startEditLabel(): void {
    draftLabel = label;
    editingLabel = true;
    queueMicrotask(() => {
      labelInput?.focus();
      labelInput?.select();
    });
  }

  function commitLabel(): void {
    onSetLabel(draftLabel);
    onClose();
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" onclick={onClose} oncontextmenu={(e) => { e.preventDefault(); onClose(); }}></div>

<div
  bind:clientWidth={measuredWidth}
  bind:clientHeight={measuredHeight}
  class="card card-border fixed z-50 w-[236px] bg-base-100 shadow-xl py-1 text-xs"
  style={`left: ${clampedPos.left}px; top: ${clampedPos.top}px; max-height: 88dvh; overflow-y: auto;`}
  role="menu"
>
  <div class="px-3 py-1.5 border-b border-base-300 flex items-center justify-between font-mono-tabular">
    <span class="font-semibold text-foreground">{pin.name}</span>
    <span class="text-base-content/60">Pin {pin.pos}</span>
  </div>

  {#if assignment || pin.bondedNames?.length || pin.tags?.length}
    <div class="px-3 py-1.5 border-b border-base-300 space-y-1">
      {#if assignment}
        <div class="font-mono text-[11px] text-foreground">
          {assignment.peripheral}_{assignment.signal}
          <span class="text-base-content/60">[{muxLabel}]</span>
        </div>
      {/if}
      {#if extiLine}
        <div
          class="font-mono text-[11px] text-info"
          title={`GPIO_EXTI uses hardware line ${extiLine}`}
        >
          EXTI line: {extiLine}
        </div>
      {/if}
      {#if pin.bondedNames?.length}
        <div class="text-[11px] text-base-content/60 font-mono">
          Bonded: {pin.bondedNames.join(' / ')}
        </div>
      {/if}
      <PinTagPills tags={pin.tags} compact={true} />
    </div>
  {/if}

  {#if editingLabel}
    <form
      class="p-2 space-y-2"
      onsubmit={(e) => {
        e.preventDefault();
        commitLabel();
      }}
    >
      <label class="block text-[11px] text-base-content/60" for="pin-label-input">
        Custom Net Label
      </label>
      <input
        id="pin-label-input"
        bind:this={labelInput}
        bind:value={draftLabel}
        type="text"
        placeholder="e.g. MOTOR_U_HI"
        class="input input-xs w-full font-mono"
      />
      <div class="flex justify-end gap-1.5">
        <button
          type="button"
          onclick={onClose}
          class="btn btn-xs btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn-xs btn-primary font-medium"
        >
          Save
        </button>
      </div>
    </form>
  {:else}
    <div class="py-1">
      <button
        type="button"
        onclick={startEditLabel}
        class="btn btn-ghost btn-sm w-full justify-start gap-2 text-left"
      >
        <Tag class="size-3.5 text-base-content/40" />
        <span>{label ? 'Edit Net Label' : 'Set Net Label'}</span>
      </button>

      <button
        type="button"
        onclick={() => {
          onToggleLock();
          onClose();
        }}
        class="btn btn-ghost btn-sm w-full justify-start gap-2 text-left"
      >
        {#if isLocked}
          <Unlock class="size-3.5 text-warning" />
          <span>Unlock Pin</span>
        {:else}
          <Lock class="size-3.5 text-base-content/40" />
          <span>Lock Pin</span>
        {/if}
      </button>

      <button
        type="button"
        disabled={!canRemap}
        onclick={() => {
          onHighlightAlternates();
          onClose();
        }}
        class="btn btn-ghost btn-sm w-full justify-start gap-2 text-left"
      >
        <Crosshair class="size-3.5 text-info" />
        <span>Highlight Alternate Pins</span>
      </button>

      <button
        type="button"
        disabled={!canRemap}
        onclick={() => {
          onEnterRemap();
          onClose();
        }}
        class="btn btn-ghost btn-sm w-full justify-start gap-2 text-left"
      >
        <ArrowLeftRight class="size-3.5 text-info" />
        <span>Remap Pin (Ctrl+Click)</span>
      </button>

      <div class="my-1 border-t border-base-300"></div>

      <button
        type="button"
        disabled={!assignment || isLocked}
        onclick={() => {
          onClear();
          onClose();
        }}
        class="btn btn-ghost btn-sm w-full justify-start gap-2 text-left text-error"
      >
        <Trash2 class="size-3.5" />
        <span>Clear Assignment</span>
      </button>
    </div>
  {/if}
</div>
