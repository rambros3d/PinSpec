<script lang="ts">
  import { Check, Copy, Download, Upload, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { exportCHeader } from '../../core/exporters/c-header';
  import { exportCsv } from '../../core/exporters/csv';
  import { exportEmbassyRust } from '../../core/exporters/embassy-rust';
  import { exportPinoutJson, parsePinoutJson } from '../../core/exporters/json';
  import { getChipVendor, type ChipData, type WorkspaceState } from '../../core/types';

  interface Props {
    chip: ChipData;
    state: WorkspaceState;
    shareUrl: string;
    onImportState: (imported: WorkspaceState) => void;
    onClose: () => void;
  }

  let { chip, state: wsState, shareUrl, onImportState, onClose }: Props = $props();

  type TabId = 'rust' | 'c' | 'csv' | 'json' | 'share';

  let activeTab = $state<TabId>('rust');
  let includeUnassignedCsv = $state(false);
  let copied = $state(false);
  let importError = $state<string | null>(null);
  let draggingFile = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  const vendor = $derived(getChipVendor(chip));

  const rustTabLabel = $derived.by(() => {
    if (vendor === 'rp') return 'Rust · embassy-rp';
    if (vendor === 'ch32') return 'Rust · ch32-hal';
    return 'Rust · embassy-stm32';
  });

  const formatTabs = $derived([
    { id: 'rust' as TabId, label: rustTabLabel },
    { id: 'c' as TabId, label: 'C Header' },
    { id: 'csv' as TabId, label: 'CSV' },
    { id: 'json' as TabId, label: 'JSON' },
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
      // fallback ignored
    }
  }

  function downloadFile(): void {
    const blob = new Blob([previewContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    a.click();
    URL.revokeObjectURL(url);
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
    onClose();
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4"
  onclick={onClose}
>
  <div
    class="w-full max-w-3xl max-h-[92dvh] min-h-0 flex flex-col rounded-panel border-ui border-hairline bg-surface shadow-2xl overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Export and import pinout"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-ui-b border-hairline">
      <div>
        <h2 class="text-sm font-semibold text-primary">
          Export & Share Pinout
        </h2>
        <p class="text-xs font-mono text-muted">
          {chip.id} · {chip.package.name} · {Object.keys(wsState.assignments).length} assigned pins
        </p>
      </div>
      <button
        type="button"
        onclick={onClose}
        class="p-1.5 rounded-control hover:bg-elevated text-muted"
      >
        <X class="size-ui" />
      </button>
    </div>

    <!-- Format Tabs -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-ui-b border-hairline bg-subtle">
      <div class="flex items-center gap-1 p-0.5 rounded-panel bg-elevated">
        {#each formatTabs as tab (tab.id)}
          <button
            type="button"
            onclick={() => (activeTab = tab.id)}
            class={`px-3 py-1 rounded-control text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-2">
        {#if activeTab === 'csv'}
          <label class="flex items-center gap-1.5 text-xs text-muted cursor-pointer mr-1">
            <input type="checkbox" bind:checked={includeUnassignedCsv} class="rounded-control" />
            <span>Include unassigned</span>
          </label>
        {/if}

        <button
          type="button"
          onclick={copyContent}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border-ui border-hairline hover:bg-elevated text-xs font-medium text-primary whitespace-nowrap"
        >
          {#if copied}
            <Check class="size-ui-md text-pin-success" />
            <span>Copied</span>
          {:else}
            <Copy class="size-ui-md" />
            <span>Copy</span>
          {/if}
        </button>

        {#if activeTab !== 'share'}
          <button
            type="button"
            onclick={downloadFile}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-action hover:bg-action-hover text-xs font-semibold text-on-action whitespace-nowrap"
          >
            <Download class="size-ui-md" />
            <span>Download</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- JSON Import Dropzone -->
    {#if activeTab === 'json'}
      <div
        class={`mx-5 mt-3 p-3 rounded-panel border-ui border-dashed text-xs flex items-center justify-between gap-3 transition-colors ${
          draggingFile
            ? 'border-hint bg-info-soft'
            : 'border-strong bg-subtle'
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
        <div class="flex items-center gap-2 text-muted">
          <Upload class="size-ui text-hint shrink-0" />
          <span>Drag and drop a <code class="font-mono">pinout.json</code> file here to import, or choose a file.</span>
        </div>
        <button
          type="button"
          onclick={() => fileInput?.click()}
          class="px-2.5 py-1 rounded-control border-ui border-strong bg-surface hover:border-hint font-medium text-primary whitespace-nowrap"
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
        <p class="mx-5 mt-2 text-xs text-danger">{importError}</p>
      {/if}
    {/if}

    <!-- Monospace Code Preview -->
    <div class="flex-1 min-h-0 overflow-auto p-5">
      <pre class="p-4 rounded-panel border-ui border-hairline bg-subtle font-mono text-xs leading-relaxed text-primary overflow-x-auto whitespace-pre-wrap break-all">{previewContent}</pre>
    </div>
  </div>
</div>
