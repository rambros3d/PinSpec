<script lang="ts">
  import ArrowRight from '@solar-icons/svelte/bold-duotone/arrow-right';
  import Clock from '@solar-icons/svelte/bold-duotone/clock-circle';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import type { RecentSession } from '../../state/workspace.svelte';

  interface Props {
    recentSessions: RecentSession[];
    onOpenMcu: (mcuId: string) => void;
    onDeleteRecent: (mcuId: string) => void;
  }

  let { recentSessions, onOpenMcu, onDeleteRecent }: Props = $props();

  /** Render the saved timestamp relative to now without changing persisted state. */
  function formatRelativeTime(ts: number): string {
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }
</script>

{#if recentSessions.length > 0}
  <div class="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
    {#each recentSessions.slice(0, 6) as session (session.mcuId)}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
        <button
          type="button"
          onclick={() => onOpenMcu(session.mcuId)}
          class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left"
        >
          <span class="font-mono font-medium text-foreground">{session.mcuId}</span>
          <span class="font-mono text-base-content/60">{session.packageName}</span>
          <span class="font-mono-tabular text-base-content/60">
            {session.assignedCount}/{session.pinCount} pins
          </span>
        </button>
        <span class="inline-flex items-center gap-1 font-mono-tabular text-base-content/60">
          <Clock class="size-3" />
          {formatRelativeTime(session.updatedAt)}
        </span>
        <button
          type="button"
          onclick={() => onOpenMcu(session.mcuId)}
          class="btn btn-ghost btn-xs gap-1"
        >
          Reopen
          <ArrowRight class="size-3" />
        </button>
        <button
          type="button"
          onclick={() => onDeleteRecent(session.mcuId)}
          class="btn btn-ghost btn-xs btn-square"
          aria-label={`Delete ${session.mcuId}`}
          title="Delete session"
        >
          <Trash2 class="size-3.5" />
        </button>
      </div>
    {/each}
  </div>
{:else}
  <p class="text-xs text-base-content/60">Opening a part creates a recent session in this browser.</p>
{/if}
