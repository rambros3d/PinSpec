<script lang="ts">
  import type { Snippet } from 'svelte';
  import PinoutDiffModal from '../workspace/PinoutDiffModal.svelte';
  import ShortcutHelpDialog from '../workspace/ShortcutHelpDialog.svelte';
  import { router } from '../../state/router.svelte';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import GlobalNavBar from './GlobalNavBar.svelte';
  import WorkspaceTopBar from './WorkspaceTopBar.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  const isWorkspaceView = $derived(
    router.route.view === 'workspace' || router.route.view === 'shared',
  );
</script>

<!-- One navigation bar on every route, one action bar on workspace routes, and one instance of each shared dialog. -->
<div class="app-shell">
  <GlobalNavBar />
  {#if isWorkspaceView}
    <WorkspaceTopBar />
  {/if}
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
