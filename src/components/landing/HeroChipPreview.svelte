<script lang="ts">
  import { ArrowUpRight, RotateCcw } from 'lucide-svelte';
  import { cloneWorkspaceState } from '../../core/history';
  import {
    allocatePeripheralMode,
    createEmptyWorkspace,
    evaluateWorkspace,
    pinSupportsSignal,
  } from '../../core/solver';
  import type { ChipData, PinAssignment, PinInfo, WorkspaceState } from '../../core/types';
  import PerimeterPackage from '../workspace/PerimeterPackage.svelte';
  import PinPopover from '../workspace/PinPopover.svelte';

  interface Props {
    chip: ChipData;
    demoState: WorkspaceState;
    onOpenWorkspace: (state: WorkspaceState) => void;
  }

  let { chip, demoState = $bindable(), onOpenWorkspace }: Props = $props();

  let hoveredPin = $state<PinInfo | null>(null);
  let popover = $state<{ pin: PinInfo; x: number; y: number } | null>(null);

  const report = $derived(evaluateWorkspace(chip, demoState));

  export function buildInitialHeroState(c: ChipData): WorkspaceState {
    let s = createEmptyWorkspace(c.id);
    s = allocatePeripheralMode(c, s, 'SYS', 'swd').state;
    s = allocatePeripheralMode(c, s, 'SPI1', 'full_duplex').state;
    s = allocatePeripheralMode(c, s, 'USART2', 'async').state;
    s = allocatePeripheralMode(c, s, 'TIM1', 'pwm_3phase_comp').state;

    // Add realistic engineering net labels for the demo
    for (const [pos, asgn] of Object.entries(s.assignments)) {
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'SCK') s.labels[pos] = 'IMU_CLK';
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'MISO') s.labels[pos] = 'IMU_MISO';
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'MOSI') s.labels[pos] = 'IMU_MOSI';
      if (asgn.peripheral === 'USART2' && asgn.signal === 'TX') s.labels[pos] = 'DBG_TX';
      if (asgn.peripheral === 'USART2' && asgn.signal === 'RX') s.labels[pos] = 'DBG_RX';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH1') s.labels[pos] = 'MOTOR_UH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH1N') s.labels[pos] = 'MOTOR_UL';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH2') s.labels[pos] = 'MOTOR_VH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH2N') s.labels[pos] = 'MOTOR_VL';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH3') s.labels[pos] = 'MOTOR_WH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH3N') s.labels[pos] = 'MOTOR_WL';
    }
    return s;
  }

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

<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121722] overflow-hidden flex flex-col">
  <!-- Top Interactive Control Bar -->
  <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e131d]">
    <div class="flex items-center gap-2 text-xs font-mono-tabular">
      <span class="font-semibold text-slate-900 dark:text-slate-100">{chip.id}</span>
      <span class="text-slate-400">·</span>
      <span class="text-slate-500 dark:text-slate-400">{chip.package.name}</span>
      <span class="text-slate-400">·</span>
      <span class="text-emerald-600 dark:text-emerald-400">
        {Object.keys(demoState.assignments).length} pins assigned
      </span>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        onclick={resetDemo}
        title="Reset hero demo pinout"
        class="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
      >
        <RotateCcw class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={() => onOpenWorkspace(demoState)}
        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white whitespace-nowrap transition-colors"
      >
        <span>Open in Full Workspace</span>
        <ArrowUpRight class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Quick Peripheral Toggles -->
  <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-slate-500 dark:text-slate-400 text-[11px] mr-0.5">Live modes:</span>
      {#each [
        { p: 'SYS', m: 'swd', label: 'SWD' },
        { p: 'SPI1', m: 'full_duplex', label: 'SPI1' },
        { p: 'USART2', m: 'async', label: 'USART2' },
        { p: 'TIM1', m: 'pwm_3phase_comp', label: 'TIM1 3-Ph PWM' },
      ] as item}
        {@const active = demoState.peripheralModes[item.p] === item.m}
        <button
          type="button"
          onclick={() => handleToggleDemoPeripheral(item.p, item.m)}
          class={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors border ${
            active
              ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-700 dark:text-emerald-300 font-medium'
              : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {item.label}
        </button>
      {/each}
    </div>
    <span class="text-[11px] text-slate-400 dark:text-slate-500">Click any pin to edit</span>
  </div>

  <!-- Live Interactive SVG Chip -->
  <div class="relative bg-[#f8fafc] dark:bg-[#0b0e14] bg-dot-grid flex items-center justify-center p-3 overflow-hidden min-h-[380px]">
    <div class="w-full max-w-[540px] flex items-center justify-center">
      <div class="w-full [&_svg]:w-full [&_svg]:h-auto">
        <PerimeterPackage
          {chip}
          assignments={demoState.assignments}
          labels={demoState.labels}
          locked={demoState.locked}
          pinStatus={report.pinStatus}
          compact={true}
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
  <div class="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e131d] text-[11px] font-mono-tabular flex items-center justify-between gap-3 min-h-[34px]">
    {#if hoveredPin}
      {@const hAsgn = demoState.assignments[hoveredPin.pos]}
      <div class="flex items-center gap-2 min-w-0 truncate">
        <span class="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
          Pin {hoveredPin.pos} ({hoveredPin.name})
        </span>
        <span class="text-slate-400">·</span>
        {#if hAsgn}
          <span class="text-emerald-600 dark:text-emerald-400 shrink-0">
            {hAsgn.peripheral}_{hAsgn.signal}{hAsgn.af !== null ? ` AF${hAsgn.af}` : ''}
          </span>
          <span class="text-slate-400">·</span>
        {/if}
        <span class="text-slate-500 dark:text-slate-400 truncate">
          {hoveredPin.signals.length > 0
            ? hoveredPin.signals
                .slice(0, 4)
                .map((s) => `${s.peripheral}_${s.signal}`)
                .join(', ') + (hoveredPin.signals.length > 4 ? ` +${hoveredPin.signals.length - 4}` : '')
            : `Dedicated ${hoveredPin.type} pin`}
        </span>
      </div>
    {:else}
      <span class="text-slate-500 dark:text-slate-400">
        Hover any pin to inspect alternate functions, or click a pin to assign a signal.
      </span>
    {/if}
    {#if report.warningCount > 0 || report.errorCount > 0}
      <span class="shrink-0 text-orange-500">
        {report.errorCount}E / {report.warningCount}W
      </span>
    {:else}
      <span class="shrink-0 text-emerald-600 dark:text-emerald-400">0 conflicts</span>
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
