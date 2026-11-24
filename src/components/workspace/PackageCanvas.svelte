<script lang="ts">
  import { Maximize2, Minus, Plus, RotateCw, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type {
    ChipData,
    PinAssignment,
    PinInfo,
    PinVisualStatus,
  } from '../../core/types';
  import GridPackage from './GridPackage.svelte';
  import PerimeterPackage from './PerimeterPackage.svelte';
  import PinContextMenu from './PinContextMenu.svelte';
  import PinPopover from './PinPopover.svelte';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pinStatus: Record<string, PinVisualStatus>;
    rotation: 0 | 90 | 180 | 270;
    highlightedPins: string[];
    remapSourcePos: string | null;
    focusPinRequest?: { pos: string; nonce: number } | null;
    onAssign: (pos: string, assignment: PinAssignment) => void;
    onClear: (pos: string) => void;
    onSetLabel: (pos: string, label: string) => void;
    onToggleLock: (pos: string) => void;
    onHighlightAlternates: (pos: string) => void;
    onEnterRemap: (pos: string) => void;
    onCompleteRemap: (targetPos: string) => boolean;
    onCancelRemap: () => void;
    onRotate: () => void;
  }

  let {
    chip,
    assignments,
    labels,
    locked,
    pinStatus,
    rotation,
    highlightedPins,
    remapSourcePos,
    focusPinRequest = null,
    onAssign,
    onClear,
    onSetLabel,
    onToggleLock,
    onHighlightAlternates,
    onEnterRemap,
    onCompleteRemap,
    onCancelRemap,
    onRotate,
  }: Props = $props();

  let stageEl = $state<HTMLDivElement | null>(null);
  let contentEl = $state<HTMLDivElement | null>(null);

  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;

  let hoveredPin = $state<{ pin: PinInfo; x: number; y: number } | null>(null);
  let popover = $state<{ pin: PinInfo; x: number; y: number } | null>(null);
  let contextMenu = $state<{ pin: PinInfo; x: number; y: number } | null>(null);

  const highlightSet = $derived(new Set<string>(highlightedPins));

  const remapSourceLabel = $derived.by(() => {
    if (!remapSourcePos) return '';
    const asgn = assignments[remapSourcePos];
    const pin = chip.pins.find((p) => p.pos === remapSourcePos);
    if (!asgn || !pin) return '';
    return `${asgn.peripheral}_${asgn.signal} (${pin.name})`;
  });

  export function fitView(): void {
    if (!stageEl || !contentEl) return;
    const svg = contentEl.querySelector('svg');
    if (!svg) return;
    const sw = Number(svg.getAttribute('width')) || 700;
    const sh = Number(svg.getAttribute('height')) || 700;
    const isRotated = rotation === 90 || rotation === 270;
    const effW = isRotated ? sh : sw;
    const effH = isRotated ? sw : sh;

    const rect = stageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pad = 48;
    const scaleX = (rect.width - pad) / effW;
    const scaleY = (rect.height - pad) / effH;
    const nextZoom = Math.max(0.4, Math.min(1.6, Math.min(scaleX, scaleY)));

    zoom = Number(nextZoom.toFixed(3));
    panX = (rect.width - sw * zoom) / 2;
    panY = (rect.height - sh * zoom) / 2;
  }

  function zoomBy(factor: number, clientX?: number, clientY?: number): void {
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const cx = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const cy = clientY !== undefined ? clientY - rect.top : rect.height / 2;

    const prevZoom = zoom;
    const nextZoom = Math.max(0.4, Math.min(4.5, prevZoom * factor));
    const ratio = nextZoom / prevZoom;

    panX = cx - (cx - panX) * ratio;
    panY = cy - (cy - panY) * ratio;
    zoom = Number(nextZoom.toFixed(3));
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomBy(factor, e.clientX, e.clientY);
  }

  function handlePointerDown(e: PointerEvent): void {
    // Allow left-drag on background or middle-mouse drag anywhere
    const isPinTarget = (e.target as HTMLElement | null)?.closest('[data-pin-pos]');
    if (e.button === 1 || (e.button === 0 && !isPinTarget)) {
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panOriginX = panX;
      panOriginY = panY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: PointerEvent): void {
    if (dragging) {
      panX = panOriginX + (e.clientX - dragStartX);
      panY = panOriginY + (e.clientY - dragStartY);
    } else if (hoveredPin) {
      hoveredPin = { ...hoveredPin, x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (dragging) {
      dragging = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer was not captured
      }
    }
  }

  function handlePinClick(pin: PinInfo, e: MouseEvent): void {
    contextMenu = null;

    // 1. If Remap Mode is active, clicking a candidate moves the assignment
    if (remapSourcePos) {
      if (pin.pos === remapSourcePos) {
        onCancelRemap();
        return;
      }
      if (onCompleteRemap(pin.pos)) {
        return;
      }
    }

    // 2. Ctrl+Click / Cmd+Click on an assigned pin enters Remap Mode
    if ((e.ctrlKey || e.metaKey) && assignments[pin.pos]) {
      popover = null;
      onEnterRemap(pin.pos);
      return;
    }

    // 3. Regular left-click on an I/O pin opens searchable AF popover
    if (pin.type === 'io') {
      popover = { pin, x: e.clientX, y: e.clientY };
    }
  }

  function handlePinContextMenu(pin: PinInfo, e: MouseEvent): void {
    popover = null;
    if (pin.type !== 'io') return;
    contextMenu = { pin, x: e.clientX, y: e.clientY };
  }

  function handlePinHover(pin: PinInfo | null, e?: MouseEvent): void {
    if (!pin || !e) {
      hoveredPin = null;
      return;
    }
    hoveredPin = { pin, x: e.clientX, y: e.clientY };
  }

  // Fit view automatically whenever chip or rotation changes
  let lastFittedKey = '';
  $effect(() => {
    const key = `${chip.id}:${rotation}`;
    if (key !== lastFittedKey && stageEl && contentEl) {
      lastFittedKey = key;
      queueMicrotask(() => fitView());
    }
  });

  // Focus & center pin when requested from SummaryDrawer
  $effect(() => {
    if (!focusPinRequest || !stageEl || !contentEl) return;
    const pinEl = contentEl.querySelector(`[data-pin-pos="${CSS.escape(focusPinRequest.pos)}"]`);
    if (!pinEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const pinRect = pinEl.getBoundingClientRect();
    const targetCx = stageRect.left + stageRect.width / 2;
    const targetCy = stageRect.top + stageRect.height / 2;
    const pinCx = pinRect.left + pinRect.width / 2;
    const pinCy = pinRect.top + pinRect.height / 2;
    panX += targetCx - pinCx;
    panY += targetCy - pinCy;
  });

  onMount(() => {
    fitView();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'Escape' && remapSourcePos) {
        onCancelRemap();
      } else if (e.key === '0' && !inInput && !e.ctrlKey && !e.metaKey) {
        fitView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tooltipPos = $derived.by(() => {
    if (!hoveredPin || typeof window === 'undefined') return { left: 0, top: 0 };
    const w = 270;
    const h = 220;
    return {
      left: Math.min(hoveredPin.x + 16, window.innerWidth - w - 12),
      top: Math.min(hoveredPin.y + 16, window.innerHeight - h - 12),
    };
  });
</script>

<div
  bind:this={stageEl}
  class={`relative flex-1 h-full overflow-hidden bg-[#f8fafc] dark:bg-[#0b0e14] bg-dot-grid select-none ${
    dragging ? 'cursor-grabbing' : 'cursor-grab'
  }`}
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="application"
  aria-label="Interactive STM32 package canvas"
>
  <!-- Transformed SVG Stage -->
  <div
    bind:this={contentEl}
    class="absolute top-0 left-0 origin-top-left will-change-transform"
    style={`transform: translate3d(${panX}px, ${panY}px, 0) scale(${zoom});`}
  >
    <div
      class="origin-center transition-transform duration-150"
      style={`transform: rotate(${rotation}deg);`}
    >
      {#if chip.package.kind === 'grid'}
        <GridPackage
          {chip}
          {assignments}
          {labels}
          {locked}
          {pinStatus}
          {zoom}
          highlightedPins={highlightSet}
          {remapSourcePos}
          selectedPinPos={popover?.pin.pos ?? contextMenu?.pin.pos ?? null}
          onPinClick={handlePinClick}
          onPinContextMenu={handlePinContextMenu}
          onPinHover={handlePinHover}
        />
      {:else}
        <PerimeterPackage
          {chip}
          {assignments}
          {labels}
          {locked}
          {pinStatus}
          highlightedPins={highlightSet}
          {remapSourcePos}
          selectedPinPos={popover?.pin.pos ?? contextMenu?.pin.pos ?? null}
          onPinClick={handlePinClick}
          onPinContextMenu={handlePinContextMenu}
          onPinHover={handlePinHover}
        />
      {/if}
    </div>
  </div>

  <!-- Remap Mode Top-Center Banner -->
  {#if remapSourcePos}
    <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-2 rounded-lg border border-sky-500/60 bg-sky-950/90 text-sky-100 text-xs shadow-lg">
      <span class="font-mono font-medium">
        Remap Mode: click any pulsing cyan pin to move {remapSourceLabel}
      </span>
      <button
        type="button"
        onclick={onCancelRemap}
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 whitespace-nowrap"
      >
        <X class="w-3 h-3" />
        <span>Cancel (Esc)</span>
      </button>
    </div>
  {/if}

  <!-- Top-Right Canvas HUD Controls -->
  <div class="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#121722]/95 shadow-sm text-xs">
    <button
      type="button"
      onclick={() => zoomBy(1 / 1.2)}
      title="Zoom Out"
      class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <Minus class="w-3.5 h-3.5" />
    </button>
    <span class="px-1.5 font-mono-tabular text-slate-600 dark:text-slate-300 min-w-[44px] text-center">
      {Math.round(zoom * 100)}%
    </span>
    <button
      type="button"
      onclick={() => zoomBy(1.2)}
      title="Zoom In"
      class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <Plus class="w-3.5 h-3.5" />
    </button>
    <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
    <button
      type="button"
      onclick={fitView}
      title="Fit View (0)"
      class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <Maximize2 class="w-3.5 h-3.5" />
    </button>
    <button
      type="button"
      onclick={onRotate}
      title="Rotate Package 90 deg"
      class="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono-tabular"
    >
      <RotateCw class="w-3.5 h-3.5" />
      <span>{rotation}°</span>
    </button>
  </div>

  <!-- Bottom-Left Semantic Legend -->
  <div class="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#121722]/90 text-[11px] text-slate-600 dark:text-slate-400">
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#475569]"></span>
      Unused
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#eab308]"></span>
      Power / Reset
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#10b981]"></span>
      Assigned
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#f97316]"></span>
      Partial
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#ef4444]"></span>
      Conflict
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-xs bg-[#38bdf8]"></span>
      Remap / Search
    </span>
  </div>

  <!-- Bottom-Right Interaction Hint -->
  <div class="hidden xl:flex absolute bottom-3 right-3 z-20 items-center gap-2 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-[#121722]/85 text-[11px] text-slate-500 dark:text-slate-400">
    <span>Left-click: Assign</span>
    <span aria-hidden="true">·</span>
    <span>Right-click: Label / Lock</span>
    <span aria-hidden="true">·</span>
    <span>Ctrl+Click: Remap</span>
  </div>

  <!-- Hover Floating AF Table Tooltip -->
  {#if hoveredPin && !popover && !contextMenu && !dragging}
    {@const hPin = hoveredPin.pin}
    {@const hAsgn = assignments[hPin.pos]}
    {@const hLabel = labels[hPin.pos]}
    <div
      class="fixed z-30 w-[268px] pointer-events-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-[#121722]/95 shadow-lg p-2.5 text-xs"
      style={`left: ${tooltipPos.left}px; top: ${tooltipPos.top}px;`}
    >
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
        <span class="font-mono font-semibold text-slate-900 dark:text-slate-100">
          {hPin.name}
        </span>
        <span class="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
          Pin {hPin.pos} · {hPin.type.toUpperCase()}
        </span>
      </div>

      {#if hAsgn}
        <div class="mt-1.5 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 dark:text-slate-400">Active</span>
          <span class="font-mono font-medium text-emerald-600 dark:text-emerald-400">
            {hAsgn.peripheral}_{hAsgn.signal}{hAsgn.af !== null ? ` (AF${hAsgn.af})` : ''}
          </span>
        </div>
      {/if}

      {#if hLabel}
        <div class="mt-1 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 dark:text-slate-400">Label</span>
          <span class="font-mono text-sky-600 dark:text-sky-400">{hLabel}</span>
        </div>
      {/if}

      {#if hPin.signals.length > 0}
        <div class="mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
          <div class="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Alternate Functions ({hPin.signals.length})
          </div>
          <div class="grid grid-cols-1 gap-0.5 max-h-[140px] overflow-hidden">
            {#each hPin.signals.slice(0, 10) as sig}
              <div class="flex items-center justify-between font-mono-tabular text-[11px]">
                <span class="text-slate-700 dark:text-slate-300 truncate">
                  {sig.peripheral}_{sig.signal}
                </span>
                <span class="text-slate-400 dark:text-slate-500 ml-2 shrink-0">
                  {sig.af !== null ? `AF${sig.af}` : 'AFIO'}
                </span>
              </div>
            {/each}
            {#if hPin.signals.length > 10}
              <div class="text-[10px] text-slate-400 dark:text-slate-500">
                +{hPin.signals.length - 10} more signals (click to inspect)
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Dedicated {hPin.type} pin.
        </div>
      {/if}
    </div>
  {/if}

  <!-- Left-Click Searchable AF Popover -->
  {#if popover}
    <PinPopover
      {chip}
      pin={popover.pin}
      x={popover.x}
      y={popover.y}
      currentAssignment={assignments[popover.pin.pos]}
      currentLabel={labels[popover.pin.pos] ?? ''}
      isLocked={Boolean(locked[popover.pin.pos])}
      allAssignments={assignments}
      onAssign={(asgn) => onAssign(popover!.pin.pos, asgn)}
      onClear={() => onClear(popover!.pin.pos)}
      onToggleLock={() => onToggleLock(popover!.pin.pos)}
      onClose={() => (popover = null)}
    />
  {/if}

  <!-- Right-Click Pin Context Menu -->
  {#if contextMenu}
    <PinContextMenu
      pin={contextMenu.pin}
      x={contextMenu.x}
      y={contextMenu.y}
      assignment={assignments[contextMenu.pin.pos]}
      label={labels[contextMenu.pin.pos] ?? ''}
      isLocked={Boolean(locked[contextMenu.pin.pos])}
      onSetLabel={(lbl) => onSetLabel(contextMenu!.pin.pos, lbl)}
      onToggleLock={() => onToggleLock(contextMenu!.pin.pos)}
      onHighlightAlternates={() => onHighlightAlternates(contextMenu!.pin.pos)}
      onEnterRemap={() => onEnterRemap(contextMenu!.pin.pos)}
      onClear={() => onClear(contextMenu!.pin.pos)}
      onClose={() => (contextMenu = null)}
    />
  {/if}
</div>
