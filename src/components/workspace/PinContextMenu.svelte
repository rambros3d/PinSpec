<script lang="ts">
  import { ArrowLeftRight, Crosshair, Lock, Tag, Trash2, Unlock } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { formatMuxLabel, getChipMuxModel, type ChipData, type PinAssignment, type PinInfo } from '../../core/types';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    pin: PinInfo;
    x: number;
    y: number;
    assignment?: PinAssignment;
    label: string;
    isLocked: boolean;
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
  class="fixed z-50 w-[236px] rounded-panel border-ui border-hairline bg-surface shadow-xl py-1 text-xs"
  style={`left: ${clampedPos.left}px; top: ${clampedPos.top}px;`}
  role="menu"
>
  <div class="px-3 py-1.5 border-ui-b border-hairline flex items-center justify-between font-mono-tabular">
    <span class="font-semibold text-primary">{pin.name}</span>
    <span class="text-muted">Pin {pin.pos}</span>
  </div>

  {#if assignment || pin.bondedNames?.length || pin.tags?.length}
    <div class="px-3 py-1.5 border-ui-b border-hairline space-y-1">
      {#if assignment}
        <div class="font-mono text-[11px] text-primary">
          {assignment.peripheral}_{assignment.signal}
          <span class="text-muted">[{muxLabel}]</span>
        </div>
      {/if}
      {#if pin.bondedNames?.length}
        <div class="text-[11px] text-muted font-mono">
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
      <label class="block text-[11px] text-muted" for="pin-label-input">
        Custom Net Label
      </label>
      <input
        id="pin-label-input"
        bind:this={labelInput}
        bind:value={draftLabel}
        type="text"
        placeholder="e.g. MOTOR_U_HI"
        class="w-full px-2 py-1.5 rounded-control bg-elevated border-ui border-strong font-mono text-primary focus:outline-none focus:border-hint"
      />
      <div class="flex justify-end gap-1.5">
        <button
          type="button"
          onclick={onClose}
          class="px-2.5 py-1 rounded-control border-ui border-hairline text-muted hover:bg-elevated"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-2.5 py-1 rounded-control bg-action hover:bg-action-hover text-on-action font-medium"
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
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-elevated"
      >
        <Tag class="size-ui-md text-faint" />
        <span>{label ? 'Edit Net Label' : 'Set Net Label'}</span>
      </button>

      <button
        type="button"
        onclick={() => {
          onToggleLock();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-elevated"
      >
        {#if isLocked}
          <Unlock class="size-ui-md text-pin-power" />
          <span>Unlock Pin</span>
        {:else}
          <Lock class="size-ui-md text-faint" />
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
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-elevated disabled:opacity-40"
      >
        <Crosshair class="size-ui-md text-hint" />
        <span>Highlight Alternate Pins</span>
      </button>

      <button
        type="button"
        disabled={!canRemap}
        onclick={() => {
          onEnterRemap();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-elevated disabled:opacity-40"
      >
        <ArrowLeftRight class="size-ui-md text-hint" />
        <span>Remap Pin (Ctrl+Click)</span>
      </button>

      <div class="my-1 border-ui-t border-hairline"></div>

      <button
        type="button"
        disabled={!assignment || isLocked}
        onclick={() => {
          onClear();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-danger-soft disabled:opacity-40"
      >
        <Trash2 class="size-ui-md" />
        <span>Clear Assignment</span>
      </button>
    </div>
  {/if}
</div>
