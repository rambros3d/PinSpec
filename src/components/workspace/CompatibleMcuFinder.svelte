<script lang="ts">
  import { Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import {
    compareCandidateScores,
    deriveCompatibilitySignature,
    isCandidateScorable,
    mapWithConcurrency,
    MAX_COMPATIBILITY_RESULTS,
    MAX_CONCURRENT_SHARD_LOADS,
    scoreCandidate,
    type CandidateScore,
  } from '../../core/compatibility';
  import { catalogPackageKinds } from '../../core/vendor-view';
  import type { ChipData, VendorId, WorkspaceState } from '../../core/types';
  import { catalogStore } from '../../state/catalog.svelte';
  import { router } from '../../state/router.svelte';

  interface Props {
    chip: ChipData | null;
    workspaceState: WorkspaceState;
    onClose: () => void;
  }

  let { chip, workspaceState, onClose }: Props = $props();

  let vendorFilter = $state<VendorId | 'all'>('all');
  let packageFilter = $state('');
  let query = $state('');
  let loading = $state(false);
  let scores = $state<CandidateScore[]>([]);
  let warnings = $state<string[]>([]);
  let hasSearched = $state(false);

  // Increasing this token invalidates every pending shard load.
  let generation = 0;

  const signature = $derived(chip ? deriveCompatibilitySignature(chip, workspaceState) : null);
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));
  const candidates = $derived.by(() => {
    const q = query.trim().toUpperCase();
    return catalogStore.index
      .filter((entry) => {
        if (chip && entry.id.toUpperCase() === chip.id.toUpperCase()) return false;
        if (vendorFilter !== 'all' && (entry.vendor ?? 'stm32') !== vendorFilter) return false;
        if (packageFilter) {
          const name = entry.package.toUpperCase();
          const match = name.match(/^[A-Z]+/)?.[0] ?? '';
          if (match !== packageFilter) return false;
        }
        if (!q) return true;
        return (
          entry.id.toUpperCase().includes(q) ||
          entry.family.toUpperCase().includes(q) ||
          entry.package.toUpperCase().includes(q)
        );
      })
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .slice(0, MAX_COMPATIBILITY_RESULTS);
  });

  async function runSearch(): Promise<void> {
    if (!signature) return;
    const token = ++generation;
    hasSearched = true;
    loading = true;
    scores = [];
    warnings = [];

    const outcomes = await mapWithConcurrency(
      candidates,
      MAX_CONCURRENT_SHARD_LOADS,
      async (entry) => {
        try {
          const candidateChip = await catalogStore.loadChip(entry.id);
          if (!isCandidateScorable(candidateChip)) {
            if (token === generation) {
              warnings = [
                ...warnings,
                `${entry.id}: shard lacks pin-level signal data; skipped.`,
              ];
            }
            return null;
          }
          const score = scoreCandidate(signature, candidateChip);
          return score.classification === 'incompatible' ? null : score;
        } catch (err) {
          if (token === generation) {
            warnings = [
              ...warnings,
              `${entry.id}: ${err instanceof Error ? err.message : 'unable to load shard'}`,
            ];
          }
          return null;
        }
      },
      () => token !== generation,
    );

    // Late results from a closed or restarted search are never applied.
    if (token !== generation) return;
    scores = outcomes
      .filter((score): score is CandidateScore => score !== null)
      .sort(compareCandidateScores)
      .slice(0, MAX_COMPATIBILITY_RESULTS);
    loading = false;
  }

  function close(): void {
    generation += 1;
    onClose();
  }

  function openCandidate(mcuId: string): void {
    router.navigateMcu(mcuId);
    close();
  }

  onMount(() => {
    void catalogStore.ensureLoaded().then(() => runSearch());
    return () => {
      generation += 1;
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" onclick={close}>
  <div
    class="w-full max-w-3xl max-h-[92dvh] min-h-0 flex flex-col rounded-panel border-ui border-hairline bg-surface shadow-2xl overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Find compatible MCUs"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-ui-b border-hairline shrink-0">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-primary">Compatible MCUs</h2>
        <p class="text-[11px] text-muted">
          Ranked against {chip?.id ?? 'the current MCU'} by pin name, pin type, required signals and memory.
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        class="p-1 rounded-control hover:bg-elevated text-muted shrink-0"
        title="Close finder"
      >
        <X class="size-ui" />
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-2 px-4 py-3 border-ui-b border-hairline bg-subtle shrink-0">
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        Vendor
        <select
          bind:value={vendorFilter}
          onchange={() => void runSearch()}
          class="px-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
        >
          <option value="all">All</option>
          <option value="stm32">STM32</option>
          <option value="ch32">CH32</option>
          <option value="rp">RP</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        Package
        <select
          bind:value={packageFilter}
          onchange={() => void runSearch()}
          class="px-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
        >
          <option value="">All</option>
          {#each packageOptions as pkg (pkg)}
            <option value={pkg}>{pkg}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted min-w-[10rem] flex-1">
        Filter candidates
        <span class="relative flex items-center">
          <Search class="size-ui-sm text-faint absolute left-2 pointer-events-none" />
          <input
            bind:value={query}
            type="text"
            placeholder="Part, family or package"
            class="w-full pl-7 pr-2 py-1 rounded-control bg-elevated border-ui border-hairline text-xs font-mono text-primary placeholder:text-faint focus:outline-none focus:border-hint"
          />
        </span>
      </label>
      <button
        type="button"
        onclick={() => void runSearch()}
        class="px-3 py-1.5 rounded-control bg-action hover:bg-action-hover text-on-action text-xs font-semibold shrink-0"
      >
        Search
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if warnings.length > 0}
        <div class="px-4 py-2 border-ui-b border-hairline bg-warning-soft text-[11px] text-primary">
          {#each warnings as warning (warning)}
            <p>{warning}</p>
          {/each}
        </div>
      {/if}

      {#if loading}
        <p class="px-4 py-8 text-center text-xs text-muted">
          Loading up to {MAX_COMPATIBILITY_RESULTS} shards ({MAX_CONCURRENT_SHARD_LOADS} at a time)...
        </p>
      {:else if !hasSearched}
        <p class="px-4 py-8 text-center text-xs text-muted">No search has been run yet.</p>
      {:else if scores.length === 0}
        <p class="px-4 py-8 text-center text-xs text-muted">
          No compatible candidates matched the current filters.
        </p>
      {:else}
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-subtle text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th class="px-4 py-2 font-medium">MCU</th>
              <th class="px-2 py-2 font-medium">Vendor</th>
              <th class="px-2 py-2 font-medium">Match</th>
              <th class="px-2 py-2 font-medium">Mux</th>
              <th class="px-2 py-2 font-medium">Flash / RAM delta</th>
              <th class="px-2 py-2 font-medium">Pins</th>
              <th class="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each scores as score (score.mcuId)}
              <tr class="border-ui-t border-hairline">
                <td class="px-4 py-2 font-mono font-semibold text-primary">{score.mcuId}</td>
                <td class="px-2 py-2 font-mono text-muted">{score.vendor}</td>
                <td class="px-2 py-2 text-primary">{score.classification}</td>
                <td class="px-2 py-2 font-mono text-muted">{score.muxModel}</td>
                <td class="px-2 py-2 font-mono-tabular text-muted">
                  {score.flashDeltaKb >= 0 ? '+' : ''}{score.flashDeltaKb} KB /
                  {score.ramDeltaKb >= 0 ? '+' : ''}{score.ramDeltaKb} KB
                </td>
                <td class="px-2 py-2 font-mono-tabular text-muted">
                  {score.exactPinMatches} exact / {score.functionalMatches} alternate
                </td>
                <td class="px-2 py-2 text-right">
                  <button
                    type="button"
                    onclick={() => openCandidate(score.mcuId)}
                    class="px-2 py-1 rounded-control border-ui border-hairline hover:bg-elevated text-[11px] font-medium text-primary"
                  >
                    Open
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>
