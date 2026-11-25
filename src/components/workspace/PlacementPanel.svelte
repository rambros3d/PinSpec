<script lang="ts">
  /**
   * Placement tab body in the right summary drawer and portrait dock. Lists
   * only configured peripherals and toggles their placement bubble. Angle and
   * ring are adjusted by dragging bubbles on the canvas rings, so this panel
   * has no numeric or ring controls and no overlay ON/OFF control.
   */
  import {
    configuredPeripheralNames,
    normalizePlacement,
  } from '../../core/placement';
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
  }

  let { chip, peripheralStatus, peripheralModes, assignments }: Props = $props();

  const preferences = $derived(normalizePlacement(workspaceStore.state).preferences);
  const configuredNames = $derived(
    configuredPeripheralNames(chip, peripheralStatus, peripheralModes, assignments),
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
  <p class="text-[11px] text-base-content/60 leading-relaxed">
    Enable a bubble to give this peripheral a preferred pin region. Drag the bubble on the canvas
    rings to change its angle and priority; locked pins keep their assignments.
  </p>

  {#if configuredNames.length === 0}
    <div class="card card-border bg-base-200 p-2.5 space-y-1">
      <p class="font-medium text-foreground">No configured peripherals</p>
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        Configure a mode or assign a signal to a peripheral before giving it a placement bubble.
      </p>
    </div>
  {:else}
    <div class="card card-border bg-base-100 divide-y divide-base-300">
      {#each configuredNames as name (name)}
        <label class="flex items-center justify-between gap-2 p-2.5 cursor-pointer">
          <span class="font-mono text-foreground truncate">{name}</span>
          <input
            type="checkbox"
            checked={Boolean(preferences[name]?.enabled)}
            onchange={(e) => toggleBubble(name, e.currentTarget.checked)}
            class="toggle toggle-xs toggle-primary shrink-0"
            aria-label={`Enable placement bubble for ${name}`}
          />
        </label>
      {/each}
    </div>
  {/if}
</div>
