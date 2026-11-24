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
    type ChipData,
    type OneHopFix,
    type PinAssignment,
    type PioPinAssignment,
    type SolverReport,
  } from '../../core/types';
  import PioPanel from './PioPanel.svelte';
  import PinTagPills from './PinTagPills.svelte';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pioAssignments: Record<string, PioPinAssignment>;
    report: SolverReport;
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
    labels,
    locked,
    pioAssignments,
    report,
    onFocusPin,
    onSetLabel,
    onToggleLock,
    onClearPin,
    onApplyFix,
    onSetPioAssignment,
  }: Props = $props();

  let activeTab = $state<'pins' | 'diagnostics' | 'dma' | 'pio'>('pins');
  let tableFilter = $state('');
  let sortKey = $state<'pos' | 'pin' | 'signal'>('pos');
  let sortAsc = $state(true);

  const pinMap = $derived(new Map(chip.pins.map((p) => [p.pos, p])));
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

<aside class="h-full flex flex-col bg-surface border-l border-hairline overflow-hidden">
  <!-- Tabs -->
  <div class="flex items-center border-b border-hairline bg-subtle px-2 pt-1.5 gap-1 shrink-0 text-xs">
    <button
      type="button"
      onclick={() => (activeTab = 'pins')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors ${
        activeTab === 'pins'
          ? 'bg-surface text-primary border-t border-x border-hairline -mb-px'
          : 'text-muted hover:text-primary'
      }`}
    >
      Pin Table <span class="font-mono-tabular text-[11px] opacity-75">({Object.keys(assignments).length})</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'diagnostics')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        activeTab === 'diagnostics'
          ? 'bg-surface text-primary border-t border-x border-hairline -mb-px'
          : 'text-muted hover:text-primary'
      }`}
    >
      <span>Diagnostics</span>
      {#if report.errorCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-danger">
          {report.errorCount}E
        </span>
      {/if}
      {#if report.warningCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-pin-partial">
          {report.warningCount}W
        </span>
      {/if}
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'dma')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors ${
        activeTab === 'dma'
          ? 'bg-surface text-primary border-t border-x border-hairline -mb-px'
          : 'text-muted hover:text-primary'
      }`}
    >
      DMA <span class="font-mono-tabular text-[11px] opacity-75">({report.dmaAnalysis.length})</span>
    </button>

    {#if showPio}
      <button
        type="button"
        onclick={() => (activeTab = 'pio')}
        class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors ${
          activeTab === 'pio'
            ? 'bg-surface text-primary border-t border-x border-hairline -mb-px'
            : 'text-muted hover:text-primary'
        }`}
      >
        PIO
      </button>
    {/if}
  </div>

  <!-- Tab 1: Pin Table -->
  {#if activeTab === 'pins'}
    <div class="p-2 border-b border-hairline shrink-0">
      <div class="relative flex items-center">
        <Search class="w-3.5 h-3.5 text-faint absolute left-2.5 pointer-events-none" />
        <input
          bind:value={tableFilter}
          type="text"
          placeholder="Filter assigned pins or labels..."
          class="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-elevated border border-hairline text-xs text-primary placeholder:text-faint focus:outline-none focus:border-hint"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#if rows.length === 0}
        <div class="p-6 text-center text-xs text-muted space-y-1">
          <p class="font-medium text-primary">No assigned pins yet</p>
          <p>Enable a peripheral mode on the left or left-click any I/O pin on the package.</p>
        </div>
      {:else}
        <table class="w-full text-left border-collapse text-[11px]">
          <thead class="sticky top-0 bg-subtle border-b border-hairline text-muted">
            <tr>
              <th class="py-1.5 pl-2.5 pr-1 font-medium">
                <button type="button" onclick={() => toggleSort('pos')} class="inline-flex items-center gap-0.5 hover:text-primary">
                  Pos <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">
                <button type="button" onclick={() => toggleSort('pin')} class="inline-flex items-center gap-0.5 hover:text-primary">
                  Pin <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">
                <button type="button" onclick={() => toggleSort('signal')} class="inline-flex items-center gap-0.5 hover:text-primary">
                  Signal <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">Label</th>
              <th class="py-1.5 pr-2 text-right font-medium">Act</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            {#each rows as row (row.pos)}
              <tr
                class="hover:bg-elevated cursor-pointer"
                onclick={() => onFocusPin(row.pos)}
              >
                <td class="py-1.5 pl-2.5 pr-1 font-mono-tabular text-muted">
                  {row.pos}
                </td>
                <td class="py-1.5 px-1 font-mono font-medium text-primary whitespace-nowrap">
                  <span class={row.bondedNames.length > 0 ? 'border-b border-dashed border-current' : ''}>
                    {row.pinName}
                  </span>
                  {#if row.bondedNames.length > 0}
                    <span class="block text-[10px] font-normal text-faint">
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
                      ? 'text-danger font-semibold'
                      : row.status === 'partial'
                        ? 'text-pin-partial'
                        : 'text-pin-success'}
                  >
                    {row.signalFull}
                  </span>
                  <span class="text-faint ml-1">{row.muxLabel}</span>
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
                    class="w-full min-w-[68px] px-1.5 py-0.5 rounded bg-transparent hover:bg-elevated focus:bg-elevated border border-transparent focus:border-hint font-mono text-[11px] text-primary focus:outline-none"
                  />
                </td>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <td class="py-1 pr-2 text-right whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onclick={() => onToggleLock(row.pos)}
                    title={row.isLocked ? 'Unlock pin' : 'Lock pin'}
                    class="p-1 rounded hover:bg-elevated text-muted"
                  >
                    {#if row.isLocked}
                      <Lock class="w-3 h-3 text-pin-power" />
                    {:else}
                      <Unlock class="w-3 h-3" />
                    {/if}
                  </button>
                  <button
                    type="button"
                    disabled={row.isLocked}
                    onclick={() => onClearPin(row.pos)}
                    title="Clear pin"
                    class="p-1 rounded hover:bg-danger-soft text-faint hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 class="w-3 h-3" />
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
    <div class="flex-1 overflow-y-auto p-2.5 space-y-2">
      {#if report.diagnostics.length === 0}
        <div class="p-6 text-center text-xs text-muted space-y-1.5">
          <CheckCircle2 class="w-6 h-6 text-pin-success mx-auto" />
          <p class="font-medium text-primary">No conflicts or warnings</p>
          <p>All active peripherals and pin assignments satisfy hardware invariants.</p>
        </div>
      {:else}
        {#each report.diagnostics as diag (diag.id)}
          <div
            class={`rounded-lg border p-2.5 text-xs space-y-2 ${
              diag.severity === 'error'
                ? 'border-danger bg-danger-soft'
                : 'border-pin-partial bg-warning-soft'
            }`}
          >
            <div class="flex items-start gap-2">
              {#if diag.severity === 'error'}
                <XCircle class="w-4 h-4 text-danger shrink-0 mt-0.5" />
              {:else}
                <AlertTriangle class="w-4 h-4 text-pin-partial shrink-0 mt-0.5" />
              {/if}
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class={`font-semibold text-[11px] ${
                      diag.severity === 'error'
                        ? 'text-danger'
                        : 'text-pin-partial'
                    }`}
                  >
                    {diag.severity === 'error' ? 'Error' : 'Warning'}
                  </span>
                  {#if diag.peripheral}
                    <span class="font-mono text-[11px] text-muted">
                      {diag.peripheral}
                    </span>
                  {/if}
                </div>
                <p class="text-primary leading-relaxed">
                  {diag.message}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 pl-6">
              {#each diag.pins as pPos}
                <button
                  type="button"
                  onclick={() => onFocusPin(pPos)}
                  class="px-2 py-0.5 rounded border border-strong bg-surface hover:border-hint font-mono text-[11px] text-primary"
                >
                  Inspect {pinMap.get(pPos)?.name ?? pPos}
                </button>
              {/each}

              {#if diag.fix}
                <button
                  type="button"
                  onclick={() => onApplyFix(diag.fix!)}
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-action hover:bg-action-hover text-on-action font-medium text-[11px]"
                >
                  <Wrench class="w-3 h-3" />
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
    <div class="flex-1 overflow-y-auto p-2.5 space-y-2">
      {#if report.dmaAnalysis.length === 0}
        <div class="p-6 text-center text-xs text-muted space-y-1">
          <p class="font-medium text-primary">No active DMA requests</p>
          <p>Enable peripherals like SPI, USART, ADC, or TIM to inspect DMA streams and DMAMUX mappings.</p>
        </div>
      {:else}
        {#each report.dmaAnalysis as item (`${item.peripheral}:${item.signal}`)}
          <div
            class={`rounded-lg border p-2.5 text-xs space-y-1 ${
              item.status === 'contention'
                ? 'border-pin-partial bg-warning-soft'
                : 'border-hairline bg-subtle'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-primary">
                {item.peripheral}_{item.signal}
              </span>
              <span
                class={`text-[10px] font-medium ${
                  item.status === 'contention'
                    ? 'text-pin-partial'
                    : item.status === 'shared'
                      ? 'text-pin-power'
                      : 'text-pin-success'
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
            <div class="font-mono-tabular text-[11px] text-muted break-words">
              {item.channels.join(', ')}
            </div>
            {#if item.contendingWith.length > 0}
              <div class="text-[11px] text-pin-partial">
                Shares channel with: {item.contendingWith.join(', ')}
              </div>
            {/if}
          </div>
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
  {/if}
</aside>
