<script lang="ts">
  import { RotateCw, X } from 'lucide-svelte';
  import { normalizeAngle } from '../../core/placement';
  import {
    PLACEMENT_RINGS,
    type PinPlacementPreference,
    type PlacementRing,
  } from '../../core/types';

  /** One draggable peripheral indicator shown by the placement overlay. */
  export interface PlacementIndicator {
    name: string;
    preference: PinPlacementPreference | null;
    claimed: string[];
  }

  interface Props {
    stageEl: HTMLElement | null;
    centerX: number;
    centerY: number;
    radius: number;
    indicators: PlacementIndicator[];
    options: string[];
    selected: string | null;
    overlayRotation: number;
    onSelect: (name: string) => void;
    onAngle: (name: string, angle: number, ring: PlacementRing, commit: boolean) => void;
    onEnable: (name: string) => void;
    onRotate: () => void;
    onClose: () => void;
  }

  let {
    stageEl,
    centerX,
    centerY,
    radius,
    indicators,
    options,
    selected,
    overlayRotation,
    onSelect,
    onAngle,
    onEnable,
    onRotate,
    onClose,
  }: Props = $props();

  /** Display-only ring radii relative to the overlay radius, inner first. */
  const RING_FACTORS: Record<PlacementRing, number> = {
    inner: 0.5,
    middle: 0.72,
    outer: 0.98,
  };

  let dragTarget: Element | null = null;
  let dragPointerId = 0;
  let draggingName = $state<string | null>(null);
  let numericAngle = $state('0');

  const selectedIndicator = $derived(indicators.find((item) => item.name === selected) ?? null);
  const enabledNames = $derived(new Set(indicators.map((item) => item.name)));

  $effect(() => {
    const angle = selectedIndicator?.preference?.angle;
    if (angle !== undefined) numericAngle = String(Math.round(angle));
  });

  /** Draw at the stored angle plus the display-only rotation offset. */
  function pointFor(preference: PinPlacementPreference): { x: number; y: number } {
    const radians = ((preference.angle + overlayRotation) * Math.PI) / 180;
    const ringRadius = radius * RING_FACTORS[preference.ring];
    return {
      x: centerX + Math.cos(radians) * ringRadius,
      y: centerY - Math.sin(radians) * ringRadius,
    };
  }

  /** Convert a pointer position back to a stored package-coordinate angle. */
  function angleFromEvent(event: PointerEvent): number {
    const rect = stageEl?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0) - centerX;
    const y = centerY - (event.clientY - (rect?.top ?? 0));
    const degrees = (Math.atan2(y, x) * 180) / Math.PI;
    return normalizeAngle(degrees - overlayRotation);
  }

  /** Nearest ring to the pointer radius; rotation does not affect this choice. */
  function ringFromEvent(event: PointerEvent): PlacementRing {
    const rect = stageEl?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0) - centerX;
    const y = centerY - (event.clientY - (rect?.top ?? 0));
    const distance = Math.hypot(x, y);
    let nearest: PlacementRing = 'outer';
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const ring of PLACEMENT_RINGS) {
      const delta = Math.abs(distance - radius * RING_FACTORS[ring]);
      if (delta < bestDelta) {
        bestDelta = delta;
        nearest = ring;
      }
    }
    return nearest;
  }

  function startDrag(event: PointerEvent, name: string): void {
    event.preventDefault();
    event.stopPropagation();
    onSelect(name);
    draggingName = name;
    dragPointerId = event.pointerId;
    dragTarget = event.currentTarget as Element;
    dragTarget.setPointerCapture(event.pointerId);
  }

  function releaseDragCapture(): void {
    try {
      dragTarget?.releasePointerCapture(dragPointerId);
    } catch {
      // ignore when the pointer was not captured
    }
    dragTarget = null;
  }

  /** End a drag without committing a further angle or ring change. */
  function cancelActiveDrag(): void {
    draggingName = null;
    releaseDragCapture();
  }

  function moveDrag(event: PointerEvent): void {
    if (!draggingName) return;
    onAngle(draggingName, angleFromEvent(event), ringFromEvent(event), false);
  }

  function endDrag(event: PointerEvent): void {
    if (!draggingName) return;
    const name = draggingName;
    onAngle(name, angleFromEvent(event), ringFromEvent(event), true);
    cancelActiveDrag();
  }

  function cancelDrag(): void {
    cancelActiveDrag();
  }

  function handleNumberChange(): void {
    const name = selected;
    const preference = selectedIndicator?.preference;
    if (!name || !preference) return;
    const parsed = Number(numericAngle);
    if (!Number.isFinite(parsed)) {
      numericAngle = String(Math.round(preference.angle));
      return;
    }
    onAngle(name, parsed, preference.ring, true);
  }

  function handleIndicatorKey(event: KeyboardEvent, indicator: PlacementIndicator): void {
    if (event.key === 'Escape' && draggingName) {
      event.preventDefault();
      cancelActiveDrag();
      return;
    }
    const preference = indicator.preference;
    if (!preference) return;
    if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const current = PLACEMENT_RINGS.indexOf(preference.ring);
      const step = event.key === 'ArrowUp' ? -1 : 1;
      const next = Math.max(0, Math.min(PLACEMENT_RINGS.length - 1, current + step));
      onAngle(indicator.name, preference.angle, PLACEMENT_RINGS[next], true);
      return;
    }
    const delta = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0;
    if (delta === 0) return;
    event.preventDefault();
    onAngle(indicator.name, preference.angle + delta, preference.ring, true);
  }
</script>

<div class="absolute inset-0 z-10 pointer-events-none">
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={cancelDrag}
    role="presentation"
  >
    {#each PLACEMENT_RINGS as ring}
      <circle
        cx={centerX}
        cy={centerY}
        r={Math.max(1, radius * RING_FACTORS[ring])}
        class="fill-none stroke-current text-info opacity-40"
        stroke-dasharray={ring === 'outer' ? '5 4' : undefined}
      />
      <text
        x={centerX + 5}
        y={centerY - Math.max(1, radius * RING_FACTORS[ring]) - 4}
        class="fill-current text-info text-[10px]"
      >
        {ring}
      </text>
    {/each}

    {#each indicators as indicator (indicator.name)}
      {#if indicator.preference?.enabled}
        {@const point = pointFor(indicator.preference)}
        <g
          class="pointer-events-auto cursor-grab group"
          role="button"
          tabindex="0"
          aria-label={`Placement indicator for ${indicator.name}`}
          onpointerdown={(event) => startDrag(event, indicator.name)}
          onkeydown={(event) => handleIndicatorKey(event, indicator)}
        >
          <circle
            cx={point.x}
            cy={point.y}
            r="13"
            class="fill-none stroke-current text-info opacity-0 group-focus-visible:opacity-100"
            stroke-width="2"
          />
          <circle
            cx={point.x}
            cy={point.y}
            r={selected === indicator.name ? 11 : 9}
            class={selected === indicator.name
              ? 'fill-current text-info'
              : 'fill-current text-info'}
          />
          <text
            x={point.x + 13}
            y={point.y + 4}
            class="fill-current text-foreground font-mono text-[11px]"
          >
            {indicator.name} {Math.round(indicator.preference.angle)} deg
          </text>
        </g>
      {/if}
    {/each}
  </svg>

  <div
    class="card card-border pointer-events-auto absolute top-16 left-3 w-60 bg-base-100/95 p-2.5 space-y-2 text-xs shadow-sm"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium text-foreground">Placement affinity</span>
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          onclick={onRotate}
          title="Rotate overlay view"
          aria-label="Rotate overlay view"
          class="btn btn-ghost btn-xs btn-square"
        >
          <RotateCw class="size-3" />
        </button>
        <button
          type="button"
          onclick={onClose}
          title="Hide placement overlay"
          class="btn btn-ghost btn-xs btn-square"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>
    <p class="text-[11px] text-base-content/60 leading-relaxed">
      Inner ring has highest priority. Drag an indicator or enter an angle to bias pin allocation.
    </p>

    <label class="block space-y-1">
      <span class="text-[11px] text-base-content/60">Peripheral</span>
      <select
        value={selected ?? ''}
        onchange={(event) => onSelect((event.currentTarget as HTMLSelectElement).value)}
        class="select select-xs w-full"
      >
        <option value="" disabled>Select peripheral</option>
        {#each options as option (option)}
          <option value={option}>{option}{enabledNames.has(option) ? '' : ' (off)'}</option>
        {/each}
      </select>
    </label>

    {#if selected}
      {#if selectedIndicator?.preference?.enabled}
        <label class="block space-y-1">
          <span class="text-[11px] text-base-content/60">Angle (package coordinates)</span>
          <input
            bind:value={numericAngle}
            type="number"
            min="0"
            max="359"
            step="1"
            onchange={handleNumberChange}
            class="input input-xs w-full font-mono-tabular"
          />
        </label>
        <div class="text-[11px] text-base-content/60 font-mono break-words">
          Claimed: {selectedIndicator.claimed.join(', ') || 'none'}
        </div>
      {:else}
        <button
          type="button"
          onclick={() => onEnable(selected)}
          class="btn btn-sm btn-primary w-full font-medium"
        >
          Enable {selected}
        </button>
      {/if}
    {/if}
  </div>
</div>
