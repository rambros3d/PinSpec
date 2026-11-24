<script lang="ts">
  import { Check, Copy, Download, Upload, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { exportCHeader } from '../../core/exporters/c-header';
  import { exportCsv } from '../../core/exporters/csv';
  import { exportEmbassyRust } from '../../core/exporters/embassy-rust';
  import { exportPinoutJson, parsePinoutJson } from '../../core/exporters/json';
  import type { ChipData, WorkspaceState } from '../../core/types';

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

  const previewContent = $derived.by(() => {
    switch (activeTab) {
      case 'rust':
        return exportEmbassyRust(chip, wsState);
      case 'c':
        return exportCHeader(chip, wsState);
      case 'csv':
        return exportCsv(chip, wsState, includeUnassignedCsv);
      case 'json':
        return exportPinoutJson(wsState);
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
  class="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4"
  onclick={onClose}
>
  <div
    class="w-full max-w-3xl max-h-[84vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121722] shadow-2xl overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Export and import pinout"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
      <div>
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Export & Share Pinout
        </h2>
        <p class="text-xs font-mono text-slate-500 dark:text-slate-400">
          {chip.id} · {chip.package.name} · {Object.keys(wsState.assignments).length} assigned pins
        </p>
      </div>
      <button
        type="button"
        onclick={onClose}
        class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Format Tabs -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e131d]">
      <div class="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#0b0e14]">
        {#each [
          { id: 'rust', label: 'Embassy Rust' },
          { id: 'c', label: 'C Header' },
          { id: 'csv', label: 'CSV' },
          { id: 'json', label: 'JSON' },
          { id: 'share', label: 'Share URL' },
        ] as tab (tab.id)}
          <button
            type="button"
            onclick={() => (activeTab = tab.id as TabId)}
            class={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#1a2233] text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-2">
        {#if activeTab === 'csv'}
          <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer mr-1">
            <input type="checkbox" bind:checked={includeUnassignedCsv} class="rounded" />
            <span>Include unassigned</span>
          </label>
        {/if}

        <button
          type="button"
          onclick={copyContent}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap"
        >
          {#if copied}
            <Check class="w-3.5 h-3.5 text-emerald-500" />
            <span>Copied</span>
          {:else}
            <Copy class="w-3.5 h-3.5" />
            <span>Copy</span>
          {/if}
        </button>

        {#if activeTab !== 'share'}
          <button
            type="button"
            onclick={downloadFile}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white whitespace-nowrap"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- JSON Import Dropzone -->
    {#if activeTab === 'json'}
      <div
        class={`mx-5 mt-3 p-3 rounded-lg border border-dashed text-xs flex items-center justify-between gap-3 transition-colors ${
          draggingFile
            ? 'border-sky-500 bg-sky-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0e131d]'
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
        <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Upload class="w-4 h-4 text-sky-500 shrink-0" />
          <span>Drag and drop a <code class="font-mono">pinout.json</code> file here to import, or choose a file.</span>
        </div>
        <button
          type="button"
          onclick={() => fileInput?.click()}
          class="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121722] hover:border-sky-500 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap"
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
        <p class="mx-5 mt-2 text-xs text-red-500">{importError}</p>
      {/if}
    {/if}

    <!-- Monospace Code Preview -->
    <div class="flex-1 overflow-auto p-5">
      <pre class="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b0e14] font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">{previewContent}</pre>
    </div>
  </div>
</div>
