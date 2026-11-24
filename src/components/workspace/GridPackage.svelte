<script module lang="ts">
  // Module-scoped counter: unique SVG defs ids per instance without reading
  // reactive props during initialization.
  let surfaceCounter = 0;

  function nextSurfaceId(): string {
    surfaceCounter += 1;
    return `ic-grid-${surfaceCounter}`;
  }
</script>

<script lang="ts">
  import {
    formatMuxLabel,
    type ChipData,
    type MuxModel,
    type PinAssignment,
    type PinInfo,
    type PinVisualStatus,
  } from '../../core/types';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pinStatus: Record<string, PinVisualStatus>;
    zoom?: number;
    muxModel?: MuxModel;
    highlightedPins?: Set<string>;
    remapSourcePos?: string | null;
    selectedPinPos?: string | null;
    onPinClick?: (pin: PinInfo, event: MouseEvent) => void;
    onPinContextMenu?: (pin: PinInfo, event: MouseEvent) => void;
    onPinHover?: (pin: PinInfo | null, event?: MouseEvent) => void;
  }

  let {
    chip,
    assignments,
    labels,
    locked,
    pinStatus,
    zoom = 1,
    muxModel = 'af',
    highlightedPins = new Set<string>(),
    remapSourcePos = null,
    selectedPinPos = null,
    onPinClick,
    onPinContextMenu,
    onPinHover,
  }: Props = $props();

  const surfaceId = nextSurfaceId();

  const layout = $derived.by(() => {
    const rows = chip.package.rows ?? [];
    const cols = chip.package.cols ?? [];
    const cellSize = 46;
    const headerPad = 44;
    const outerPad = 24;

    const gridWidth = cols.length * cellSize;
    const gridHeight = rows.length * cellSize;
    const totalWidth = headerPad + gridWidth + outerPad * 2;
    const totalHeight = headerPad + gridHeight + outerPad * 2 + 28;

    const rowIndex = new Map<string, number>(rows.map((r, i) => [r, i]));
    const colIndex = new Map<number, number>(cols.map((c, i) => [c, i]));

    const balls: Array<{ pin: PinInfo; cx: number; cy: number; row: string; col: number }> = [];
    for (const pin of chip.pins) {
      const m = pin.pos.match(/^([A-Z]{1,2})(\d+)$/);
      if (!m) continue;
      const ri = rowIndex.get(m[1]);
      const ci = colIndex.get(Number.parseInt(m[2], 10));
      if (ri === undefined || ci === undefined) continue;
      balls.push({
        pin,
        row: m[1],
        col: Number.parseInt(m[2], 10),
        cx: outerPad + headerPad + ci * cellSize + cellSize / 2,
        cy: outerPad + headerPad + ri * cellSize + cellSize / 2,
      });
    }

    return {
      rows,
      cols,
      cellSize,
      headerPad,
      outerPad,
      gridWidth,
      gridHeight,
      totalWidth,
      totalHeight,
      balls,
    };
  });

  function getBallColors(pos: string): { fill: string; stroke: string } {
    if (remapSourcePos === pos) {
      return { fill: 'var(--pin-selected-fill)', stroke: 'var(--pin-remap)' };
    }
    if (highlightedPins.has(pos)) {
      return { fill: 'var(--pin-remap-fill)', stroke: 'var(--pin-remap)' };
    }
    const status = pinStatus[pos] ?? 'unused';
    const isSelected = selectedPinPos === pos;
    switch (status) {
      case 'power':
        return { fill: 'var(--pin-power-fill)', stroke: 'var(--pin-power)' };
      case 'assigned':
        return { fill: 'var(--pin-assigned-fill)', stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-assigned)' };
      case 'partial':
        return { fill: 'var(--pin-partial-fill)', stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-partial)' };
      case 'conflict':
        return { fill: 'var(--pin-conflict-fill)', stroke: 'var(--pin-conflict)' };
      default:
        return { fill: 'var(--pin-unused-fill)', stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-unused)' };
    }
  }

  function compactLabel(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }
</script>

<svg
  viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
  width={layout.totalWidth}
  height={layout.totalHeight}
  class="select-none text-primary overflow-visible"
  role="img"
  aria-label={`${chip.id} ${chip.package.name} BGA matrix diagram`}
>
  <defs>
    <clipPath id={`${surfaceId}-clip`}>
      <rect
        x={layout.outerPad + layout.headerPad - 8}
        y={layout.outerPad + layout.headerPad - 8}
        width={layout.gridWidth + 16}
        height={layout.gridHeight + 16}
        rx="8"
      />
    </clipPath>
    <linearGradient id={`${surfaceId}-depth`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--color-ic-top)" />
      <stop offset="100%" stop-color="var(--color-ic-bottom)" />
    </linearGradient>
    <filter id={`${surfaceId}-noise`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer><feFuncA type="linear" slope="0.16" /></feComponentTransfer>
    </filter>
  </defs>

  <!-- Substrate Frame -->
  <rect
    x={layout.outerPad + layout.headerPad - 8}
    y={layout.outerPad + layout.headerPad - 8}
    width={layout.gridWidth + 16}
    height={layout.gridHeight + 16}
    rx="8"
    class="fill-ic-body stroke-hairline"
    stroke-width="2"
    style={`filter: drop-shadow(0 3px 5px color-mix(in oklab, var(--color-neutral) 55%, transparent));`}
  />
  <rect
    x={layout.outerPad + layout.headerPad - 8}
    y={layout.outerPad + layout.headerPad - 8}
    width={layout.gridWidth + 16}
    height={layout.gridHeight + 16}
    rx="8"
    fill={`url(#${surfaceId}-depth)`}
    opacity="0.55"
    pointer-events="none"
  />
  <rect
    x={layout.outerPad + layout.headerPad - 8}
    y={layout.outerPad + layout.headerPad - 8}
    width={layout.gridWidth + 16}
    height={layout.gridHeight + 16}
    rx="8"
    fill="currentColor"
    filter={`url(#${surfaceId}-noise)`}
    clip-path={`url(#${surfaceId}-clip)`}
    style="mix-blend-mode: overlay;"
    opacity="0.7"
    pointer-events="none"
  />

  <!-- Pin A1 Corner Chamfer Indicator -->
  <path
    d={`M ${layout.outerPad + layout.headerPad - 8} ${layout.outerPad + layout.headerPad + 16} L ${layout.outerPad + layout.headerPad + 16} ${layout.outerPad + layout.headerPad - 8}`}
    class="stroke-pin-power"
    stroke-width="2.5"
  />
  <text
    x={layout.outerPad + layout.headerPad - 12}
    y={layout.outerPad + layout.headerPad - 14}
    text-anchor="end"
    class="font-mono font-semibold fill-pin-power"
    font-size="10"
  >
    A1
  </text>

  <!-- Top Column Labels -->
  {#each layout.cols as col, ci}
    <text
      x={layout.outerPad + layout.headerPad + ci * layout.cellSize + layout.cellSize / 2}
      y={layout.outerPad + layout.headerPad - 16}
      text-anchor="middle"
      class="font-mono fill-muted font-medium"
      font-size="11"
    >
      {col}
    </text>
  {/each}

  <!-- Left Row Labels -->
  {#each layout.rows as row, ri}
    <text
      x={layout.outerPad + layout.headerPad - 18}
      y={layout.outerPad + layout.headerPad + ri * layout.cellSize + layout.cellSize / 2 + 4}
      text-anchor="end"
      class="font-mono fill-muted font-medium"
      font-size="11"
    >
      {row}
    </text>
  {/each}

  <!-- BGA Balls (Zoom-Adaptive Detail) -->
  {#each layout.balls as ball (ball.pin.pos)}
    {@const colors = getBallColors(ball.pin.pos)}
    {@const asgn = assignments[ball.pin.pos]}
    {@const lbl = labels[ball.pin.pos]?.trim()}
    {@const isHighlighted = highlightedPins.has(ball.pin.pos)}
    {@const isLocked = Boolean(locked[ball.pin.pos])}
    {@const r = layout.cellSize * 0.43}

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      data-pin-pos={ball.pin.pos}
      class={ball.pin.type === 'io' ? 'cursor-pointer' : 'cursor-default'}
      onclick={(e) => {
        e.stopPropagation();
        onPinClick?.(ball.pin, e);
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPinContextMenu?.(ball.pin, e);
      }}
      onmouseenter={(e) => onPinHover?.(ball.pin, e)}
      onmouseleave={() => onPinHover?.(null)}
    >
      {#if isHighlighted}
        <circle
          cx={ball.cx}
          cy={ball.cy}
          r={r + 3}
          fill="none"
          stroke="var(--pin-remap)"
          stroke-width="2"
          class="animate-pin-pulse"
        />
      {/if}

      <circle
        cx={ball.cx}
        cy={ball.cy}
        r={r}
        fill={colors.fill}
        stroke={colors.stroke}
        stroke-width={isHighlighted || selectedPinPos === ball.pin.pos ? 2 : 1.3}
      />

      <!-- Low zoom: crisp port name or ball coord -->
      {#if zoom < 1.05}
        <text
          x={ball.cx}
          y={ball.cy + 3.5}
          text-anchor="middle"
          class="font-mono font-medium fill-primary pointer-events-none"
          font-size="8.5"
        >
          {compactLabel(ball.pin.name, 5)}
        </text>
      {:else if zoom < 1.75}
        <!-- Medium zoom: port name + assigned signal -->
        <text
          x={ball.cx}
          y={asgn ? ball.cy - 2 : ball.cy + 3}
          text-anchor="middle"
          class="font-mono font-semibold fill-primary pointer-events-none"
          font-size="8.5"
        >
          {compactLabel(ball.pin.name, 6)}
        </text>
        {#if asgn}
          <text
            x={ball.cx}
            y={ball.cy + 8.5}
            text-anchor="middle"
            class="font-mono fill-pin-text pointer-events-none"
            font-size="6.8"
          >
            {compactLabel(`${asgn.peripheral}_${asgn.signal} ${formatMuxLabel(asgn, muxModel)}`, 12)}
          </text>
        {/if}
      {:else}
        <!-- High zoom: coordinate + port name + signal + net label -->
        <text
          x={ball.cx}
          y={ball.cy - 8.5}
          text-anchor="middle"
          class="font-mono fill-muted pointer-events-none"
          font-size="6"
        >
          {ball.pin.pos}
        </text>
        <text
          x={ball.cx}
          y={ball.cy - 0.5}
          text-anchor="middle"
          class="font-mono font-semibold fill-primary pointer-events-none"
          font-size="7.5"
        >
          {compactLabel(ball.pin.name, 7)}
        </text>
        {#if asgn}
          <text
            x={ball.cx}
            y={ball.cy + 7.5}
            text-anchor="middle"
            class="font-mono fill-pin-text pointer-events-none"
            font-size="6"
          >
            {compactLabel(`${asgn.peripheral}_${asgn.signal} ${formatMuxLabel(asgn, muxModel)}`, 13)}
          </text>
        {/if}
        {#if lbl}
          <text
            x={ball.cx}
            y={ball.cy + 14}
            text-anchor="middle"
            class="font-mono fill-hint pointer-events-none"
            font-size="5.5"
          >
            {compactLabel(lbl, 10)}
          </text>
        {/if}
      {/if}

      {#if isLocked}
        <circle
          cx={ball.cx + r - 3}
          cy={ball.cy - r + 3}
          r="3.2"
          fill="var(--pin-power)"
          class="pointer-events-none"
        />
      {/if}
    </g>
  {/each}

  <!-- Bottom Package Spec Footer -->
  <text
    x={layout.outerPad + layout.headerPad + layout.gridWidth / 2}
    y={layout.totalHeight - 8}
    text-anchor="middle"
    class="font-mono fill-muted"
    font-size="12"
  >
    {chip.id} · {chip.package.name} ({chip.package.pinCount} balls) · {chip.core}
  </text>
</svg>
