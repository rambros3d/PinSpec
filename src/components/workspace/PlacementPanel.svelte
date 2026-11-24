<script lang="ts">
  /**
   * Place section of the combined sidebar. Lists configured peripherals and
   * edits their placement bubbles through the shared workspace placement path.
   * The overlay ON/OFF control stays on the canvas.
   */
  import { Crosshair } from 'lucide-svelte';
  import {
    configuredPeripheralNames,
    normalizeAngle,
    normalizePlacement,
    type PlacementIndicator,
  } from '../../core/placement';
  import {
    PLACEMENT_RING_LABELS,
    PLACEMENT_RINGS,
    type ChipData,
    type PeripheralStatus,
    type PinAssignment,
    type PlacementRing,
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

  const placementSettings = $derived(normalizePlacement(workspaceStore.state));
  const configuredNames = $derived(
    configuredPeripheralNames(chip, peripheralStatus, peripheralModes, assignments),
  );
  const pinNames = $derived(new Map(chip.pins.map((pin) => [pin.pos, pin.name])));

  const indicators = $derived.by<PlacementIndicator[]>(() =>
    configuredNames.map((name) => ({
      name,
      preference: placementSettings.preferences[name] ?? null,
      claimed: Object.entries(assignments)
        .filter(([, asgn]) => asgn.peripheral === name)
        .map(([pos]) => pos),
    })),
  );

  function toggleBubble(name: string, enabled: boolean): void {
    workspaceStore.setPlacement(
      name,
      enabled ? { angle: 0, ring: 'low', enabled: true } : null,
    );
    if (enabled) placementSelection.select(name);
  }

  function updateAngle(name: string, raw: string, commit: boolean): void {
    const preference = placementSettings.preferences[name];
    if (!preference?.enabled) return;
    const angle = Number(raw);
    if (!Number.isFinite(angle)) return;
    const next = { ...preference, angle: normalizeAngle(angle) };
    if (commit) workspaceStore.commitPlacement(name, next);
    else workspaceStore.previewPlacement(name, next);
  }

  function updateRing(name: string, ring: PlacementRing): void {
    const preference = placementSettings.preferences[name];
    if (!preference?.enabled) return;
    workspaceStore.commitPlacement(name, { ...preference, ring });
  }
</script>

<div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 text-xs">
  <div class="flex items-center gap-1.5 text-foreground">
    <Crosshair class="size-3.5" />
    <span class="font-medium">Placement affinity</span>
  </div>

  {#if !placementSettings.overlayVisible}
    <div class="card card-border bg-base-200 p-2.5 space-y-1">
      <p class="font-medium text-foreground">Placement is off</p>
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        Use the Placement control at the bottom of the canvas to show the priority rings before
        editing bubbles.
      </p>
    </div>
  {:else if indicators.length === 0}
    <div class="card card-border bg-base-200 p-2.5 space-y-1">
      <p class="font-medium text-foreground">No configured peripherals</p>
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        Configure a mode or assign a signal to a peripheral before giving it a placement bubble.
      </p>
    </div>
  {:else}
    <p class="text-[11px] text-base-content/60 leading-relaxed">
      High has the highest priority. Moving a bubble between rings reallocates its pins; locked pins
      keep their assignments.
    </p>

    {#each indicators as indicator (indicator.name)}
      {@const preference = indicator.preference}
      <div
        class={`card card-border p-2.5 space-y-2 ${
          placementSelection.selected === indicator.name ? 'bg-base-200' : 'bg-base-100'
        }`}
      >
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            onclick={() => placementSelection.select(indicator.name)}
            class="btn btn-link btn-xs font-mono p-0"
          >
            {indicator.name}
          </button>
          <label class="flex items-center gap-1.5 text-[11px] text-base-content/60 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(preference?.enabled)}
              onchange={(e) => toggleBubble(indicator.name, e.currentTarget.checked)}
              class="checkbox checkbox-xs"
              aria-label={`Enable placement bubble for ${indicator.name}`}
            />
            Bubble
          </label>
        </div>

        {#if preference?.enabled}
          <div class="grid grid-cols-2 gap-2">
            <label class="block space-y-1">
              <span class="text-[11px] text-base-content/60">Angle</span>
              <input
                type="number"
                min="0"
                max="359"
                step="1"
                value={Math.round(preference.angle)}
                oninput={(e) => updateAngle(indicator.name, e.currentTarget.value, false)}
                onchange={(e) => updateAngle(indicator.name, e.currentTarget.value, true)}
                class="input input-xs w-full font-mono-tabular"
                aria-label={`Placement angle for ${indicator.name}`}
              />
            </label>
            <label class="block space-y-1">
              <span class="text-[11px] text-base-content/60">Priority ring</span>
              <select
                value={preference.ring}
                onchange={(e) =>
                  updateRing(indicator.name, e.currentTarget.value as PlacementRing)}
                class="select select-xs w-full"
                aria-label={`Priority ring for ${indicator.name}`}
              >
                {#each PLACEMENT_RINGS as ring (ring)}
                  <option value={ring}>{PLACEMENT_RING_LABELS[ring]}</option>
                {/each}
              </select>
            </label>
          </div>
        {/if}

        <div class="text-[11px] text-base-content/60 font-mono break-words">
          Claimed: {indicator.claimed.map((pos) => pinNames.get(pos) ?? pos).join(', ') || 'none'}
        </div>
      </div>
    {/each}
  {/if}
</div>
