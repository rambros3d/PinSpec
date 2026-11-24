<script lang="ts">
  import { X } from 'lucide-svelte';
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
    selected: string | null;
    onSelect: (name: string) => void;
    onAngle: (name: string, angle: number, commit: boolean) => void;
    onRing: (name: string, ring: PlacementRing) => void;
    onEnable: (name: string) => void;
    onClose: () => void;
  }

  let {
    stageEl,
    centerX,
    centerY,
    radius,
    indicators,
    selected,
    onSelect,
    onAngle,
    onRing,
    onEnable,
    onClose,
  }: Props = $props();

  const RING_FACTORS: Record<PlacementRing, number> = {
    inner: 0.34,
    middle: 0.66,
    outer: 0.96,
  };

  let dragTarget: Element | null = null;
  let draggingName = $state<string | null>(null);
  let numericAngle = $state('0');

  const selectedIndicator = $derived(indicators.find((item) => item.name === selected) ?? null);

  $effect(() => {
    const angle = selectedIndicator?.preference?.angle;
    if (angle !== undefined) numericAngle = String(Math.round(angle));
  });

  function pointFor(preference: PinPlacementPreference): { x: number; y: number } {
    const radians = (preference.angle * Math.PI) / 180;
    const ringRadius = radius * RING_FACTORS[preference.ring];
    return {
      x: centerX + Math.cos(radians) * ringRadius,
      y: centerY - Math.sin(radians) * ringRadius,
    };
  }

  function angleFromEvent(event: PointerEvent): number {
    const rect = stageEl?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0) - centerX;
    const y = centerY - (event.clientY - (rect?.top ?? 0));
    const degrees = (Math.atan2(y, x) * 180) / Math.PI;
    return ((degrees % 360) + 360) % 360;
  }

  function startDrag(event: PointerEvent, name: string): void {
    event.preventDefault();
    event.stopPropagation();
    onSelect(name);
    draggingName = name;
    dragTarget = event.currentTarget as Element;
    dragTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent): void {
    if (!draggingName) return;
    onAngle(draggingName, angleFromEvent(event), false);
  }

  function endDrag(event: PointerEvent): void {
    if (!draggingName) return;
    const name = draggingName;
    onAngle(name, angleFromEvent(event), true);
    draggingName = null;
    try {
      dragTarget?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore when the pointer was not captured
    }
    dragTarget = null;
  }

  function cancelDrag(): void {
    draggingName = null;
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
    onAngle(name, parsed, true);
  }

  function handleRingChange(event: Event): void {
    const name = selected;
    if (!name) return;
    const ring = (event.currentTarget as HTMLSelectElement).value as PlacementRing;
    onRing(name, ring);
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
        class="fill-none stroke-current text-hint opacity-40"
        stroke-dasharray={ring === 'outer' ? '5 4' : undefined}
      />
      <text
        x={centerX + 5}
        y={centerY - Math.max(1, radius * RING_FACTORS[ring]) - 4}
        class="fill-current text-hint text-[10px]"
      >
        {ring}
      </text>
    {/each}

    {#each indicators as indicator (indicator.name)}
      {#if indicator.preference?.enabled}
        {@const point = pointFor(indicator.preference)}
        <g
          class="pointer-events-auto cursor-grab"
          role="button"
          tabindex="0"
          aria-label={`Placement indicator for ${indicator.name}`}
          onpointerdown={(event) => startDrag(event, indicator.name)}
          onkeydown={(event) => {
            const delta = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0;
            if (delta === 0) return;
            event.preventDefault();
            onAngle(
              indicator.name,
              indicator.preference!.angle + delta,
              true,
            );
          }}
        >
          <circle
            cx={point.x}
            cy={point.y}
            r={selected === indicator.name ? 11 : 9}
            class={selected === indicator.name
              ? 'fill-current text-pin-remap'
              : 'fill-current text-hint'}
          />
          <text
            x={point.x + 13}
            y={point.y + 4}
            class="fill-current text-primary font-mono text-[11px]"
          >
            {indicator.name} {Math.round(indicator.preference.angle)} deg
          </text>
        </g>
      {/if}
    {/each}
  </svg>

  <div
    class="pointer-events-auto absolute top-16 left-3 w-60 rounded-panel border-ui border-hairline bg-surface-alpha p-2.5 space-y-2 text-xs shadow-sm"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium text-primary">Placement affinity</span>
      <button
        type="button"
        onclick={onClose}
        title="Hide placement overlay"
        class="p-0.5 rounded-control hover:bg-elevated text-muted"
      >
        <X class="size-ui-sm" />
      </button>
    </div>
    <p class="text-[11px] text-muted leading-relaxed">
      Inner ring has highest priority. Drag an indicator or enter an angle to bias pin allocation.
    </p>

    <label class="block space-y-1">
      <span class="text-[11px] text-muted">Peripheral</span>
      <select
        value={selected ?? ''}
        onchange={(event) => onSelect((event.currentTarget as HTMLSelectElement).value)}
        class="w-full px-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
      >
        <option value="" disabled>Select peripheral</option>
        {#each indicators as indicator (indicator.name)}
          <option value={indicator.name}>
            {indicator.name}{indicator.preference?.enabled ? '' : ' (off)'}
          </option>
        {/each}
      </select>
    </label>

    {#if selectedIndicator}
      {#if selectedIndicator.preference?.enabled}
        <div class="flex items-center gap-2">
          <label class="flex-1 space-y-1">
            <span class="text-[11px] text-muted">Ring</span>
            <select
              value={selectedIndicator.preference.ring}
              onchange={handleRingChange}
              class="w-full px-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
            >
              {#each PLACEMENT_RINGS as ring}
                <option value={ring}>{ring}</option>
              {/each}
            </select>
          </label>
          <label class="w-20 space-y-1">
            <span class="text-[11px] text-muted">Angle</span>
            <input
              bind:value={numericAngle}
              type="number"
              min="0"
              max="359"
              step="1"
              onchange={handleNumberChange}
              class="w-full px-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs font-mono-tabular text-primary focus:outline-none focus:border-hint"
            />
          </label>
        </div>
        <div class="text-[11px] text-muted font-mono break-words">
          Claimed: {selectedIndicator.claimed.join(', ') || 'none'}
        </div>
      {:else}
        <button
          type="button"
          onclick={() => onEnable(selectedIndicator.name)}
          class="w-full px-2 py-1 rounded-control bg-action hover:bg-action-hover text-on-action font-medium text-[11px]"
        >
          Enable {selectedIndicator.name}
        </button>
      {/if}
    {/if}
  </div>
</div>
