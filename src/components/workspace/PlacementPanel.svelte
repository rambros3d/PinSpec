<script lang="ts">
  /**
   * Placement tab body in the right summary drawer and portrait dock. Lists
   * only configured peripherals and toggles their placement bubble. Angle and
   * ring are adjusted by dragging bubbles on the canvas rings; the header
   * rotates those bubbles relative to the IC without rotating the package.
   */
  import RotateCw from '@solar-icons/svelte/bold-duotone/rotate-clockwise';
  import {
    configuredPeripheralNames,
    normalizeAngle,
    normalizePlacement,
  } from '../../core/placement';
  import { classifyPlacementEligibility } from '../../core/placement-eligibility';
  import type {
    ChipData,
    PeripheralStatus,
    PinAssignment,
  } from '../../core/types';
  import { placementSelection } from '../../state/placement-selection.svelte';
  import { workspaceStore } from '../../state/workspace.svelte';

  interface Props {
    chip: ChipData;
    peripheralStatus: Record<string, PeripheralStatus>;
    peripheralModes: Record<string, string>;
    assignments: Record<string, PinAssignment>;
    locked: Record<string, boolean>;
  }

  let { chip, peripheralStatus, peripheralModes, assignments, locked }: Props = $props();

  const preferences = $derived(normalizePlacement(workspaceStore.state).preferences);
  // Ineligible rows are hidden; their stored preferences are left untouched so
  // they reappear when a pin becomes movable again.
  const eligibleRows = $derived(
    classifyPlacementEligibility(
      chip,
      assignments,
      locked,
      configuredPeripheralNames(chip, peripheralStatus, peripheralModes, assignments),
    ).filter((row) => row.status !== 'ineligible'),
  );
  const overlayRotation = $derived(
    normalizeAngle(workspaceStore.state.placementOverlayRotation ?? 0),
  );
  const rotationEnabled = $derived(
    eligibleRows.some((row) => Boolean(preferences[row.name]?.enabled)),
  );

  function toggleBubble(name: string, enabled: boolean): void {
    workspaceStore.setPlacement(
      name,
      enabled ? { angle: 0, ring: 'low', enabled: true } : null,
    );
    if (enabled) placementSelection.select(name);
  }
</script>

<div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 text-xs">
  <div class="flex items-center justify-between gap-2">
    <span class="font-medium text-foreground">Placement bubbles</span>
    <button
      type="button"
      onclick={() => workspaceStore.setPlacementOverlayRotation(overlayRotation + 90)}
      disabled={!rotationEnabled}
      title={rotationEnabled
        ? 'Rotate placement bubbles 90 degrees relative to the IC; the package rotation is unchanged'
        : 'Enable a placement bubble to rotate bubbles relative to the IC'}
      aria-label="Rotate placements 90 degrees relative to the IC; the package rotation is unchanged"
      class="btn btn-ghost btn-sm gap-1"
    >
      <RotateCw class="size-3.5" />
      <span>Rotate placements</span>
    </button>
  </div>
  <p class="text-[11px] text-base-content/60 leading-relaxed">
    Enable a bubble to give this peripheral a preferred pin region. Drag the bubble on the canvas
    rings to change its angle and priority; locked pins keep their assignments.
  </p>

  {#if eligibleRows.length === 0}
    <div class="card card-border bg-base-200 p-2.5 space-y-1">
      <p class="font-medium text-foreground">No reassignable peripherals</p>
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        No configured peripheral has a reassignable pin. Configure a mode, assign a signal, or
        unlock a pin before giving it a placement bubble.
      </p>
    </div>
  {:else}
    <div class="card card-border bg-base-100 divide-y divide-base-300">
      {#each eligibleRows as row (row.name)}
        <label
          class="flex items-center justify-between gap-2 p-2.5 {row.status === 'locked-only'
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer'}"
          title={row.status === 'locked-only' ? row.reason : undefined}
        >
          <span class="font-mono text-foreground truncate">{row.name}</span>
          <input
            type="checkbox"
            checked={Boolean(preferences[row.name]?.enabled)}
            disabled={row.status === 'locked-only'}
            onchange={(e) => toggleBubble(row.name, e.currentTarget.checked)}
            class="toggle toggle-xs toggle-primary shrink-0"
            title={row.status === 'locked-only' ? row.reason : undefined}
            aria-label={row.status === 'locked-only'
              ? `Placement bubble unavailable for ${row.name}: ${row.reason}`
              : `Enable placement bubble for ${row.name}`}
          />
        </label>
      {/each}
    </div>
  {/if}
</div>
