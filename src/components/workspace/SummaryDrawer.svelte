<script lang="ts">
  import {
    AlertTriangle,
    ArrowUpDown,
    CheckCircle2,
    Lock,
    Search,
    Trash2,
    Unlock,
    Wrench,
    XCircle,
  } from 'lucide-svelte';
  import {
    formatMuxLabel,
    getChipMuxModel,
    GPIO_DRIVES,
    GPIO_OUTPUT_LEVELS,
    GPIO_PULLS,
    GPIO_SPEEDS,
    type ChipData,
    type DmaAnalysisEntry,
    type GpioConfig,
    type OneHopFix,
    type PeripheralStatus,
    type PinAssignment,
    type PioPinAssignment,
    type SolverReport,
    type SummaryTab,
  } from '../../core/types';
  import { deriveExtiLineId } from '../../core/solver';
  import { workspaceStore } from '../../state/workspace.svelte';
  import HardwareAuditPanel from './HardwareAuditPanel.svelte';
  import PioPanel from './PioPanel.svelte';
  import PinTagPills from './PinTagPills.svelte';
  import PlacementPanel from './PlacementPanel.svelte';

  export type SummaryDrawerTab = SummaryTab;

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    peripheralModes: Record<string, string>;
    peripheralStatus: Record<string, PeripheralStatus>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pioAssignments: Record<string, PioPinAssignment>;
    report: SolverReport;
    /** Selected tab, bound by the portrait dock so one instance serves both layouts. */
    activeTab?: SummaryDrawerTab;
    onFocusPin: (pos: string) => void;
    onSetLabel: (pos: string, label: string) => void;
    onToggleLock: (pos: string) => void;
    onClearPin: (pos: string) => void;
    onApplyFix: (fix: OneHopFix) => void;
    onSetPioAssignment: (pos: string, binding: PioPinAssignment | null) => void;
  }

  let {
    chip,
    assignments,
    peripheralModes,
    peripheralStatus,
    labels,
    locked,
    pioAssignments,
    report,
    activeTab = $bindable('pins'),
    onFocusPin,
    onSetLabel,
    onToggleLock,
    onClearPin,
    onApplyFix,
    onSetPioAssignment,
  }: Props = $props();

  let tableFilter = $state('');
  let sortKey = $state<'pos' | 'pin' | 'signal'>('pos');
  let sortAsc = $state(true);
  let inspectorPos = $state<string | null>(null);

  const DEFAULT_GPIO_CONFIG: GpioConfig = {
    outputLevel: 'Low',
    drive: 'PushPull',
    pull: 'None',
    speed: 'Medium',
  };

  const hasAssignments = $derived(Object.keys(assignments).length > 0);
  const pinMap = $derived(new Map(chip.pins.map((p) => [p.pos, p])));
  const inspectorPin = $derived(inspectorPos ? pinMap.get(inspectorPos) ?? null : null);
  const inspectorConfig = $derived(
    inspectorPos ? workspaceStore.state.gpioConfig?.[inspectorPos] ?? null : null,
  );

  $effect(() => {
    const pos = workspaceStore.focusPinRequest?.pos;
    if (pos) inspectorPos = pos;
  });

  function updateGpioConfig<K extends keyof GpioConfig>(key: K, value: GpioConfig[K]): void {
    if (!inspectorPos) return;
    const next: GpioConfig = { ...(inspectorConfig ?? DEFAULT_GPIO_CONFIG), [key]: value };
    workspaceStore.setGpioConfig(inspectorPos, next);
  }
  const muxModel = $derived(getChipMuxModel(chip));
  const showPio = $derived(Boolean(chip.pio));

  const rows = $derived.by(() => {
    const q = tableFilter.trim().toUpperCase();
    const list = Object.entries(assignments)
      .map(([pos, asgn]) => {
        const pin = pinMap.get(pos);
        const signalFull =
          asgn.peripheral === 'GPIO'
            ? `GPIO_${asgn.signal}`
            : `${asgn.peripheral}_${asgn.signal}`;
        return {
          pos,
          pinName: pin?.name ?? pos,
          signalFull,
          muxLabel: formatMuxLabel(asgn, muxModel),
          extiLine:
            asgn.peripheral === 'GPIO' && asgn.signal === 'EXTI'
              ? deriveExtiLineId(pin?.name ?? '')
              : null,
          bondedNames: pin?.bondedNames ?? [],
          tags: pin?.tags ?? [],
          label: labels[pos] ?? '',
          isLocked: Boolean(locked[pos]),
          status: report.pinStatus[pos] ?? 'assigned',
        };
      })
      .filter((r) => {
        if (!q) return true;
        return (
          r.pos.toUpperCase().includes(q) ||
          r.pinName.toUpperCase().includes(q) ||
          r.signalFull.toUpperCase().includes(q) ||
          r.muxLabel.toUpperCase().includes(q) ||
          (r.extiLine ?? '').toUpperCase().includes(q) ||
          r.label.toUpperCase().includes(q)
        );
      });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'pos') {
        cmp = a.pos.localeCompare(b.pos, undefined, { numeric: true });
      } else if (sortKey === 'pin') {
        cmp = a.pinName.localeCompare(b.pinName, undefined, { numeric: true });
      } else {
        cmp = a.signalFull.localeCompare(b.signalFull, undefined, { numeric: true });
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  });

  function toggleSort(key: 'pos' | 'pin' | 'signal'): void {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }
</script>

<aside class="h-full min-h-0 flex flex-col bg-base-100 border-l border-base-300 overflow-hidden">
  <!-- Tabs -->
  <div role="tablist" class="summary-tab-strip tabs tabs-border flex items-center border-b border-base-300 bg-base-200 px-2 pt-1.5 gap-1 shrink-0 text-xs">
    <button
      type="button"
      onclick={() => (activeTab = 'pins')}
      class={`tab text-xs font-medium whitespace-nowrap ${
        activeTab === 'pins'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      Pin Table <span class="font-mono-tabular text-[11px] opacity-75">({Object.keys(assignments).length})</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'diagnostics')}
      class={`px-2.5 py-1.5 rounded-t-field font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        activeTab === 'diagnostics'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      <span>Diagnostics</span>
      {#if report.errorCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-error">
          {report.errorCount}E
        </span>
      {/if}
      {#if report.warningCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-warning">
          {report.warningCount}W
        </span>
      {/if}
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'dma')}
      class={`tab text-xs font-medium whitespace-nowrap ${
        activeTab === 'dma'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      DMA <span class="font-mono-tabular text-[11px] opacity-75">({report.dmaAnalysis.length})</span>
    </button>

    {#if showPio}
      <button
        type="button"
        onclick={() => (activeTab = 'pio')}
        class={`tab text-xs font-medium whitespace-nowrap ${
          activeTab === 'pio'
            ? 'tab-active bg-base-100 text-foreground'
            : 'text-base-content/60 hover:text-foreground'
        }`}
      >
        PIO
      </button>
    {/if}

    <button
      type="button"
      onclick={() => (activeTab = 'gpio')}
      class={`tab text-xs font-medium whitespace-nowrap ${
        activeTab === 'gpio'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      GPIO
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'placement')}
      class={`tab text-xs font-medium whitespace-nowrap ${
        activeTab === 'placement'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      Placement
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'audit')}
      class={`tab text-xs font-medium whitespace-nowrap ${
        activeTab === 'audit'
          ? 'tab-active bg-base-100 text-foreground'
          : 'text-base-content/60 hover:text-foreground'
      }`}
    >
      Audit
    </button>
  </div>

  <!-- Tab 1: Pin Table -->
  {#if activeTab === 'pins'}
    <div class="p-2 border-b border-base-300 shrink-0">
      <div class="relative flex items-center">
        <Search class="size-3.5 text-base-content/40 absolute left-2.5 pointer-events-none" />
        <input
          bind:value={tableFilter}
          type="text"
          placeholder="Filter assigned pins or labels..."
          class="input input-xs w-full pl-8 pr-2.5"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if rows.length === 0 && !hasAssignments}
        <div class="p-6 text-center text-xs text-base-content/60 space-y-1">
          <p class="font-medium text-foreground">No assigned pins yet</p>
          <p>Enable a peripheral mode on the left or left-click any I/O pin on the package.</p>
        </div>
      {:else if rows.length === 0}
        <div class="p-6 text-center text-xs text-base-content/60 space-y-2">
          <p class="font-medium text-foreground">No assigned pins match this filter</p>
          <p>Adjust or clear the pin filter to see the assigned pins again.</p>
          <button
            type="button"
            onclick={() => (tableFilter = '')}
            class="btn btn-sm btn-outline"
          >
            Clear filter
          </button>
        </div>
      {:else}
        <table class="table table-xs w-full text-left text-[11px]">
          <thead class="sticky top-0 bg-base-200 border-b border-base-300 text-base-content/60">
            <tr>
              <th
                class="py-1.5 pl-2.5 pr-1 font-medium"
                aria-sort={sortKey === 'pos' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" onclick={() => toggleSort('pos')} class="inline-flex items-center gap-0.5 hover:text-foreground">
                  Pos <ArrowUpDown class="size-2.5" />
                </button>
              </th>
              <th
                class="py-1.5 px-1 font-medium"
                aria-sort={sortKey === 'pin' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" onclick={() => toggleSort('pin')} class="inline-flex items-center gap-0.5 hover:text-foreground">
                  Pin <ArrowUpDown class="size-2.5" />
                </button>
              </th>
              <th
                class="py-1.5 px-1 font-medium"
                aria-sort={sortKey === 'signal' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" onclick={() => toggleSort('signal')} class="inline-flex items-center gap-0.5 hover:text-foreground">
                  Signal <ArrowUpDown class="size-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">Label</th>
              <th class="py-1.5 pr-2 text-right font-medium">Act</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-300">
            {#each rows as row (row.pos)}
              <tr
                class="hover:bg-base-300 cursor-pointer"
                onclick={() => {
                  inspectorPos = row.pos;
                  onFocusPin(row.pos);
                }}
              >
                <td class="py-1.5 pl-2.5 pr-1 font-mono-tabular text-base-content/60">
                  {row.pos}
                </td>
                <td class="py-1.5 px-1 font-mono font-medium text-foreground whitespace-nowrap">
                  <span class={row.bondedNames.length > 0 ? 'border-b border-dashed border-current' : ''}>
                    {row.pinName}
                  </span>
                  {#if row.bondedNames.length > 0}
                    <span class="block text-[10px] font-normal text-base-content/60">
                      {row.bondedNames.join(' / ')}
                    </span>
                  {/if}
                  {#if row.tags.length > 0}
                    <span class="block"><PinTagPills tags={row.tags} compact={true} /></span>
                  {/if}
                </td>
                <td class="py-1.5 px-1 font-mono whitespace-nowrap">
                  <span
                    class={row.status === 'conflict'
                      ? 'text-error font-semibold'
                      : row.status === 'partial'
                        ? 'text-warning'
                        : 'text-success'}
                  >
                    {row.signalFull}
                  </span>
                  {#if row.extiLine}
                    <span
                      class="text-info ml-1"
                      title={`GPIO_EXTI uses hardware line ${row.extiLine}`}
                    >
                      {row.extiLine}
                    </span>
                  {/if}
                  <span class="text-base-content/60 ml-1">{row.muxLabel}</span>
                </td>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <td class="py-1 px-1" onclick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={row.label}
                    placeholder="—"
                    onchange={(e) =>
                      onSetLabel(row.pos, (e.currentTarget as HTMLInputElement).value)}
                    class="input input-ghost input-xs w-full min-w-[68px] font-mono"
                  />
                </td>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <td class="py-1 pr-2 text-right whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onclick={() => onToggleLock(row.pos)}
                    title={row.isLocked ? 'Unlock pin' : 'Lock pin'}
                    class="btn btn-ghost btn-xs btn-square"
                  >
                    {#if row.isLocked}
                      <Lock class="size-3 text-warning" />
                    {:else}
                      <Unlock class="size-3" />
                    {/if}
                  </button>
                  <button
                    type="button"
                    disabled={row.isLocked}
                    onclick={() => onClearPin(row.pos)}
                    title="Clear pin"
                    class="btn btn-ghost btn-xs btn-square hover:text-error"
                  >
                    <Trash2 class="size-3" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

  <!-- Tab 2: Diagnostics -->
  {:else if activeTab === 'diagnostics'}
    <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
      {#if report.diagnostics.length === 0}
        <div class="p-6 text-center text-xs text-base-content/60 space-y-1.5">
          <CheckCircle2 class="w-6 h-6 text-success mx-auto" />
          <span class="badge badge-success">No conflicts or warnings</span>
          <p>All active peripherals and pin assignments satisfy hardware invariants.</p>
        </div>
      {:else}
        {#each report.diagnostics as diag (diag.id)}
          <div
            role="alert"
            class={`alert p-2.5 text-xs space-y-2 ${
              diag.severity === 'error' ? 'alert-error' : 'alert-warning'
            }`}
          >
            <div class="flex items-start gap-2">
              {#if diag.severity === 'error'}
                <XCircle class="size-4 text-error shrink-0 mt-0.5" />
              {:else}
                <AlertTriangle class="size-4 text-warning shrink-0 mt-0.5" />
              {/if}
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class={`badge badge-sm ${
                      diag.severity === 'error' ? 'badge-error' : 'badge-warning'
                    }`}
                  >
                    {diag.severity === 'error' ? 'Error' : 'Warning'}
                  </span>
                  {#if diag.peripheral}
                    <span class="font-mono text-[11px] text-base-content/60">
                      {diag.peripheral}
                    </span>
                  {/if}
                </div>
                <p class="text-foreground leading-relaxed">
                  {diag.message}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 pl-6">
              {#each diag.pins as pPos}
                <button
                  type="button"
                  onclick={() => onFocusPin(pPos)}
                  class="btn btn-xs btn-outline font-mono"
                >
                  Inspect {pinMap.get(pPos)?.name ?? pPos}
                </button>
              {/each}

              {#if diag.fix}
                <button
                  type="button"
                  onclick={() => onApplyFix(diag.fix!)}
                  class="btn btn-xs btn-primary gap-1 font-medium"
                >
                  <Wrench class="size-3" />
                  <span>Apply 1-Hop Remap</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

  <!-- Tab 3: DMA -->
  {:else if activeTab === 'dma'}
    <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
      {#if report.dmaAnalysis.length === 0}
        <div class="p-6 text-center text-xs text-base-content/60 space-y-1">
          <p class="font-medium text-foreground">No active DMA requests</p>
          <p>Enable peripherals like SPI, USART, ADC, or TIM to inspect DMA streams and DMAMUX mappings.</p>
        </div>
      {:else}
        {#snippet dmaRow(item: DmaAnalysisEntry)}
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono font-semibold text-foreground">
              {item.peripheral}_{item.signal}
            </span>
            <span
              class={`badge badge-xs ${
                item.status === 'contention' || item.status === 'shared'
                  ? 'badge-warning'
                  : 'badge-success'
              }`}
            >
              {item.status === 'contention'
                ? 'Contention'
                : item.status === 'shared'
                  ? 'Shared'
                  : item.isMuxed
                    ? 'DMAMUX / GPDMA'
                    : 'Available'}
            </span>
          </div>
          <div class="font-mono-tabular text-[11px] text-base-content/60 break-words">
            {item.channels.join(', ')}
          </div>
          {#if item.contendingWith.length > 0}
            <div class="text-[11px] text-warning">
              Shares channel with: {item.contendingWith.join(', ')}
            </div>
          {/if}
        {/snippet}
        {#each report.dmaAnalysis as item (`${item.peripheral}:${item.signal}`)}
          {#if item.status === 'contention'}
            <div class="alert alert-warning p-2.5 text-xs space-y-1">
              {@render dmaRow(item)}
            </div>
          {:else}
            <div class="card card-border bg-base-200 p-2.5 text-xs space-y-1">
              {@render dmaRow(item)}
            </div>
          {/if}
        {/each}
      {/if}
    </div>

  <!-- Tab 4: RP PIO allocation -->
  {:else if activeTab === 'pio'}
    <PioPanel
      {chip}
      assignments={pioAssignments}
      diagnostics={report.diagnostics}
      onSetAssignment={onSetPioAssignment}
    />

  <!-- Tab 5: GPIO electrical settings for the selected pin -->
  {:else if activeTab === 'gpio'}
    <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
      {#if !inspectorPin}
        <div class="p-6 text-center text-xs text-base-content/60 space-y-1">
          <p class="font-medium text-foreground">No pin selected</p>
          <p>Select a pin in the pin table or on the package to edit its electrical settings.</p>
        </div>
      {:else}
        <div class="card card-border bg-base-200 p-2.5 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono font-semibold text-foreground">{inspectorPin.name}</span>
            <span class="font-mono-tabular text-[11px] text-base-content/60">Pin {inspectorPin.pos}</span>
          </div>
          {#if assignments[inspectorPin.pos]}
            <div class="font-mono text-[11px] text-base-content/60 mt-1">
              {assignments[inspectorPin.pos].peripheral}_{assignments[inspectorPin.pos].signal}
            </div>
          {/if}
        </div>

        <div class="card card-border bg-base-100 p-2.5 space-y-2.5 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-foreground">Electrical settings</span>
            {#if inspectorConfig}
              <button
                type="button"
                onclick={() => workspaceStore.setGpioConfig(inspectorPin!.pos, null)}
                class="btn btn-link btn-xs"
              >
                Reset
              </button>
            {/if}
          </div>

          <label class="block space-y-1">
            <span class="text-[11px] text-base-content/60">Output level</span>
            <select
              value={inspectorConfig?.outputLevel ?? DEFAULT_GPIO_CONFIG.outputLevel}
              onchange={(e) =>
                updateGpioConfig(
                  'outputLevel',
                  (e.currentTarget as HTMLSelectElement).value as GpioConfig['outputLevel'],
                )}
              class="select select-xs w-full"
            >
              {#each GPIO_OUTPUT_LEVELS as level}
                <option value={level}>{level}</option>
              {/each}
            </select>
          </label>

          <label class="block space-y-1">
            <span class="text-[11px] text-base-content/60">Drive</span>
            <select
              value={inspectorConfig?.drive ?? DEFAULT_GPIO_CONFIG.drive}
              onchange={(e) =>
                updateGpioConfig(
                  'drive',
                  (e.currentTarget as HTMLSelectElement).value as GpioConfig['drive'],
                )}
              class="select select-xs w-full"
            >
              {#each GPIO_DRIVES as drive}
                <option value={drive}>{drive}</option>
              {/each}
            </select>
          </label>

          <label class="block space-y-1">
            <span class="text-[11px] text-base-content/60">Pull resistor</span>
            <select
              value={inspectorConfig?.pull ?? DEFAULT_GPIO_CONFIG.pull}
              onchange={(e) =>
                updateGpioConfig(
                  'pull',
                  (e.currentTarget as HTMLSelectElement).value as GpioConfig['pull'],
                )}
              class="select select-xs w-full"
            >
              {#each GPIO_PULLS as pull}
                <option value={pull}>{pull}</option>
              {/each}
            </select>
          </label>

          <label class="block space-y-1">
            <span class="text-[11px] text-base-content/60">Speed</span>
            <select
              value={inspectorConfig?.speed ?? DEFAULT_GPIO_CONFIG.speed}
              onchange={(e) =>
                updateGpioConfig(
                  'speed',
                  (e.currentTarget as HTMLSelectElement).value as GpioConfig['speed'],
                )}
              class="select select-xs w-full"
            >
              {#each GPIO_SPEEDS as speed}
                <option value={speed}>{speed}</option>
              {/each}
            </select>
          </label>
        </div>
        <p class="text-[11px] text-base-content/60">
          Settings are stored with the pinout and included in share links, project files, and exports.
        </p>
      {/if}
    </div>

  <!-- Tab 6: configured-peripheral placement bubbles -->
  {:else if activeTab === 'placement'}
    <PlacementPanel
      {chip}
      {peripheralStatus}
      {peripheralModes}
      {assignments}
    />

  <!-- Tab 7: data-derived hardware audit, read-only -->
  {:else if activeTab === 'audit'}
    <HardwareAuditPanel {chip} state={workspaceStore.state} />
  {/if}
</aside>
