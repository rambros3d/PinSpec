<script lang="ts">
  import { Plus, Trash2 } from 'lucide-svelte';
  import type { ChipData, DiagnosticItem, PioPinAssignment } from '../../core/types';
  import {
    formatGpioWindow,
    gpioNumberFromPinName,
    isGpioInWindows,
  } from '../../core/vendor-view';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PioPinAssignment>;
    diagnostics: DiagnosticItem[];
    onSetAssignment: (pos: string, binding: PioPinAssignment | null) => void;
  }

  let { chip, assignments, diagnostics, onSetAssignment }: Props = $props();

  const pio = $derived(chip.pio);
  const instances = $derived(pio?.instances ?? []);
  const bases = $derived(pio?.gpioBaseOptions ?? []);
  const windows = $derived(bases.map(formatGpioWindow));

  let selectedPos = $state('');
  let selectedInstance = $state('PIO0');
  let selectedSm = $state(0);
  let selectedRole = $state('TX');

  const gpioPins = $derived(
    chip.pins.filter(
      (pin) => pin.type === 'io' && gpioNumberFromPinName(pin.name) !== null,
    ),
  );

  const bindings = $derived.by(() =>
    Object.entries(assignments)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([pos, binding]) => {
        const pin = chip.pins.find((p) => p.pos === pos);
        const gpio = pin ? gpioNumberFromPinName(pin.name) : null;
        return {
          pos,
          pinName: pin?.name ?? pos,
          gpio,
          binding,
          inWindow: gpio === null || isGpioInWindows(gpio, bases),
        };
      }),
  );

  const baseDiagnostics = $derived(
    diagnostics.filter((d) => d.code === 'PIO_GPIOBASE_CONFLICT'),
  );

  $effect(() => {
    if (instances.length > 0 && !instances.includes(selectedInstance)) {
      selectedInstance = instances[0];
    }
    if (!selectedPos && gpioPins.length > 0) selectedPos = gpioPins[0].pos;
  });

  function bindPin(): void {
    if (!selectedPos) return;
    onSetAssignment(selectedPos, {
      instance: selectedInstance,
      sm: selectedSm,
      role: selectedRole.trim() || 'signal',
    });
  }
</script>

<div class="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
  {#if !pio}
    <div class="p-6 text-center text-muted">
      This chip has no programmable I/O block.
    </div>
  {:else}
    <section class="space-y-1.5">
      <h3 class="text-[11px] font-semibold text-muted uppercase tracking-wide">
        GPIOBASE windows
      </h3>
      {#if windows.length === 0}
        <p class="text-muted">No GPIOBASE window declared by this chip.</p>
      {:else}
        <div class="flex flex-wrap gap-1.5">
          {#each windows as window (window)}
            <span class="px-2 py-1 rounded border border-hairline bg-subtle font-mono text-primary">
              {window}
            </span>
          {/each}
        </div>
        <p class="text-[11px] text-faint">
          PIO state machines may only address pins inside one of these 32-pin windows.
        </p>
      {/if}
    </section>

    {#if baseDiagnostics.length > 0}
      <section class="rounded-lg border border-pin-conflict bg-danger-soft p-2.5 space-y-1">
        <h3 class="text-[11px] font-semibold text-danger">GPIOBASE errors</h3>
        {#each baseDiagnostics as diag (diag.id)}
          <p class="text-[11px] text-primary leading-relaxed">{diag.message}</p>
        {/each}
      </section>
    {/if}

    <section class="space-y-1.5">
      <h3 class="text-[11px] font-semibold text-muted uppercase tracking-wide">
        Active PIO bindings ({bindings.length})
      </h3>
      {#if bindings.length === 0}
        <p class="text-[11px] text-muted">
          No PIO bindings yet. Allocate a state machine below or assign a PIO signal from the peripheral tree.
        </p>
      {:else}
        <div class="space-y-1">
          {#each bindings as item (item.pos)}
            <div
              class={`rounded border p-2 flex items-center justify-between gap-2 ${
                item.inWindow ? 'border-hairline bg-subtle' : 'border-pin-conflict bg-danger-soft'
              }`}
            >
              <div class="min-w-0 space-y-0.5">
                <div class="font-mono font-medium text-primary truncate">
                  {item.pinName} <span class="text-muted">({item.pos})</span>
                </div>
                <div class="font-mono-tabular text-[11px] text-muted">
                  {item.binding.instance} · SM{item.binding.sm ?? 0} · {item.binding.role ?? 'signal'}
                </div>
                {#if !item.inWindow}
                  <div class="text-[11px] text-danger">
                    Outside every GPIOBASE window{item.gpio === null ? ' (no GPIO number)' : ` (GPIO${item.gpio})`}
                  </div>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => onSetAssignment(item.pos, null)}
                title="Clear PIO binding"
                class="p-1 rounded hover:bg-elevated text-faint hover:text-danger shrink-0"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="rounded-lg border border-hairline bg-subtle p-2.5 space-y-2">
      <h3 class="text-[11px] font-semibold text-muted uppercase tracking-wide">
        Allocate state machine
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1">
          <span class="block text-[11px] text-muted">Pin</span>
          <select
            bind:value={selectedPos}
            class="w-full px-1.5 py-1 rounded border border-hairline bg-surface text-primary font-mono text-[11px] focus:outline-none focus:border-hint"
          >
            {#each gpioPins as pin (pin.pos)}
              <option value={pin.pos}>{pin.name} ({pin.pos})</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1">
          <span class="block text-[11px] text-muted">Instance</span>
          <select
            bind:value={selectedInstance}
            class="w-full px-1.5 py-1 rounded border border-hairline bg-surface text-primary font-mono text-[11px] focus:outline-none focus:border-hint"
          >
            {#each instances as instance (instance)}
              <option value={instance}>{instance}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1">
          <span class="block text-[11px] text-muted">State machine</span>
          <select
            bind:value={selectedSm}
            class="w-full px-1.5 py-1 rounded border border-hairline bg-surface text-primary font-mono text-[11px] focus:outline-none focus:border-hint"
          >
            {#each Array.from({ length: pio.stateMachinesPerInstance }, (_, i) => i) as sm (sm)}
              <option value={sm}>SM{sm}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1">
          <span class="block text-[11px] text-muted">Role</span>
          <input
            bind:value={selectedRole}
            type="text"
            placeholder="TX"
            class="w-full px-1.5 py-1 rounded border border-hairline bg-surface text-primary font-mono text-[11px] focus:outline-none focus:border-hint"
          />
        </label>
      </div>
      <button
        type="button"
        onclick={bindPin}
        disabled={!selectedPos}
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-action hover:bg-action-hover text-on-action font-medium disabled:opacity-40"
      >
        <Plus class="w-3 h-3" />
        Bind pin
      </button>
    </section>
  {/if}
</div>
