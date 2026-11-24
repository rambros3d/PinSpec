<script lang="ts">
  import { ArrowRight, Clock, Trash2 } from 'lucide-svelte';
  import type { RecentSession } from '../../state/workspace.svelte';

  interface Props {
    recentSessions: RecentSession[];
    onOpenMcu: (mcuId: string) => void;
    onDeleteRecent: (mcuId: string) => void;
  }

  let { recentSessions, onOpenMcu, onDeleteRecent }: Props = $props();

  const STARTER_CHIPS = [
    {
      id: 'STM32F411CEU6',
      pkg: 'UFQFPN48',
      renderer: 'Perimeter',
      core: 'Cortex-M4',
      memory: '512 KB Flash · 128 KB RAM',
      note: 'Black Pill favorite with 100 MHz FPU and USB OTG FS.',
    },
    {
      id: 'STM32G431CBU6',
      pkg: 'UFQFPN48',
      renderer: 'Perimeter',
      core: 'Cortex-M4',
      memory: '128 KB Flash · 32 KB RAM',
      note: '170 MHz motor-control MCU with FDCAN, CORDIC, and advanced TIM1.',
    },
    {
      id: 'STM32F103C8T6',
      pkg: 'LQFP48',
      renderer: 'Perimeter',
      core: 'Cortex-M3',
      memory: '64 KB Flash · 20 KB RAM',
      note: 'Classic Blue Pill with AFIO remap architecture.',
    },
    {
      id: 'STM32H743VIT6',
      pkg: 'LQFP100',
      renderer: 'Perimeter',
      core: 'Cortex-M7',
      memory: '2048 KB Flash · 1024 KB RAM',
      note: '480 MHz high-performance flight-controller & DSP workhorse.',
    },
    {
      id: 'STM32U575RIT6',
      pkg: 'LQFP64',
      renderer: 'Perimeter',
      core: 'Cortex-M33',
      memory: '2048 KB Flash · 786 KB RAM',
      note: 'Ultra-low-power TrustZone MCU with GPDMA1 and rich analog.',
    },
    {
      id: 'STM32H743XIH6',
      pkg: 'TFBGA240',
      renderer: 'BGA Grid',
      core: 'Cortex-M7',
      memory: '2048 KB Flash · 1024 KB RAM',
      note: 'High-density 240+25 ball TFBGA matrix showcasing the Grid renderer.',
    },
  ];

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

<section id="presets" class="space-y-10">
  <!-- Recent Local Sessions (Conditional) -->
  {#if recentSessions.length > 0}
    <div class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-lg font-semibold text-primary">
          Recent Local Sessions
        </h2>
        <span class="text-xs text-muted">
          Stored in browser localStorage
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each recentSessions.slice(0, 6) as session (session.mcuId)}
          <div class="group rounded-lg border border-hairline bg-surface p-4 hover:border-hint transition-colors flex flex-col justify-between gap-3">
            <div class="flex items-start justify-between gap-2">
              <button
                type="button"
                onclick={() => onOpenMcu(session.mcuId)}
                class="text-left min-w-0 flex-1"
              >
                <div class="font-mono font-semibold text-sm text-primary group-hover:text-hint transition-colors">
                  {session.mcuId}
                </div>
                <div class="mt-1 font-mono-tabular text-xs text-muted">
                  {session.packageName} · {session.assignedCount}/{session.pinCount} pins assigned
                </div>
              </button>
              <button
                type="button"
                onclick={() => onDeleteRecent(session.mcuId)}
                title="Remove session"
                class="p-1.5 rounded hover:bg-danger-soft text-faint hover:text-danger"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-hairline text-xs">
              <span class="inline-flex items-center gap-1 text-faint font-mono-tabular">
                <Clock class="w-3 h-3" />
                {formatRelativeTime(session.updatedAt)}
              </span>
              <button
                type="button"
                onclick={() => onOpenMcu(session.mcuId)}
                class="inline-flex items-center gap-1 font-medium text-hint hover:underline"
              >
                <span>Reopen</span>
                <ArrowRight class="w-3 h-3" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Popular Starter Chips -->
  <div class="space-y-4">
    <div class="flex items-baseline justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-primary">
          Popular Starter Chips
        </h2>
        <p class="text-sm text-muted">
          Jump straight into major STM32 families across perimeter QFN/LQFP and matrix BGA packages.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each STARTER_CHIPS as item (item.id)}
        <button
          type="button"
          onclick={() => onOpenMcu(item.id)}
          class="group text-left rounded-lg border border-hairline bg-surface p-4 hover:border-hint transition-colors flex flex-col justify-between gap-3"
        >
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-sm text-primary group-hover:text-hint transition-colors">
                {item.id}
              </span>
              <span class="font-mono text-[11px] text-muted">
                {item.pkg} · {item.renderer}
              </span>
            </div>
            <div class="font-mono-tabular text-xs text-muted">
              {item.core} · {item.memory}
            </div>
            <p class="text-xs text-muted leading-relaxed pt-1">
              {item.note}
            </p>
          </div>
          <div class="flex items-center justify-end text-xs font-medium text-hint">
            <span class="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open workspace <ArrowRight class="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</section>
