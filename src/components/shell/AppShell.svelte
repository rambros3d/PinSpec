<script lang="ts">
  import type { Snippet } from 'svelte';
  import PinoutDiffModal from '../workspace/PinoutDiffModal.svelte';
  import ShortcutHelpDialog from '../workspace/ShortcutHelpDialog.svelte';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import GlobalSidebar from './GlobalSidebar.svelte';
  import GlobalTopBar from './GlobalTopBar.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<!-- One bar, one sidebar, and one instance of each shared dialog for every route. -->
<div class="app-shell">
  <GlobalTopBar />
  <GlobalSidebar />
  <div class="app-shell-content">
    {@render children?.()}
  </div>
  {#if topBarUI.activeDialog === 'diff'}
    <PinoutDiffModal onClose={() => (topBarUI.diffOpen = false)} />
  {/if}
  {#if topBarUI.activeDialog === 'shortcutHelp'}
    <ShortcutHelpDialog onClose={() => (topBarUI.shortcutHelpOpen = false)} />
  {/if}
</div>
