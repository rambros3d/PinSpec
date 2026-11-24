<script lang="ts">
  import { Crosshair, Maximize2, Minus, Plus, RotateCw, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { normalizeAngle, normalizePlacement } from '../../core/placement';
  import { clampOverlayPosition } from '../../core/overlay-position';
  import {
    formatMuxLabel,
    getChipMuxModel,
    type ChipData,
    type PackageRotation,
    type PinAssignment,
    type PinInfo,
    type PinPlacementPreference,
    type PinVisualStatus,
    type PlacementRing,
  } from '../../core/types';
  import { workspaceStore } from '../../state/workspace.svelte';
  import GridPackage from './GridPackage.svelte';
  import PerimeterPackage from './PerimeterPackage.svelte';
  import PinContextMenu from './PinContextMenu.svelte';
  import PinPopover from './PinPopover.svelte';
  import PlacementOverlay, { type PlacementIndicator } from './PlacementOverlay.svelte';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pinStatus: Record<string, PinVisualStatus>;
    rotation: PackageRotation;
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
  let stageWidth = $state(0);
  let stageHeight = $state(0);

  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;

  // Active touch pointers feed one cursor-centred zoom operation. A second
  // pointer cancels pan and switches the stage to pinch scaling.
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let gestureScale = 1;

  let hoveredPin = $state<{ pin: PinInfo; x: number; y: number } | null>(null);
  let popover = $state<{ pin: PinInfo; x: number; y: number } | null>(null);
  let contextMenu = $state<{ pin: PinInfo; x: number; y: number } | null>(null);

  // Measured overlay bounds; defaults keep the first render inside the viewport.
  let popoverSize = $state({ width: 310, height: 400 });
  let contextSize = $state({ width: 236, height: 230 });
  let tooltipWidth = $state(268);
  let tooltipHeight = $state(220);

  const muxModel = $derived(getChipMuxModel(chip));

  const placementSettings = $derived(normalizePlacement(workspaceStore.state));
  const overlayRotation = $derived(
    normalizeAngle(workspaceStore.state.placementOverlayRotation ?? 0),
  );
  let selectedPlacementPeripheral = $state<string | null>(null);

  // Selector options: allocatable peripherals from the chip plus system
  // peripherals that hold assignments. GPIO is never an allocatable option.
  const placementOptions = $derived.by<string[]>(() => {
    const names = new Set<string>();
    for (const [name, info] of Object.entries(chip.peripherals)) {
      if (name === 'GPIO') continue;
      if (info.signals.length > 0 || info.kind === 'sys') names.add(name);
    }
    for (const asgn of Object.values(assignments)) {
      if (asgn.peripheral === 'GPIO') continue;
      const info = chip.peripherals[asgn.peripheral];
      if (!info || info.signals.length === 0 || info.kind === 'sys') {
        names.add(asgn.peripheral);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  });

  // Only opted-in peripherals get a ring indicator; assigned but unconfigured
  // peripherals remain selectable without biasing the allocator.
  const placementIndicators = $derived.by<PlacementIndicator[]>(() => {
    const names = new Set<string>(
      placementOptions.filter((name) => placementSettings.preferences[name]?.enabled),
    );
    for (const [name, preference] of Object.entries(placementSettings.preferences)) {
      if (preference.enabled) names.add(name);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({
        name,
        preference: placementSettings.preferences[name] ?? null,
        claimed: Object.entries(assignments)
          .filter(([, asgn]) => asgn.peripheral === name)
          .map(([pos]) => pos),
      }));
  });

  // Reuse the established highlight plumbing for the selected peripheral.
  const highlightSet = $derived.by(() => {
    const set = new Set<string>(highlightedPins);
    if (placementSettings.overlayVisible && selectedPlacementPeripheral) {
      const indicator = placementIndicators.find(
        (item) => item.name === selectedPlacementPeripheral,
      );
      for (const pos of indicator?.claimed ?? []) set.add(pos);
    }
    return set;
  });

  const overlayCenterX = $derived(stageWidth / 2);
  const overlayCenterY = $derived(stageHeight / 2);
  const overlayRadius = $derived(Math.max(40, Math.min(stageWidth, stageHeight) * 0.36));

  function placementPreference(name: string): PinPlacementPreference {
    return (
      placementSettings.preferences[name] ?? {
        angle: 0,
        ring: 'outer',
        enabled: true,
      }
    );
  }

  function handlePlacementAngle(
    name: string,
    angle: number,
    ring: PlacementRing,
    commit: boolean,
  ): void {
    const preference: PinPlacementPreference = {
      ...placementPreference(name),
      angle,
      ring,
    };
    if (commit) workspaceStore.commitPlacement(name, preference);
    else workspaceStore.previewPlacement(name, preference);
  }

  function handlePlacementEnable(name: string): void {
    workspaceStore.setPlacement(name, { angle: 0, ring: 'outer', enabled: true });
    selectedPlacementPeripheral = name;
  }

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
    const isRotated = rotation === -90;
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

  /** Wheel input: discrete step for a mouse wheel, fine step for trackpad pinch. */
  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = Math.max(-60, Math.min(60, e.deltaY));
      zoomBy(Math.exp(-delta * 0.004), e.clientX, e.clientY);
    } else {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomBy(factor, e.clientX, e.clientY);
    }
  }

  /** Re-baseline the pinch from the first two active pointers. */
  function resetPinch(): void {
    const points = Array.from(activePointers.values());
    if (points.length < 2) {
      pinchDistance = 0;
      return;
    }
    const [a, b] = points;
    pinchDistance = Math.hypot(b.x - a.x, b.y - a.y);
  }

  interface CanvasGestureEvent extends Event {
    scale: number;
  }

  function handleGestureStart(e: Event): void {
    e.preventDefault();
    dragging = false;
    gestureScale = (e as CanvasGestureEvent).scale || 1;
  }

  function handleGestureChange(e: Event): void {
    e.preventDefault();
    const scale = (e as CanvasGestureEvent).scale || 1;
    if (gestureScale > 0 && scale > 0) zoomBy(scale / gestureScale);
    gestureScale = scale;
  }

  function handleGestureEnd(e: Event): void {
    e.preventDefault();
    gestureScale = 1;
  }

  function handlePointerDown(e: PointerEvent): void {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size >= 2) {
      // A second pointer starts a pinch, never a pan.
      dragging = false;
      resetPinch();
      return;
    }
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
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePointers.size >= 2) {
      const points = Array.from(activePointers.values());
      const [a, b] = points;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (pinchDistance > 0 && distance > 0) {
        zoomBy(distance / pinchDistance, midX, midY);
      }
      pinchDistance = distance;
      return;
    }
    if (dragging) {
      panX = panOriginX + (e.clientX - dragStartX);
      panY = panOriginY + (e.clientY - dragStartY);
    } else if (hoveredPin) {
      hoveredPin = { ...hoveredPin, x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    activePointers.delete(e.pointerId);
    resetPinch();
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
    const stage = stageEl;
    if (stage) {
      stage.addEventListener('wheel', handleWheel, { passive: false });
      stage.addEventListener('gesturestart', handleGestureStart, { passive: false });
      stage.addEventListener('gesturechange', handleGestureChange, { passive: false });
      stage.addEventListener('gestureend', handleGestureEnd, { passive: false });
    }
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
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
    return () => {
      if (stage) {
        stage.removeEventListener('wheel', handleWheel);
        stage.removeEventListener('gesturestart', handleGestureStart);
        stage.removeEventListener('gesturechange', handleGestureChange);
        stage.removeEventListener('gestureend', handleGestureEnd);
      }
      window.removeEventListener('keydown', onKey);
    };
  });

  // Overlays stay floating in every orientation; clamp before passing coordinates.
  const popoverPos = $derived.by(() => {
    if (!popover || typeof window === 'undefined') return { x: 0, y: 0 };
    const clamped = clampOverlayPosition(
      popover.x + 12,
      popover.y - 24,
      popoverSize.width,
      popoverSize.height,
      window.innerWidth,
      window.innerHeight,
      12,
    );
    return { x: Math.max(12, clamped.left - 12), y: clamped.top + 24 };
  });

  const contextMenuPos = $derived.by(() => {
    if (!contextMenu || typeof window === 'undefined') return { x: 0, y: 0 };
    return clampOverlayPosition(
      contextMenu.x,
      contextMenu.y,
      contextSize.width,
      contextSize.height,
      window.innerWidth,
      window.innerHeight,
      8,
    );
  });

  const tooltipPos = $derived.by(() => {
    if (!hoveredPin || typeof window === 'undefined') return { left: 12, top: 12 };
    return clampOverlayPosition(
      hoveredPin.x + 16,
      hoveredPin.y + 16,
      tooltipWidth,
      tooltipHeight,
      window.innerWidth,
      window.innerHeight,
      12,
    );
  });
</script>

<div
  bind:this={stageEl}
  bind:clientWidth={stageWidth}
  bind:clientHeight={stageHeight}
  class={`canvas-stage relative flex-1 h-full overflow-hidden bg-base-100 bg-dot-grid select-none ${
    dragging ? 'cursor-grabbing' : 'cursor-grab'
  }`}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="application"
  aria-label={`Interactive ${chip.vendor ?? 'stm32'} package canvas`}
>
  <!-- Transformed SVG Stage -->
  <div
    bind:this={contentEl}
    class="absolute top-0 left-0 origin-top-left will-change-transform"
    style={`transform: translate3d(${panX}px, ${panY}px, 0) scale(${zoom});`}
  >
    {#if chip.package.kind === 'grid'}
      <GridPackage
        {chip}
        {assignments}
        {labels}
        {locked}
        {pinStatus}
        {zoom}
        {rotation}
        muxModel={muxModel}
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
        {zoom}
        {rotation}
        muxModel={muxModel}
        highlightedPins={highlightSet}
        {remapSourcePos}
        selectedPinPos={popover?.pin.pos ?? contextMenu?.pin.pos ?? null}
        onPinClick={handlePinClick}
        onPinContextMenu={handlePinContextMenu}
        onPinHover={handlePinHover}
      />
    {/if}
  </div>

  <!-- Toggleable pin-placement affinity overlay -->
  {#if placementSettings.overlayVisible}
    <PlacementOverlay
      {stageEl}
      centerX={overlayCenterX}
      centerY={overlayCenterY}
      radius={overlayRadius}
      indicators={placementIndicators}
      options={placementOptions}
      selected={selectedPlacementPeripheral}
      {overlayRotation}
      onSelect={(name) => (selectedPlacementPeripheral = name)}
      onAngle={handlePlacementAngle}
      onEnable={handlePlacementEnable}
      onRotate={() => workspaceStore.setPlacementOverlayRotation(overlayRotation + 90)}
      onClose={() => {
        selectedPlacementPeripheral = null;
        workspaceStore.setPlacementOverlayVisible(false);
      }}
    />
  {/if}

  <!-- Top-centre controls: placement toggle stacked with the remap banner -->
  <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
    <button
      type="button"
      onclick={() => {
        const next = !placementSettings.overlayVisible;
        if (!next) selectedPlacementPeripheral = null;
        workspaceStore.setPlacementOverlayVisible(next);
      }}
      title={placementSettings.overlayVisible ? 'Hide placement overlay' : 'Show placement overlay'}
      aria-pressed={placementSettings.overlayVisible}
      class="card card-border pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 bg-base-100/95 text-xs shadow-sm"
    >
      <Crosshair class="size-3.5" />
      <span class="font-medium">Placement</span>
    </button>

    {#if remapSourcePos}
      <div role="status" class="alert alert-info pointer-events-auto flex items-center gap-3 px-3.5 py-2 text-xs shadow-lg">
        <span class="font-mono font-medium">
          Remap Mode: click any pulsing cyan pin to move {remapSourceLabel}
        </span>
        <button
          type="button"
          onclick={onCancelRemap}
          class="btn btn-xs btn-primary whitespace-nowrap"
        >
          <X class="size-3" />
          <span>Cancel (Esc)</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Top-Right Canvas HUD Controls -->
  <div class="card card-border absolute top-3 right-3 z-20 flex items-center gap-1 p-1 bg-base-100/95 shadow-sm text-xs">
    <button
      type="button"
      onclick={() => zoomBy(1 / 1.2)}
      title="Zoom Out"
      class="btn btn-ghost btn-sm btn-square"
    >
      <Minus class="size-3.5" />
    </button>
    <span class="px-1.5 font-mono-tabular text-base-content/60 min-w-[44px] text-center">
      {Math.round(zoom * 100)}%
    </span>
    <button
      type="button"
      onclick={() => zoomBy(1.2)}
      title="Zoom In"
      class="btn btn-ghost btn-sm btn-square"
    >
      <Plus class="size-3.5" />
    </button>
    <div class="w-px h-4 bg-base-300 mx-0.5"></div>
    <button
      type="button"
      onclick={fitView}
      title="Fit View (0)"
      class="btn btn-ghost btn-sm btn-square"
    >
      <Maximize2 class="size-3.5" />
    </button>
    <button
      type="button"
      onclick={onRotate}
      title={rotation === -90 ? 'Restore package orientation' : 'Rotate package counter-clockwise'}
      class="btn btn-ghost btn-sm gap-1 font-mono-tabular"
    >
      <RotateCw class="size-3.5" />
      <span class="hidden xl:inline">Rotate</span>
    </button>
  </div>

  <!-- Bottom-Left Semantic Legend -->
  <div class="card card-border absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 bg-base-100/95 text-[11px] text-base-content/60">
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-base-300"></span>
      Unused
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-warning"></span>
      Power / Reset
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-success"></span>
      Assigned
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-warning"></span>
      Partial
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-error"></span>
      Conflict
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-xs bg-info"></span>
      Remap / Search
    </span>
  </div>

  <!-- Bottom-Right Interaction Hint -->
  <div class="card card-border hidden xl:flex absolute bottom-3 right-3 z-20 items-center gap-2 px-2.5 py-1 bg-base-100/95 text-[11px] text-base-content/60">
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
      bind:clientWidth={tooltipWidth}
      bind:clientHeight={tooltipHeight}
      class="card card-border fixed z-30 w-[268px] pointer-events-none bg-base-100/95 shadow-lg p-2.5 text-xs"
      style={`left: ${tooltipPos.left}px; top: ${tooltipPos.top}px; max-height: 88dvh; overflow: hidden;`}
    >
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-base-300">
        <span class="font-mono font-semibold text-foreground">
          {hPin.name}
        </span>
        <span class="font-mono-tabular text-[11px] text-base-content/60">
          Pin {hPin.pos} · {hPin.type.toUpperCase()}
        </span>
      </div>

      {#if hPin.bondedNames?.length}
        <div class="mt-1 font-mono text-[11px] text-info">
          Bonded pads: {hPin.bondedNames.join(' / ')}
        </div>
      {/if}

      {#if hPin.tags?.length}
        <div class="mt-1"><PinTagPills tags={hPin.tags} compact={true} /></div>
      {/if}

      {#if hAsgn}
        <div class="mt-1.5 flex items-center justify-between text-[11px]">
          <span class="text-base-content/60">Active</span>
          <span class="font-mono font-medium text-success">
            {hAsgn.peripheral}_{hAsgn.signal} ({formatMuxLabel(hAsgn, muxModel)})
          </span>
        </div>
      {/if}

      {#if hLabel}
        <div class="mt-1 flex items-center justify-between text-[11px]">
          <span class="text-base-content/60">Label</span>
          <span class="font-mono text-info">{hLabel}</span>
        </div>
      {/if}

      {#if hPin.signals.length > 0}
        <div class="mt-2 pt-1.5 border-t border-base-300">
          <div class="text-[10px] font-medium text-base-content/60 mb-1">
            Mux options ({hPin.signals.length})
          </div>
          <div class="grid grid-cols-1 gap-0.5 max-h-[140px] overflow-hidden">
            {#each hPin.signals.slice(0, 10) as sig}
              <div class="flex items-center justify-between font-mono-tabular text-[11px]">
                <span class="text-foreground truncate">
                  {sig.peripheral}_{sig.signal}
                </span>
                <span class="text-base-content/60 ml-2 shrink-0">
                  {formatMuxLabel(sig, muxModel)}
                </span>
              </div>
            {/each}
            {#if hPin.signals.length > 10}
              <div class="text-[10px] text-base-content/60">
                +{hPin.signals.length - 10} more signals (click to inspect)
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="mt-1.5 text-[11px] text-base-content/60">
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
      x={popoverPos.x}
      y={popoverPos.y}
      onMeasure={(size) => {
        if (popoverSize.width !== size.width || popoverSize.height !== size.height) {
          popoverSize = size;
        }
      }}
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
      {chip}
      pin={contextMenu.pin}
      x={contextMenuPos.left}
      y={contextMenuPos.top}
      onMeasure={(size) => {
        if (contextSize.width !== size.width || contextSize.height !== size.height) {
          contextSize = size;
        }
      }}
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
