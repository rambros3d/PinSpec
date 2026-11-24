<script lang="ts">
  import { ArrowLeftRight, Crosshair, Lock, Tag, Trash2, Unlock } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { PinAssignment, PinInfo } from '../../core/types';

  interface Props {
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
  class="fixed z-50 w-[236px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121722] shadow-xl py-1 text-xs"
  style={`left: ${clampedPos.left}px; top: ${clampedPos.top}px;`}
  role="menu"
>
  <div class="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono-tabular">
    <span class="font-semibold text-slate-900 dark:text-slate-100">{pin.name}</span>
    <span class="text-slate-500 dark:text-slate-400">Pin {pin.pos}</span>
  </div>

  {#if editingLabel}
    <form
      class="p-2 space-y-2"
      onsubmit={(e) => {
        e.preventDefault();
        commitLabel();
      }}
    >
      <label class="block text-[11px] text-slate-500 dark:text-slate-400" for="pin-label-input">
        Custom Net Label
      </label>
      <input
        id="pin-label-input"
        bind:this={labelInput}
        bind:value={draftLabel}
        type="text"
        placeholder="e.g. MOTOR_U_HI"
        class="w-full px-2 py-1.5 rounded bg-slate-100 dark:bg-[#0b0e14] border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
      />
      <div class="flex justify-end gap-1.5">
        <button
          type="button"
          onclick={onClose}
          class="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium"
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
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Tag class="w-3.5 h-3.5 text-slate-400" />
        <span>{label ? 'Edit Net Label' : 'Set Net Label'}</span>
      </button>

      <button
        type="button"
        onclick={() => {
          onToggleLock();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {#if isLocked}
          <Unlock class="w-3.5 h-3.5 text-amber-500" />
          <span>Unlock Pin</span>
        {:else}
          <Lock class="w-3.5 h-3.5 text-slate-400" />
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
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
      >
        <Crosshair class="w-3.5 h-3.5 text-sky-500" />
        <span>Highlight Alternate Pins</span>
      </button>

      <button
        type="button"
        disabled={!canRemap}
        onclick={() => {
          onEnterRemap();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
      >
        <ArrowLeftRight class="w-3.5 h-3.5 text-sky-500" />
        <span>Remap Pin (Ctrl+Click)</span>
      </button>

      <div class="my-1 border-t border-slate-200 dark:border-slate-800"></div>

      <button
        type="button"
        disabled={!assignment || isLocked}
        onclick={() => {
          onClear();
          onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
      >
        <Trash2 class="w-3.5 h-3.5" />
        <span>Clear Assignment</span>
      </button>
    </div>
  {/if}
</div>
