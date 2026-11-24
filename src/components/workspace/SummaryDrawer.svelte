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
  import type {
    ChipData,
    OneHopFix,
    PinAssignment,
    SolverReport,
  } from '../../core/types';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    report: SolverReport;
    onFocusPin: (pos: string) => void;
    onSetLabel: (pos: string, label: string) => void;
    onToggleLock: (pos: string) => void;
    onClearPin: (pos: string) => void;
    onApplyFix: (fix: OneHopFix) => void;
  }

  let {
    chip,
    assignments,
    labels,
    locked,
    report,
    onFocusPin,
    onSetLabel,
    onToggleLock,
    onClearPin,
    onApplyFix,
  }: Props = $props();

  let activeTab = $state<'pins' | 'diagnostics' | 'dma'>('pins');
  let tableFilter = $state('');
  let sortKey = $state<'pos' | 'pin' | 'signal'>('pos');
  let sortAsc = $state(true);

  const pinMap = $derived(new Map(chip.pins.map((p) => [p.pos, p])));

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
          af: asgn.af,
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

<aside class="h-full flex flex-col bg-white dark:bg-[#121722] border-l border-slate-200 dark:border-slate-800 overflow-hidden">
  <!-- Tabs -->
  <div class="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f141e] px-2 pt-1.5 gap-1 shrink-0 text-xs">
    <button
      type="button"
      onclick={() => (activeTab = 'pins')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors ${
        activeTab === 'pins'
          ? 'bg-white dark:bg-[#121722] text-slate-900 dark:text-slate-100 border-t border-x border-slate-200 dark:border-slate-800 -mb-px'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      Pin Table <span class="font-mono-tabular text-[11px] opacity-75">({Object.keys(assignments).length})</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'diagnostics')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        activeTab === 'diagnostics'
          ? 'bg-white dark:bg-[#121722] text-slate-900 dark:text-slate-100 border-t border-x border-slate-200 dark:border-slate-800 -mb-px'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <span>Diagnostics</span>
      {#if report.errorCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-red-500">
          {report.errorCount}E
        </span>
      {/if}
      {#if report.warningCount > 0}
        <span class="font-mono-tabular text-[11px] font-semibold text-orange-500">
          {report.warningCount}W
        </span>
      {/if}
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'dma')}
      class={`px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap transition-colors ${
        activeTab === 'dma'
          ? 'bg-white dark:bg-[#121722] text-slate-900 dark:text-slate-100 border-t border-x border-slate-200 dark:border-slate-800 -mb-px'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      DMA <span class="font-mono-tabular text-[11px] opacity-75">({report.dmaAnalysis.length})</span>
    </button>
  </div>

  <!-- Tab 1: Pin Table -->
  {#if activeTab === 'pins'}
    <div class="p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          bind:value={tableFilter}
          type="text"
          placeholder="Filter assigned pins or labels..."
          class="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#if rows.length === 0}
        <div class="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p class="font-medium text-slate-700 dark:text-slate-300">No assigned pins yet</p>
          <p>Enable a peripheral mode on the left or left-click any I/O pin on the package.</p>
        </div>
      {:else}
        <table class="w-full text-left border-collapse text-[11px]">
          <thead class="sticky top-0 bg-slate-50 dark:bg-[#0f141e] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <tr>
              <th class="py-1.5 pl-2.5 pr-1 font-medium">
                <button type="button" onclick={() => toggleSort('pos')} class="inline-flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-slate-100">
                  Pos <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">
                <button type="button" onclick={() => toggleSort('pin')} class="inline-flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-slate-100">
                  Pin <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">
                <button type="button" onclick={() => toggleSort('signal')} class="inline-flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-slate-100">
                  Signal <ArrowUpDown class="w-2.5 h-2.5" />
                </button>
              </th>
              <th class="py-1.5 px-1 font-medium">Label</th>
              <th class="py-1.5 pr-2 text-right font-medium">Act</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
            {#each rows as row (row.pos)}
              <tr
                class="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                onclick={() => onFocusPin(row.pos)}
              >
                <td class="py-1.5 pl-2.5 pr-1 font-mono-tabular text-slate-500 dark:text-slate-400">
                  {row.pos}
                </td>
                <td class="py-1.5 px-1 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {row.pinName}
                </td>
                <td class="py-1.5 px-1 font-mono whitespace-nowrap">
                  <span
                    class={row.status === 'conflict'
                      ? 'text-red-500 font-semibold'
                      : row.status === 'partial'
                        ? 'text-orange-500'
                        : 'text-emerald-600 dark:text-emerald-400'}
                  >
                    {row.signalFull}
                  </span>
                  {#if row.af !== null}
                    <span class="text-slate-400 dark:text-slate-500 ml-1">AF{row.af}</span>
                  {/if}
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
                    class="w-full min-w-[68px] px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-[#0b0e14] border border-transparent focus:border-sky-500 font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </td>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <td class="py-1 pr-2 text-right whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onclick={() => onToggleLock(row.pos)}
                    title={row.isLocked ? 'Unlock pin' : 'Lock pin'}
                    class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                  >
                    {#if row.isLocked}
                      <Lock class="w-3 h-3 text-amber-500" />
                    {:else}
                      <Unlock class="w-3 h-3" />
                    {/if}
                  </button>
                  <button
                    type="button"
                    disabled={row.isLocked}
                    onclick={() => onClearPin(row.pos)}
                    title="Clear pin"
                    class="p-1 rounded hover:bg-red-500/15 text-slate-400 hover:text-red-500 disabled:opacity-30"
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
        <div class="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
          <CheckCircle2 class="w-6 h-6 text-emerald-500 mx-auto" />
          <p class="font-medium text-slate-800 dark:text-slate-200">No conflicts or warnings</p>
          <p>All active peripherals and pin assignments satisfy hardware invariants.</p>
        </div>
      {:else}
        {#each report.diagnostics as diag (diag.id)}
          <div
            class={`rounded-lg border p-2.5 text-xs space-y-2 ${
              diag.severity === 'error'
                ? 'border-red-500/40 bg-red-500/8'
                : 'border-orange-500/35 bg-orange-500/8'
            }`}
          >
            <div class="flex items-start gap-2">
              {#if diag.severity === 'error'}
                <XCircle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              {:else}
                <AlertTriangle class="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              {/if}
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class={`font-semibold text-[11px] ${
                      diag.severity === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {diag.severity === 'error' ? 'Error' : 'Warning'}
                  </span>
                  {#if diag.peripheral}
                    <span class="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {diag.peripheral}
                    </span>
                  {/if}
                </div>
                <p class="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {diag.message}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 pl-6">
              {#each diag.pins as pPos}
                <button
                  type="button"
                  onclick={() => onFocusPin(pPos)}
                  class="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121722] hover:border-sky-500 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                >
                  Inspect {pinMap.get(pPos)?.name ?? pPos}
                </button>
              {/each}

              {#if diag.fix}
                <button
                  type="button"
                  onclick={() => onApplyFix(diag.fix!)}
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium text-[11px]"
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
  {:else}
    <div class="flex-1 overflow-y-auto p-2.5 space-y-2">
      {#if report.dmaAnalysis.length === 0}
        <div class="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p class="font-medium text-slate-700 dark:text-slate-300">No active DMA requests</p>
          <p>Enable peripherals like SPI, USART, ADC, or TIM to inspect DMA streams and DMAMUX mappings.</p>
        </div>
      {:else}
        {#each report.dmaAnalysis as item (`${item.peripheral}:${item.signal}`)}
          <div
            class={`rounded-lg border p-2.5 text-xs space-y-1 ${
              item.status === 'contention'
                ? 'border-orange-500/45 bg-orange-500/8'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0e131d]'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {item.peripheral}_{item.signal}
              </span>
              <span
                class={`text-[10px] font-medium ${
                  item.status === 'contention'
                    ? 'text-orange-600 dark:text-orange-400'
                    : item.status === 'shared'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
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
            <div class="font-mono-tabular text-[11px] text-slate-600 dark:text-slate-400 break-words">
              {item.channels.join(', ')}
            </div>
            {#if item.contendingWith.length > 0}
              <div class="text-[11px] text-orange-600 dark:text-orange-400">
                Shares channel with: {item.contendingWith.join(', ')}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</aside>
