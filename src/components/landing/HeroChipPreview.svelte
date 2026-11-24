<script lang="ts">
  import { ArrowUpRight, RotateCcw } from 'lucide-svelte';
  import { buildHeroDemoState } from '../../core/hero-demo';
  import { cloneWorkspaceState } from '../../core/history';
  import {
    allocatePeripheralMode,
    evaluateWorkspace,
    pinSupportsSignal,
  } from '../../core/solver';
  import {
    formatMuxLabel,
    getChipMuxModel,
    type ChipData,
    type PinAssignment,
    type PinInfo,
    type VendorId,
    type WorkspaceState,
  } from '../../core/types';
  import { HERO_CHIPS } from '../../core/vendor-view';
  import PerimeterPackage from '../workspace/PerimeterPackage.svelte';
  import PinPopover from '../workspace/PinPopover.svelte';

  interface Props {
    chip: ChipData;
    vendor: VendorId;
    demoState: WorkspaceState;
    onVendorChange: (vendor: VendorId) => void;
    onOpenWorkspace: (state: WorkspaceState) => void;
  }

  let {
    chip,
    vendor,
    demoState = $bindable(),
    onVendorChange,
    onOpenWorkspace,
  }: Props = $props();

  let hoveredPin = $state<PinInfo | null>(null);
  let popover = $state<{ pin: PinInfo; x: number; y: number } | null>(null);

  const report = $derived(evaluateWorkspace(chip, demoState));

  const muxModel = $derived(getChipMuxModel(chip));

  /** Demo state is derived from the active chip's available peripherals. */
  export function buildInitialHeroState(c: ChipData): WorkspaceState {
    return buildHeroDemoState(c);
  }

  const activeModes = $derived(
    Object.entries(demoState.peripheralModes)
      .filter(([, mode]) => mode && mode !== 'disabled')
      .map(([peripheral, mode]) => ({ peripheral, mode })),
  );

  function handleToggleDemoPeripheral(periph: string, modeId: string): void {
    const active = demoState.peripheralModes[periph] === modeId;
    demoState = allocatePeripheralMode(
      chip,
      demoState,
      periph,
      active ? 'disabled' : modeId,
    ).state;
  }

  function handleAssign(pos: string, asgn: PinAssignment): void {
    const pin = chip.pins.find((p) => p.pos === pos);
    if (!pin || pin.type !== 'io') return;
    const match = pinSupportsSignal(pin, asgn.peripheral, asgn.signal);
    if (!match) return;
    const next = cloneWorkspaceState(demoState);
    next.assignments[pos] = {
      ...asgn,
      ...match,
      peripheral: asgn.peripheral,
      signal: match.signal,
      af: match.af,
    };
    demoState = next;
  }

  function handleClear(pos: string): void {
    const next = cloneWorkspaceState(demoState);
    delete next.assignments[pos];
    demoState = next;
  }

  function handleToggleLock(pos: string): void {
    const next = cloneWorkspaceState(demoState);
    if (next.locked[pos]) delete next.locked[pos];
    else next.locked[pos] = true;
    demoState = next;
  }

  function resetDemo(): void {
    demoState = buildInitialHeroState(chip);
  }
</script>

<div class="card card-border bg-base-100 overflow-hidden flex flex-col">
  <!-- Vendor switcher: each chip is fetched from generated data on demand -->
  <div class="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-base-300 bg-base-200 text-xs">
    <span class="text-base-content/60 mr-1">Preview:</span>
    {#each HERO_CHIPS as hero (hero.vendor)}
      <button
        type="button"
        onclick={() => onVendorChange(hero.vendor)}
        title={hero.id}
        class={`btn btn-sm font-mono ${
          vendor === hero.vendor ? 'btn-primary' : 'btn-outline'
        }`}
      >
        {hero.label}
      </button>
    {/each}
  </div>

  <!-- Top Interactive Control Bar -->
  <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-base-300 bg-base-200">
    <div class="flex items-center gap-2 text-xs font-mono-tabular">
      <span class="font-semibold text-foreground">{chip.id}</span>
      <span class="text-base-content/40">·</span>
      <span class="text-base-content/60">{chip.package.name}</span>
      <span class="text-base-content/40">·</span>
      <span class="text-success">
        {Object.keys(demoState.assignments).length} pins assigned
      </span>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        onclick={resetDemo}
        title="Reset hero demo pinout"
        class="btn btn-ghost btn-sm btn-square"
      >
        <RotateCcw class="size-3.5" />
      </button>
      <button
        type="button"
        onclick={() => onOpenWorkspace(demoState)}
        class="btn btn-sm btn-primary gap-1 text-xs font-semibold whitespace-nowrap"
      >
        <span>Open in Full Workspace</span>
        <ArrowUpRight class="size-3.5" />
      </button>
    </div>
  </div>

  <!-- Quick Peripheral Toggles -->
  <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-base-300 text-xs">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-base-content/60 text-[11px] mr-0.5">Live modes:</span>
      {#each activeModes as item (`${item.peripheral}:${item.mode}`)}
        <button
          type="button"
          onclick={() => handleToggleDemoPeripheral(item.peripheral, item.mode)}
          title={`Disable ${item.peripheral} (${item.mode})`}
          class="btn btn-xs btn-success font-mono text-[11px]"
        >
          {item.peripheral} · {item.mode}
        </button>
      {/each}
    </div>
    <span class="text-[11px] text-base-content/40">Click any pin to edit</span>
  </div>

  <!-- Live Interactive SVG Chip -->
  <div class="relative bg-base-200 bg-dot-grid flex items-center justify-center p-3 overflow-hidden min-h-[380px]">
    <div class="w-full max-w-[540px] flex items-center justify-center">
      <div class="w-full [&_svg]:w-full [&_svg]:h-auto">
        <PerimeterPackage
          {chip}
          assignments={demoState.assignments}
          labels={demoState.labels}
          locked={demoState.locked}
          pinStatus={report.pinStatus}
          compact={true}
          muxModel={muxModel}
          selectedPinPos={popover?.pin.pos ?? null}
          onPinClick={(pin, e) => {
            if (pin.type === 'io') {
              popover = { pin, x: e.clientX, y: e.clientY };
            }
          }}
          onPinHover={(pin) => (hoveredPin = pin)}
        />
      </div>
    </div>
  </div>

  <!-- Live Hover Inspector Bar -->
  <div class="px-4 py-2 border-t border-base-300 bg-base-200 text-[11px] font-mono-tabular flex items-center justify-between gap-3 min-h-[34px]">
    {#if hoveredPin}
      {@const hAsgn = demoState.assignments[hoveredPin.pos]}
      <div class="flex items-center gap-2 min-w-0 truncate">
        <span class="font-semibold text-foreground shrink-0">
          Pin {hoveredPin.pos} ({hoveredPin.name})
        </span>
        <span class="text-base-content/40">·</span>
        {#if hAsgn}
          <span class="text-success shrink-0">
            {hAsgn.peripheral}_{hAsgn.signal} [{formatMuxLabel(hAsgn, muxModel)}]
          </span>
          <span class="text-base-content/40">·</span>
        {/if}
        <span class="text-base-content/60 truncate">
          {hoveredPin.signals.length > 0
            ? hoveredPin.signals
                .slice(0, 4)
                .map((s) => `${s.peripheral}_${s.signal} (${formatMuxLabel(s, muxModel)})`)
                .join(', ') + (hoveredPin.signals.length > 4 ? ` +${hoveredPin.signals.length - 4}` : '')
            : `Dedicated ${hoveredPin.type} pin`}
        </span>
      </div>
    {:else}
      <span class="text-base-content/60">
        Hover any pin to inspect alternate functions, or click a pin to assign a signal.
      </span>
    {/if}
    {#if report.warningCount > 0 || report.errorCount > 0}
      <span class="shrink-0 text-warning">
        {report.errorCount}E / {report.warningCount}W
      </span>
    {:else}
      <span class="shrink-0 text-success">0 conflicts</span>
    {/if}
  </div>

  {#if popover}
    <PinPopover
      {chip}
      pin={popover.pin}
      x={popover.x}
      y={popover.y}
      currentAssignment={demoState.assignments[popover.pin.pos]}
      currentLabel={demoState.labels[popover.pin.pos] ?? ''}
      isLocked={Boolean(demoState.locked[popover.pin.pos])}
      allAssignments={demoState.assignments}
      onAssign={(asgn) => handleAssign(popover!.pin.pos, asgn)}
      onClear={() => handleClear(popover!.pin.pos)}
      onToggleLock={() => handleToggleLock(popover!.pin.pos)}
      onClose={() => (popover = null)}
    />
  {/if}
</div>
