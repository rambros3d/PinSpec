<script lang="ts">
  import Search from '@solar-icons/svelte/bold-duotone/magnifier';
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount } from 'svelte';
  import Dialog from '../shell/Dialog.svelte';
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
  let dialogRef = $state<{ close: () => void } | null>(null);

  // Increasing this token invalidates every pending shard load.
  let generation = 0;
  let generationController: AbortController | null = null;

  const signature = $derived(chip ? deriveCompatibilitySignature(chip, workspaceState) : null);
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));
  // Module tags follow the generated index marker, never a part-name guess.
  const moduleIds = $derived(
    new Set(
      catalogStore.index
        .filter((entry) => entry.module)
        .map((entry) => entry.id.toUpperCase()),
    ),
  );
  const candidates = $derived.by(() => {
    const q = query.trim().toUpperCase();
    return catalogStore.index
      .filter((entry) => {
        if (chip && entry.id.toUpperCase() === chip.id.toUpperCase()) return false;
        if (vendorFilter !== 'all' && entry.vendor !== vendorFilter) return false;
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
    generationController?.abort();
    const controller = new AbortController();
    generationController = controller;
    hasSearched = true;
    loading = true;
    scores = [];
    warnings = [];

    const outcomes = await mapWithConcurrency(
      candidates,
      MAX_CONCURRENT_SHARD_LOADS,
      async (entry) => {
        try {
          const candidateChip = await catalogStore.loadChip(entry.id, controller.signal);
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

  /** Close path; the wrapper's close event notifies the parent once. */
  function close(): void {
    dialogRef?.close();
  }

  function handleClose(): void {
    generation += 1;
    generationController?.abort();
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
      generationController?.abort();
    };
  });
</script>

<Dialog
  bind:this={dialogRef}
  ariaLabel="Compatible MCUs"
  boxClass="w-full max-w-3xl max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden"
  backdropLabel="Close compatible MCUs"
  onClose={handleClose}
>
  <div class="contents">
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-base-300 shrink-0">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-foreground">Compatible MCUs</h2>
        <p class="text-[11px] text-base-content/60">
          Ranked against {chip?.id ?? 'the current MCU'} by pin name, pin type, required signals and memory.
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        class="btn btn-ghost btn-sm btn-square shrink-0"
        aria-label="Close compatible MCUs"
        title="Close finder"
      >
        <X class="size-4" />
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-2 px-4 py-3 border-b border-base-300 bg-base-200 shrink-0">
      <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
        Vendor
        <select
          bind:value={vendorFilter}
          onchange={() => void runSearch()}
          class="select select-sm"
          aria-label="Filter by vendor"
        >
          <option value="all">All</option>
          <option value="stm32">STM32</option>
          <option value="ch32">CH32</option>
          <option value="rp">RP</option>
          <option value="esp32">ESP32</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
        Package
        <select
          bind:value={packageFilter}
          onchange={() => void runSearch()}
          class="select select-sm"
          aria-label="Filter by package"
        >
          <option value="">All</option>
          {#each packageOptions as pkg (pkg)}
            <option value={pkg}>{pkg}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-base-content/60 min-w-[10rem] flex-1">
        Filter candidates
        <span class="relative flex items-center">
          <Search class="size-3 text-base-content/40 absolute left-2 pointer-events-none" />
          <input
            bind:value={query}
            type="text"
            placeholder="Part, family or package"
            class="input input-sm w-full pl-7 font-mono"
          />
        </span>
      </label>
      <button
        type="button"
        onclick={() => void runSearch()}
        class="btn btn-sm btn-primary text-xs font-semibold shrink-0"
      >
        Search
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if warnings.length > 0}
        <div role="alert" class="alert alert-warning px-4 py-2 border-b border-base-300 text-[11px]">
          {#each warnings as warning (warning)}
            <p>{warning}</p>
          {/each}
        </div>
      {/if}

      {#if loading}
        <p class="px-4 py-8 text-center text-xs text-base-content/60">
          <span class="loading loading-spinner loading-xs"></span>
          Loading up to {MAX_COMPATIBILITY_RESULTS} shards ({MAX_CONCURRENT_SHARD_LOADS} at a time)...
        </p>
      {:else if !hasSearched}
        <p class="px-4 py-8 text-center text-xs text-base-content/60">No search has been run yet.</p>
      {:else if scores.length === 0}
        <p class="px-4 py-8 text-center text-xs text-base-content/60">
          No compatible candidates matched the current filters.
        </p>
      {:else}
        <table class="table table-sm w-full text-left text-xs">
          <thead class="bg-base-200 text-[11px] text-base-content/60 uppercase tracking-wide">
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
              <tr class="border-t border-base-300">
                <td class="px-4 py-2 font-mono font-semibold text-foreground">
                  {score.mcuId}
                  {#if moduleIds.has(score.mcuId.toUpperCase())}
                    <span class="badge badge-xs badge-outline font-mono text-[9px] uppercase ml-1">
                      MODULE
                    </span>
                  {/if}
                </td>
                <td class="px-2 py-2 font-mono text-base-content/60">{score.vendor}</td>
                <td class="px-2 py-2 text-foreground">{score.classification}</td>
                <td class="px-2 py-2 font-mono text-base-content/60">{score.muxModel}</td>
                <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                  {score.flashDeltaKb >= 0 ? '+' : ''}{score.flashDeltaKb} KB /
                  {score.ramDeltaKb >= 0 ? '+' : ''}{score.ramDeltaKb} KB
                </td>
                <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                  {score.exactPinMatches} exact / {score.functionalMatches} alternate
                </td>
                <td class="px-2 py-2 text-right">
                  <button
                    type="button"
                    onclick={() => openCandidate(score.mcuId)}
                    class="btn btn-xs btn-outline text-[11px] font-medium"
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
</Dialog>
