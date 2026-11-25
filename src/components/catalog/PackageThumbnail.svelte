<script lang="ts">
  /**
   * Decorative package outline. It has no interaction surface: catalog rows and
   * session cards own navigation. Colors come only from active theme tokens.
   */
  import {
    thumbnailPadMarks,
    type ThumbnailGeometry,
  } from '../../core/package-thumbnail';

  interface Props {
    geometry: ThumbnailGeometry;
    size?: number;
    label?: string;
  }

  let { geometry, size = 44, label }: Props = $props();
  const marks = $derived(thumbnailPadMarks(geometry));
</script>

<svg
  class="package-thumbnail pointer-events-none shrink-0"
  width={size}
  height={size}
  viewBox="0 0 100 100"
  data-fidelity={geometry.fidelity}
  aria-hidden="true"
  focusable="false"
>
  {#if label}
    <title>{label}</title>
  {/if}
  <rect x="18" y="18" width="64" height="64" rx="3" class="fill-base-100 stroke-base-300" stroke-width="2" />
  {#if geometry.hasExposedPad}
    <rect x="36" y="36" width="28" height="28" rx="2" class="fill-base-300/40 stroke-base-300" stroke-width="1.5" />
  {/if}
  {#each marks as mark (mark.x + ':' + mark.y)}
    {#if mark.kind === 'ball'}
      <circle cx={mark.x} cy={mark.y} r="3" class="fill-base-content/40" />
    {:else}
      <rect x={mark.x - 2} y={mark.y - 2} width="4" height="4" class="fill-base-content/40" />
    {/if}
  {/each}
</svg>
