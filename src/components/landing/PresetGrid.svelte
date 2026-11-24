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
      id: 'STM32G431CBU6',
      vendor: 'STM32',
      pkg: 'UFQFPN48',
      renderer: 'Perimeter',
      core: 'Cortex-M4',
      memory: '128 KB Flash · 32 KB RAM',
      note: 'Motor-control MCU with FDCAN, CORDIC, and advanced TIM1.',
    },
    {
      id: 'RP2040',
      vendor: 'RP',
      pkg: 'QFN-56',
      renderer: 'Perimeter',
      core: 'Cortex-M0+ dual',
      memory: '264 KB SRAM · XIP flash',
      note: 'Six FUNCSEL functions per GPIO, two PIO blocks and shared PWM slices.',
    },
    {
      id: 'RP2350B',
      vendor: 'RP',
      pkg: 'QFN-80',
      renderer: 'Perimeter',
      core: 'Cortex-M33 dual',
      memory: '520 KB SRAM · XIP flash',
      note: '48 GPIOs with two selectable GPIOBASE windows and three PIO blocks.',
    },
    {
      id: 'CH32V003J4M6',
      vendor: 'CH32',
      pkg: 'SOP8',
      renderer: 'Two-sided',
      core: 'RISC-V ECMISC',
      memory: '16 KB Flash · 2 KB RAM',
      note: 'Bonded multi-pad SOP8 package with coupled peripheral remap groups.',
    },
    {
      id: 'CH32V203C8T6',
      vendor: 'CH32',
      pkg: 'LQFP48',
      renderer: 'Perimeter',
      core: 'RISC-V',
      memory: '64 KB Flash · 20 KB RAM',
      note: 'General-purpose RISC-V part with SPI/USART remaps and USB.',
    },
    {
      id: 'STM32H743XIH6',
      vendor: 'STM32',
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
        <h2 class="text-lg font-semibold text-foreground">
          Recent Local Sessions
        </h2>
        <span class="text-xs text-base-content/60">
          Stored in browser localStorage
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each recentSessions.slice(0, 6) as session (session.mcuId)}
          <div class="card card-border group bg-base-100 p-4 hover:border-info transition-colors flex flex-col justify-between gap-3">
            <div class="flex items-start justify-between gap-2">
              <button
                type="button"
                onclick={() => onOpenMcu(session.mcuId)}
                class="text-left min-w-0 flex-1"
              >
                <div class="font-mono font-semibold text-sm text-foreground group-hover:text-info transition-colors">
                  {session.mcuId}
                </div>
                <div class="mt-1 font-mono-tabular text-xs text-base-content/60">
                  {session.packageName} · {session.assignedCount}/{session.pinCount} pins assigned
                </div>
              </button>
              <button
                type="button"
                onclick={() => onDeleteRecent(session.mcuId)}
                title="Remove session"
                class="btn btn-ghost btn-sm btn-square text-base-content/40 hover:text-error"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-base-300 text-xs">
              <span class="inline-flex items-center gap-1 text-base-content/40 font-mono-tabular">
                <Clock class="size-3" />
                {formatRelativeTime(session.updatedAt)}
              </span>
              <button
                type="button"
                onclick={() => onOpenMcu(session.mcuId)}
                class="btn btn-link btn-sm gap-1 font-medium"
              >
                <span>Reopen</span>
                <ArrowRight class="size-3" />
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
        <h2 class="text-lg font-semibold text-foreground">
          Cross-Vendor Starter Chips
        </h2>
        <p class="text-sm text-base-content/60">
          Jump straight into STM32, CH32 and RP parts across SOP, QFN, LQFP and matrix BGA packages.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each STARTER_CHIPS as item (item.id)}
        <button
          type="button"
          onclick={() => onOpenMcu(item.id)}
          class="card card-border group text-left bg-base-100 p-4 hover:border-info transition-colors flex flex-col justify-between gap-3"
        >
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5 min-w-0">
                <span class="font-mono font-semibold text-sm text-foreground group-hover:text-info transition-colors truncate">
                  {item.id}
                </span>
                <span class="badge badge-xs badge-ghost font-mono text-[9px]">
                  {item.vendor}
                </span>
              </span>
              <span class="font-mono text-[11px] text-base-content/60 shrink-0">
                {item.pkg} · {item.renderer}
              </span>
            </div>
            <div class="font-mono-tabular text-xs text-base-content/60">
              {item.core} · {item.memory}
            </div>
            <p class="text-xs text-base-content/60 leading-relaxed pt-1">
              {item.note}
            </p>
          </div>
          <div class="flex items-center justify-end text-xs font-medium text-info">
            <span class="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open workspace <ArrowRight class="size-3.5" />
            </span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</section>
