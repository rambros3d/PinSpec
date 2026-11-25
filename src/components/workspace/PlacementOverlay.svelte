<script lang="ts">
  /**
   * Canvas-only placement rings and draggable indicators. Per-peripheral
   * bubble enable/disable is edited in the right-drawer Placement tab; only
   * interaction with the rings and indicators happens here.
   */
  import {
    PLACEMENT_RINGS,
    PLACEMENT_RING_LABELS,
    type PinPlacementPreference,
    type PlacementRing,
  } from '../../core/types';
  import { normalizeAngle, type PlacementIndicator } from '../../core/placement';

  interface Props {
    stageEl: HTMLElement | null;
    centerX: number;
    centerY: number;
    radius: number;
    indicators: PlacementIndicator[];
    selected: string | null;
    overlayRotation: number;
    onSelect: (name: string) => void;
    onAngle: (name: string, angle: number, ring: PlacementRing, commit: boolean) => void;
  }

  let {
    stageEl,
    centerX,
    centerY,
    radius,
    indicators,
    selected,
    overlayRotation,
    onSelect,
    onAngle,
  }: Props = $props();

  /** Display-only ring radii relative to the safe outer radius, high first. */
  const RING_FACTORS: Record<PlacementRing, number> = {
    high: 0.8,
    medium: 0.89,
    low: 0.98,
  };

  let dragTarget: Element | null = null;
  let dragPointerId = 0;
  let draggingName = $state<string | null>(null);

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
    let nearest: PlacementRing = 'low';
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
    {#each PLACEMENT_RINGS as ring (ring)}
      <circle
        cx={centerX}
        cy={centerY}
        r={Math.max(1, radius * RING_FACTORS[ring])}
        class="fill-none stroke-current text-info opacity-40"
        stroke-dasharray={ring === 'low' ? '5 4' : undefined}
      />
      <text
        x={centerX + 5}
        y={centerY - Math.max(1, radius * RING_FACTORS[ring]) - 4}
        class="fill-current text-info text-[10px]"
      >
        {PLACEMENT_RING_LABELS[ring]}
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
            class="fill-current text-info"
          />
          <text
            x={point.x + 13}
            y={point.y + 4}
            class="fill-current text-foreground font-mono text-[11px]"
          >
            {indicator.name}
          </text>
        </g>
      {/if}
    {/each}
  </svg>
</div>
