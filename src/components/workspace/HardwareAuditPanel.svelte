<script lang="ts">
  /**
   * Read-only view of the data-derived hardware audit. The report is computed
   * from the chip shard and workspace state; this component has no commit
   * callback and cannot modify assignments, labels, locks, modes, or history.
   */
  import {
    buildHardwareAudit,
    type InterfaceFact,
  } from '../../core/hardware-audit';
  import type { ChipData, WorkspaceState } from '../../core/types';

  interface Props {
    chip: ChipData;
    state: WorkspaceState;
  }

  let { chip, state }: Props = $props();

  const report = $derived.by(() => buildHardwareAudit(chip, state));

  function statusLabel(fact: InterfaceFact): string {
    if (fact.status === 'present') return 'Present';
    if (fact.status === 'absent') return 'Absent';
    return 'Data unavailable';
  }
</script>

<div class="h-full min-h-0 overflow-y-auto p-2.5 space-y-3 text-xs">
  <p class="text-[11px] text-base-content/60 leading-relaxed">
    Facts read from the generated chip shard, upstream dataset rows, and the current pinout. No pull
    direction, passive value, or unused-pin action is recommended.
  </p>

  <section class="space-y-1.5">
    <h3 class="text-[11px] font-semibold text-foreground">Strapping</h3>
    {#if report.strapping.length === 0}
      <p class="text-[11px] text-base-content/60">No strapping roles declared in this shard.</p>
    {:else}
      {#each report.strapping as fact (fact.pos + fact.role)}
        <div class="card card-border bg-base-200 p-2 space-y-0.5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-foreground">{fact.pos} · {fact.pinName}</span>
            <span class="badge badge-xs badge-info text-[10px]">
              {fact.role}
            </span>
          </div>
          <div class="font-mono text-[11px] text-base-content/60">
            {fact.detail} · evidence: {fact.evidence}
          </div>
          <div class="text-[11px] text-base-content/60">
            Pull: <span class="font-mono">{fact.pull}</span> ({fact.pullEvidence})
            {#if fact.label}
              · Label: <span class="font-mono">{fact.label}</span> ({fact.labelEvidence})
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </section>

  <section class="space-y-1.5">
    <h3 class="text-[11px] font-semibold text-foreground">Interfaces</h3>
    <div class="card card-border bg-base-200 p-2 space-y-1">
      {#each report.interfaces.interfaces as fact (fact.id)}
        <div class="flex items-start justify-between gap-2">
          <span class="font-mono text-foreground">{fact.id}</span>
          <span class="text-[11px] text-base-content/60 text-right">
            {statusLabel(fact)} · <span class="font-mono">{fact.detail}</span> · {fact.evidence}
          </span>
        </div>
      {/each}
    </div>

    <h4 class="text-[11px] font-medium text-base-content/60">Oscillators</h4>
    <div class="card card-border bg-base-200 p-2 space-y-1">
      {#each report.interfaces.oscillators as fact (fact.id)}
        <div class="flex items-start justify-between gap-2">
          <span class="font-mono text-foreground">{fact.id}</span>
          <span class="text-[11px] text-base-content/60 text-right font-mono">{fact.detail}</span>
        </div>
      {/each}
    </div>

    <h4 class="text-[11px] font-medium text-base-content/60">Power domains</h4>
    <div class="card card-border bg-base-200 p-2 space-y-1">
      {#each report.interfaces.powerDomains as fact (fact.id)}
        <div class="flex items-start justify-between gap-2">
          <span class="font-mono text-foreground">{fact.id}</span>
          <span class="text-[11px] text-base-content/60 text-right font-mono">{fact.detail}</span>
        </div>
      {/each}
    </div>

    <h4 class="text-[11px] font-medium text-base-content/60">Passive fields</h4>
    <div class="card card-border bg-base-200 p-2 space-y-1">
      {#each report.interfaces.passiveFields as fact (fact.id)}
        <div class="flex items-start justify-between gap-2">
          <span class="font-mono text-foreground">{fact.id}</span>
          <span class="text-[11px] text-base-content/60 text-right">{statusLabel(fact)} · {fact.detail}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-1.5">
    <h3 class="text-[11px] font-semibold text-foreground">Unused pins</h3>
    {#if report.unusedPins.unused.length === 0}
      <p class="text-[11px] text-base-content/60">No unassigned I/O pins.</p>
    {:else}
      <div class="card card-border bg-base-200 p-2 space-y-0.5">
        {#each report.unusedPins.unused as fact (fact.pos)}
          <div class="flex items-start justify-between gap-2 font-mono text-[11px]">
            <span class="text-foreground">{fact.pos} · {fact.pinName}</span>
            <span class="text-base-content/60">{fact.evidence}</span>
          </div>
        {/each}
      </div>
    {/if}

    <h4 class="text-[11px] font-medium text-base-content/60">Bonded pads</h4>
    {#if report.unusedPins.bonded.length === 0}
      <p class="text-[11px] text-base-content/60">No shard-backed bonded pads.</p>
    {:else}
      <div class="card card-border bg-base-200 p-2 space-y-0.5">
        {#each report.unusedPins.bonded as fact (fact.pos)}
          <div class="flex items-start justify-between gap-2 font-mono text-[11px]">
            <span class="text-foreground">{fact.pos} · {fact.bondedNames.join(' / ')}</span>
            <span class="text-base-content/60">{fact.evidence}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="space-y-1.5">
    <h3 class="text-[11px] font-semibold text-foreground">Voltage tolerance</h3>
    <div class="card card-border bg-base-200 p-2 space-y-0.5">
      {#each report.voltageTolerance as fact (fact.pos)}
        <div class="flex items-start justify-between gap-2 text-[11px]">
          <span class="font-mono text-foreground">{fact.pos} · {fact.pinName}</span>
          <span class="text-base-content/60 text-right">
            <span class="font-mono">{fact.tolerance}</span> · {fact.evidence}
          </span>
        </div>
      {/each}
    </div>
  </section>
</div>
