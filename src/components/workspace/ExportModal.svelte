<script lang="ts">
  import { Check, Copy, Download, Upload, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { exportCHeader } from '../../core/exporters/c-header';
  import { exportCsv } from '../../core/exporters/csv';
  import { exportEmbassyRust } from '../../core/exporters/embassy-rust';
  import { exportPinoutJson, parsePinoutJson } from '../../core/exporters/json';
  import { buildHardwareAudit, formatHardwareAuditText } from '../../core/hardware-audit';
  import { getChipVendor, type ChipData, type WorkspaceState } from '../../core/types';
  import { workspaceStore } from '../../state/workspace.svelte';
  import { openDialogWithFocus } from '../../state/dialog-focus';

  interface Props {
    chip: ChipData;
    state: WorkspaceState;
    shareUrl: string;
    onImportState: (imported: WorkspaceState) => void;
    onClose: () => void;
  }

  let { chip, state: wsState, shareUrl, onImportState, onClose }: Props = $props();

  type TabId = 'rust' | 'c' | 'csv' | 'json' | 'audit' | 'share';

  let activeTab = $state<TabId>('rust');
  let includeUnassignedCsv = $state(false);
  let copied = $state(false);
  let importError = $state<string | null>(null);
  let draggingFile = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let copyButtonEl = $state<HTMLButtonElement | null>(null);

  const vendor = $derived(getChipVendor(chip));

  const rustTabLabel = $derived.by(() => {
    if (vendor === 'rp') return 'Rust · embassy-rp';
    if (vendor === 'ch32') return 'Rust · ch32-hal';
    if (vendor === 'esp32') return 'Rust · esp-hal';
    return 'Rust · embassy-stm32';
  });

  const formatTabs = $derived([
    { id: 'rust' as TabId, label: rustTabLabel },
    { id: 'c' as TabId, label: 'C Header' },
    { id: 'csv' as TabId, label: 'CSV' },
    { id: 'json' as TabId, label: 'JSON' },
    { id: 'audit' as TabId, label: 'Audit' },
    { id: 'share' as TabId, label: 'Share URL' },
  ]);

  const previewContent = $derived.by(() => {
    switch (activeTab) {
      case 'rust':
        return exportEmbassyRust(chip, wsState);
      case 'c':
        return exportCHeader(chip, wsState);
      case 'csv':
        return exportCsv(chip, wsState, includeUnassignedCsv);
      case 'json':
        return exportPinoutJson(wsState, getChipVendor(chip));
      case 'audit':
        return formatHardwareAuditText(buildHardwareAudit(chip, wsState));
      case 'share':
        return shareUrl;
    }
  });

  const downloadFilename = $derived.by(() => {
    const id = chip.id.toLowerCase();
    switch (activeTab) {
      case 'rust':
        return `${id}_pins.rs`;
      case 'c':
        return `${id}_pinout.h`;
      case 'csv':
        return `${id}_pinout.csv`;
      case 'json':
        return `${id}_pinout.json`;
      case 'audit':
        return `${id}_hardware_audit.txt`;
      case 'share':
        return `${id}_share_url.txt`;
    }
  });

  async function copyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(previewContent);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      workspaceStore.showToast('Unable to copy the export preview. Check clipboard access.', 'warning');
    }
  }

  function downloadFile(): void {
    try {
      const blob = new Blob([previewContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      workspaceStore.showToast('Unable to start the export download.', 'warning');
    }
  }

  /** Native dialog close path; the close event notifies the parent once. */
  function closeDialog(): void {
    dialogEl?.close();
  }

  async function handleFile(file: File): Promise<void> {
    importError = null;
    const text = await file.text();
    const parsed = parsePinoutJson(text);
    if (!parsed.ok) {
      importError = parsed.error;
      return;
    }
    onImportState(parsed.state);
    closeDialog();
  }

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogEl?.open) dialogEl?.showModal();
    openDialogWithFocus(dialogEl, copyButtonEl, opener);
  });
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclose={onClose}
  oncancel={(e) => {
    e.preventDefault();
    closeDialog();
  }}
  onclick={(e) => {
    if (e.target === dialogEl) closeDialog();
  }}
  aria-label="Export and import pinout"
>
  <div
    class="modal-box w-full max-w-3xl max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-base-300">
      <div>
        <h2 class="text-sm font-semibold text-foreground">
          Export & Share Pinout
        </h2>
        <p class="text-xs font-mono text-base-content/60">
          {chip.id} · {chip.package.name} · {Object.keys(wsState.assignments).length} assigned pins
        </p>
      </div>
      <button
        type="button"
        onclick={closeDialog}
        class="btn btn-ghost btn-sm btn-square"
        aria-label="Close export dialog"
      >
        <X class="size-4" />
      </button>
    </div>

    <!-- Format Tabs -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-base-300 bg-base-200">
      <div role="tablist" class="tabs tabs-box flex items-center gap-1 p-0.5 rounded-box bg-base-300">
        {#each formatTabs as tab (tab.id)}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onclick={() => (activeTab = tab.id)}
            class={`tab px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'tab-active bg-base-100 text-foreground shadow-xs'
                : 'text-base-content/60 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-2">
        {#if activeTab === 'csv'}
          <label class="flex items-center gap-1.5 text-xs text-base-content/60 cursor-pointer mr-1">
            <input type="checkbox" bind:checked={includeUnassignedCsv} class="checkbox checkbox-sm" />
            <span>Include unassigned</span>
          </label>
        {/if}

        <button
          bind:this={copyButtonEl}
          type="button"
          onclick={copyContent}
          class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
        >
          {#if copied}
            <Check class="size-3.5 text-success" />
            <span>Copied</span>
          {:else}
            <Copy class="size-3.5" />
            <span>Copy</span>
          {/if}
        </button>

        {#if activeTab !== 'share'}
          <button
            type="button"
            onclick={downloadFile}
            class="btn btn-sm btn-primary gap-1.5 text-xs font-semibold whitespace-nowrap"
          >
            <Download class="size-3.5" />
            <span>Download</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- JSON Import Dropzone -->
    {#if activeTab === 'json'}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={`mx-5 mt-3 p-3 rounded-box border border-dashed text-xs flex items-center justify-between gap-3 transition-colors ${
          draggingFile
            ? 'border-info bg-info/15'
            : 'border-base-content/20 bg-base-200'
        }`}
        ondragover={(e) => {
          e.preventDefault();
          draggingFile = true;
        }}
        ondragleave={() => (draggingFile = false)}
        ondrop={(e) => {
          e.preventDefault();
          draggingFile = false;
          const file = e.dataTransfer?.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <div class="flex items-center gap-2 text-base-content/60">
          <Upload class="size-4 text-info shrink-0" />
          <span>Drag and drop a <code class="font-mono">pinout.json</code> file here to import, or choose a file.</span>
        </div>
        <button
          type="button"
          onclick={() => fileInput?.click()}
          class="btn btn-sm btn-outline font-medium whitespace-nowrap"
        >
          Browse JSON
        </button>
        <input
          bind:this={fileInput}
          type="file"
          accept=".json,application/json"
          class="hidden"
          onchange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {#if importError}
        <p role="alert" class="alert alert-error mx-5 mt-2 text-xs">{importError}</p>
      {/if}
    {/if}

    <!-- Monospace Code Preview -->
    <div class="flex-1 min-h-0 overflow-auto p-5">
      <pre class="p-4 rounded-box border border-base-300 bg-base-200 font-mono text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre-wrap break-all">{previewContent}</pre>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close export dialog">close</button>
  </form>
</dialog>
