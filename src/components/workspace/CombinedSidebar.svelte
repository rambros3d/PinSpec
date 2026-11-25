<script lang="ts">
  /**
   * Left-pane surface that keeps the narrow peripheral tree and the peripheral
   * detail column adjacent. The tree defaults to 160px and clamps to
   * 120-240px; the detail column keeps a 260-320px minimum. Placement controls
   * live in the right summary drawer, not in this sidebar.
   */
  import {
    type ChipData,
    type PeripheralStatus,
    type PinAssignment,
  } from '../../core/types';
  import { viewPreferences } from '../../state/workspace-preferences.svelte';
  import PeripheralDetail from './PeripheralDetail.svelte';
  import PeripheralTree from './PeripheralTree.svelte';

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
  </div>
</div>
