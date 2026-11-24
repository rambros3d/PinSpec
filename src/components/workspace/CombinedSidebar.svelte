<script lang="ts">
  /**
   * Left-pane surface that keeps the narrow peripheral tree, the peripheral
   * detail column and the Place section adjacent. The tree defaults to 160px
   * and clamps to 120-240px; the detail column keeps a 260-320px minimum.
   */
  import {
    type ChipData,
    type PeripheralStatus,
    type PinAssignment,
  } from '../../core/types';
  import {
    SIDEBAR_SECTIONS,
    viewPreferences,
    type SidebarSection,
  } from '../../state/workspace-preferences.svelte';
  import PeripheralDetail from './PeripheralDetail.svelte';
  import PeripheralTree from './PeripheralTree.svelte';
  import PlacementPanel from './PlacementPanel.svelte';

  interface Props {
    chip: ChipData;
    peripheralStatus: Record<string, PeripheralStatus>;
    peripheralModes: Record<string, string>;
    assignments: Record<string, PinAssignment>;
    activeRemaps: Record<string, number>;
    onSelectPeripheral: (name: string) => void;
    onModeChange: (peripheralName: string, modeId: string) => void;
    onRemapChange: (peripheralName: string, remapId: number) => void;
    onToggleSignal: (peripheralName: string, signal: string) => void;
    onFocusPin: (pos: string) => void;
  }

  let {
    chip,
    peripheralStatus,
    peripheralModes,
    assignments,
    activeRemaps,
    onSelectPeripheral,
    onModeChange,
    onRemapChange,
    onToggleSignal,
    onFocusPin,
  }: Props = $props();

  let treeWidth = $state(160);

  /** Clamp the internal split without ever collapsing either column. */
  function startTreeResize(e: PointerEvent): void {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treeWidth;
    const onMove = (ev: PointerEvent) => {
      treeWidth = Math.max(120, Math.min(240, startWidth + ev.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function selectSection(section: SidebarSection): void {
    viewPreferences.sidebarSection = section;
  }
</script>

<div
  class="combined-sidebar h-full min-h-0 flex flex-row bg-base-100 overflow-hidden"
  style={`--tree-column-width: ${treeWidth}px;`}
>
  <div class="combined-tree-column shrink-0 h-full min-h-0">
    <PeripheralTree
      {chip}
      {peripheralStatus}
      {peripheralModes}
      {onSelectPeripheral}
    />
  </div>

  <div
    class="combined-tree-resizer w-1 shrink-0 cursor-col-resize hover:bg-primary/60 transition-colors"
    onpointerdown={startTreeResize}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize peripheral tree column"
  ></div>

  <div class="combined-detail-column flex-1 min-w-[260px] h-full min-h-0 flex flex-col">
    <div
      role="tablist"
      aria-label="Sidebar section"
      class="combined-section-switcher shrink-0 flex items-center gap-1 border-b border-base-300 bg-base-200 px-2 py-1.5"
    >
      {#each SIDEBAR_SECTIONS as section (section)}
        <button
          type="button"
          role="tab"
          onclick={() => selectSection(section)}
          aria-selected={viewPreferences.sidebarSection === section}
          class={`tab text-xs font-medium whitespace-nowrap ${
            viewPreferences.sidebarSection === section
              ? 'tab-active bg-base-100 text-foreground'
              : 'text-base-content/60 hover:text-foreground'
          }`}
        >
          {section === 'detail' ? 'Detail' : 'Place'}
        </button>
      {/each}
    </div>

    {#if viewPreferences.sidebarSection === 'place'}
      <PlacementPanel
        {chip}
        {peripheralStatus}
        {peripheralModes}
        {assignments}
      />
    {:else}
      <PeripheralDetail
        {chip}
        peripheralName={viewPreferences.selectedPeripheral}
        {assignments}
        {peripheralModes}
        {peripheralStatus}
        {activeRemaps}
        {onModeChange}
        {onRemapChange}
        {onToggleSignal}
        {onFocusPin}
      />
    {/if}
  </div>
</div>
