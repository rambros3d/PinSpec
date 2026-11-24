<script lang="ts">
  import type {
    ChipData,
    PinAssignment,
    PinInfo,
    PinVisualStatus,
  } from '../../core/types';

  interface Props {
    chip: ChipData;
    assignments: Record<string, PinAssignment>;
    labels: Record<string, string>;
    locked: Record<string, boolean>;
    pinStatus: Record<string, PinVisualStatus>;
    highlightedPins?: Set<string>;
    remapSourcePos?: string | null;
    selectedPinPos?: string | null;
    compact?: boolean;
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
    highlightedPins = new Set<string>(),
    remapSourcePos = null,
    selectedPinPos = null,
    compact = false,
    onPinClick,
    onPinContextMenu,
    onPinHover,
  }: Props = $props();

  type Side = 'left' | 'bottom' | 'right' | 'top';

  interface PlacedPin {
    pin: PinInfo;
    side: Side;
    x: number;
    y: number;
    width: number;
    height: number;
  }

  const layout = $derived.by(() => {
    const sides = chip.package.sides ?? [
      Math.ceil(chip.pins.length / 4),
      Math.floor(chip.pins.length / 4),
      Math.ceil(chip.pins.length / 4),
      Math.floor(chip.pins.length / 4),
    ];
    const [leftCount, bottomCount, rightCount, topCount] = sides;
    const maxVertical = Math.max(leftCount, rightCount, 4);
    const maxHorizontal = Math.max(bottomCount, topCount, 4);

    // Scale pitch gracefully for high-pin-count packages (100, 144, 176)
    const pitch = maxVertical > 30 ? 22 : maxVertical > 20 ? 25 : compact ? 26 : 30;
    const padLen = compact ? 52 : 62;
    const padThick = Math.min(pitch - 4, compact ? 20 : 22);
    const cornerMargin = compact ? 24 : 30;
    const labelSpace = compact ? 118 : 165;

    const isTwoSided = bottomCount === 0 && topCount === 0;
    const bodyWidth = isTwoSided
      ? Math.max(170, maxVertical * 9)
      : Math.max(190, maxHorizontal * pitch + cornerMargin * 2);
    const bodyHeight = Math.max(190, maxVertical * pitch + cornerMargin * 2);

    const originX = labelSpace + padLen;
    const originY = (isTwoSided ? 48 : labelSpace) + (isTwoSided ? 0 : padLen);

    const totalWidth = originX * 2 + bodyWidth;
    const totalHeight = originY * 2 + bodyHeight;

    // Sort pins numerically by physical position (1..N)
    const orderedPins = [...chip.pins].sort((a, b) => {
      const na = Number.parseInt(a.pos, 10);
      const nb = Number.parseInt(b.pos, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.pos.localeCompare(b.pos, undefined, { numeric: true });
    });

    const placed: PlacedPin[] = [];
    let idx = 0;

    // Left side: top -> bottom (Pin 1 starts at top-left)
    const leftStartY = originY + (bodyHeight - leftCount * pitch) / 2;
    for (let i = 0; i < leftCount && idx < orderedPins.length; i++, idx++) {
      placed.push({
        pin: orderedPins[idx],
        side: 'left',
        x: originX - padLen,
        y: leftStartY + i * pitch + (pitch - padThick) / 2,
        width: padLen,
        height: padThick,
      });
    }

    // Bottom side: left -> right
    const bottomStartX = originX + (bodyWidth - bottomCount * pitch) / 2;
    for (let i = 0; i < bottomCount && idx < orderedPins.length; i++, idx++) {
      placed.push({
        pin: orderedPins[idx],
        side: 'bottom',
        x: bottomStartX + i * pitch + (pitch - padThick) / 2,
        y: originY + bodyHeight,
        width: padThick,
        height: padLen,
      });
    }

    // Right side: bottom -> top
    const rightStartY = originY + (bodyHeight - rightCount * pitch) / 2;
    for (let i = 0; i < rightCount && idx < orderedPins.length; i++, idx++) {
      const slot = rightCount - 1 - i;
      placed.push({
        pin: orderedPins[idx],
        side: 'right',
        x: originX + bodyWidth,
        y: rightStartY + slot * pitch + (pitch - padThick) / 2,
        width: padLen,
        height: padThick,
      });
    }

    // Top side: right -> left
    const topStartX = originX + (bodyWidth - topCount * pitch) / 2;
    for (let i = 0; i < topCount && idx < orderedPins.length; i++, idx++) {
      const slot = topCount - 1 - i;
      placed.push({
        pin: orderedPins[idx],
        side: 'top',
        x: topStartX + slot * pitch + (pitch - padThick) / 2,
        y: originY - padLen,
        width: padThick,
        height: padLen,
      });
    }

    return {
      placed,
      originX,
      originY,
      bodyWidth,
      bodyHeight,
      totalWidth,
      totalHeight,
      padLen,
      padThick,
      pitch,
    };
  });

  function getColors(pos: string): { fill: string; stroke: string; text: string; tagBg: string } {
    const isHighlighted = highlightedPins.has(pos);
    const isRemapSrc = remapSourcePos === pos;
    const isSelected = selectedPinPos === pos;
    const status = pinStatus[pos] ?? 'unused';

    if (isRemapSrc) {
      return {
        fill: 'var(--pin-selected-fill)',
        stroke: 'var(--pin-remap)',
        text: 'var(--pin-selected-text)',
        tagBg: 'var(--pin-remap-tag)',
      };
    }

    if (isHighlighted) {
      return {
        fill: 'var(--pin-remap-fill)',
        stroke: 'var(--pin-remap)',
        text: 'var(--pin-text)',
        tagBg: 'var(--pin-remap-tag)',
      };
    }

    switch (status) {
      case 'power':
        return {
          fill: 'var(--pin-power-fill)',
          stroke: 'var(--pin-power)',
          text: 'var(--pin-text)',
          tagBg: 'var(--pin-power-tag)',
        };
      case 'assigned':
        return {
          fill: 'var(--pin-assigned-fill)',
          stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-assigned)',
          text: 'var(--pin-text)',
          tagBg: 'var(--pin-assigned-tag)',
        };
      case 'partial':
        return {
          fill: 'var(--pin-partial-fill)',
          stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-partial)',
          text: 'var(--pin-text)',
          tagBg: 'var(--pin-partial-tag)',
        };
      case 'conflict':
        return {
          fill: 'var(--pin-conflict-fill)',
          stroke: 'var(--pin-conflict)',
          text: 'var(--pin-text)',
          tagBg: 'var(--pin-conflict-tag)',
        };
      default:
        return {
          fill: 'var(--pin-unused-fill)',
          stroke: isSelected ? 'var(--pin-remap)' : 'var(--pin-unused)',
          text: 'currentColor',
          tagBg: 'transparent',
        };
    }
  }

  function formatExternalTag(pos: string): string {
    const asgn = assignments[pos];
    const lbl = labels[pos]?.trim();
    if (!asgn && !lbl) return '';
    const sigText = asgn
      ? asgn.peripheral === 'GPIO'
        ? `GPIO_${asgn.signal}`
        : `${asgn.peripheral}_${asgn.signal}`
      : '';
    if (sigText && lbl) return `${sigText} | ${lbl}`;
    return sigText || lbl || '';
  }

  function shortPinName(name: string): string {
    return name.length > 9 ? name.slice(0, 9) : name;
  }
</script>

<svg
  viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
  width={layout.totalWidth}
  height={layout.totalHeight}
  class="select-none text-primary overflow-visible"
  role="img"
  aria-label={`${chip.id} ${chip.package.name} pinout diagram`}
>
  <!-- IC Package Body -->
  <g>
    <rect
      x={layout.originX}
      y={layout.originY}
      width={layout.bodyWidth}
      height={layout.bodyHeight}
      rx="6"
      class="fill-elevated stroke-hairline"
      stroke-width="2"
    />
    <!-- Subtle inner die outline -->
    <rect
      x={layout.originX + 12}
      y={layout.originY + 12}
      width={layout.bodyWidth - 24}
      height={layout.bodyHeight - 24}
      rx="3"
      fill="none"
      class="stroke-hairline"
      stroke-width="1"
    />

    <!-- Pin 1 Chamfer + Orientation Dot at Top-Left -->
    <path
      d={`M ${layout.originX} ${layout.originY + 20} L ${layout.originX + 20} ${layout.originY}`}
      class="stroke-strong"
      stroke-width="1.5"
    />
    <circle
      cx={layout.originX + 22}
      cy={layout.originY + 22}
      r="5"
      class="fill-pin-power"
    />

    <!-- Center IC Marking -->
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 - 10}
      text-anchor="middle"
      class="font-mono fill-primary font-semibold"
      font-size={compact ? 14 : 16}
    >
      {chip.id}
    </text>
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 + 12}
      text-anchor="middle"
      class="font-mono fill-muted"
      font-size={compact ? 11 : 12}
    >
      {chip.package.name} · {chip.core}
    </text>
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 + 29}
      text-anchor="middle"
      class="font-mono fill-faint"
      font-size="10"
    >
      {chip.flashKb} KB Flash · {chip.ramKb} KB RAM
    </text>
  </g>

  <!-- Perimeter Pins -->
  {#each layout.placed as item (item.pin.pos)}
    {@const colors = getColors(item.pin.pos)}
    {@const tag = formatExternalTag(item.pin.pos)}
    {@const isHighlighted = highlightedPins.has(item.pin.pos)}
    {@const isLocked = Boolean(locked[item.pin.pos])}
    {@const isInteractive = item.pin.type === 'io'}
    {@const cx = item.x + item.width / 2}
    {@const cy = item.y + item.height / 2}

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      data-pin-pos={item.pin.pos}
      class={isInteractive ? 'cursor-pointer' : 'cursor-default'}
      onclick={(e) => {
        e.stopPropagation();
        onPinClick?.(item.pin, e);
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPinContextMenu?.(item.pin, e);
      }}
      onmouseenter={(e) => onPinHover?.(item.pin, e)}
      onmouseleave={() => onPinHover?.(null)}
    >
      <!-- Pad rectangle -->
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx="2.5"
        fill={colors.fill}
        stroke={colors.stroke}
        stroke-width={isHighlighted || selectedPinPos === item.pin.pos ? 2 : 1.2}
        class={isHighlighted ? 'animate-pin-pulse' : ''}
      />

      <!-- Pin Port Name inside pad -->
      {#if item.side === 'left' || item.side === 'right'}
        <text
          x={cx}
          y={cy + 3.5}
          text-anchor="middle"
          class="font-mono font-medium pointer-events-none fill-primary"
          font-size={layout.pitch < 24 ? 8.5 : 10}
        >
          {shortPinName(item.pin.name)}
        </text>
      {:else}
        <text
          x={cx}
          y={cy + 3.5}
          text-anchor="middle"
          transform={`rotate(-90 ${cx} ${cy})`}
          class="font-mono font-medium pointer-events-none fill-primary"
          font-size={layout.pitch < 24 ? 8.5 : 10}
        >
          {shortPinName(item.pin.name)}
        </text>
      {/if}

      <!-- Physical Pin Number just inside IC body edge -->
      {#if item.side === 'left'}
        <text
          x={layout.originX + 6}
          y={cy + 3}
          text-anchor="start"
          class="font-mono fill-faint pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else if item.side === 'right'}
        <text
          x={layout.originX + layout.bodyWidth - 6}
          y={cy + 3}
          text-anchor="end"
          class="font-mono fill-faint pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else if item.side === 'bottom'}
        <text
          x={cx}
          y={layout.originY + layout.bodyHeight - 6}
          text-anchor="middle"
          class="font-mono fill-faint pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else}
        <text
          x={cx}
          y={layout.originY + 13}
          text-anchor="middle"
          class="font-mono fill-faint pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {/if}

      <!-- Lock glyph indicator on locked pins -->
      {#if isLocked}
        <g
          transform={`translate(${
            item.side === 'left'
              ? item.x + 3
              : item.side === 'right'
                ? item.x + item.width - 11
                : cx - 4
          }, ${
            item.side === 'top'
              ? item.y + 3
              : item.side === 'bottom'
                ? item.y + item.height - 11
                : cy - 4
          })`}
          class="pointer-events-none"
        >
          <rect x="0" y="3.5" width="8" height="5.5" rx="1" fill="var(--pin-power)" />
          <path
            d="M 2 3.5 V 2 A 2 2 0 0 1 6 2 V 3.5"
            fill="none"
            stroke="var(--pin-power)"
            stroke-width="1.3"
          />
        </g>
      {/if}

      <!-- External Signal + User Label Tag -->
      {#if tag}
        {@const tagW = Math.min(compact ? 108 : 152, Math.max(46, tag.length * 6.3 + 12))}
        {@const tagH = Math.min(18, layout.padThick)}
        {@const displayTag = tag.length > (compact ? 16 : 22) ? `${tag.slice(0, compact ? 15 : 21)}...` : tag}

        {#if item.side === 'left'}
          <line
            x1={item.x - 6}
            y1={cy}
            x2={item.x}
            y2={cy}
            stroke={colors.stroke}
            stroke-width="1.2"
          />
          <rect
            x={item.x - 8 - tagW}
            y={cy - tagH / 2}
            width={tagW}
            height={tagH}
            rx="3"
            fill={colors.tagBg}
            stroke={colors.stroke}
            stroke-width="1"
          />
          <text
            x={item.x - 13}
            y={cy + 3.5}
            text-anchor="end"
            class="font-mono font-medium fill-primary pointer-events-none"
            font-size={layout.pitch < 24 ? 8.5 : 9.5}
          >
            {displayTag}
          </text>
        {:else if item.side === 'right'}
          <line
            x1={item.x + item.width}
            y1={cy}
            x2={item.x + item.width + 6}
            y2={cy}
            stroke={colors.stroke}
            stroke-width="1.2"
          />
          <rect
            x={item.x + item.width + 8}
            y={cy - tagH / 2}
            width={tagW}
            height={tagH}
            rx="3"
            fill={colors.tagBg}
            stroke={colors.stroke}
            stroke-width="1"
          />
          <text
            x={item.x + item.width + 13}
            y={cy + 3.5}
            text-anchor="start"
            class="font-mono font-medium fill-primary pointer-events-none"
            font-size={layout.pitch < 24 ? 8.5 : 9.5}
          >
            {displayTag}
          </text>
        {:else if item.side === 'top'}
          <line
            x1={cx}
            y1={item.y - 6}
            x2={cx}
            y2={item.y}
            stroke={colors.stroke}
            stroke-width="1.2"
          />
          <g transform={`translate(${cx}, ${item.y - 8}) rotate(-90)`}>
            <rect
              x="0"
              y={-tagH / 2}
              width={tagW}
              height={tagH}
              rx="3"
              fill={colors.tagBg}
              stroke={colors.stroke}
              stroke-width="1"
            />
            <text
              x="6"
              y="3.5"
              text-anchor="start"
              class="font-mono font-medium fill-primary pointer-events-none"
              font-size={layout.pitch < 24 ? 8.5 : 9.5}
            >
              {displayTag}
            </text>
          </g>
        {:else}
          <line
            x1={cx}
            y1={item.y + item.height}
            x2={cx}
            y2={item.y + item.height + 6}
            stroke={colors.stroke}
            stroke-width="1.2"
          />
          <g transform={`translate(${cx}, ${item.y + item.height + 8}) rotate(-90)`}>
            <rect
              x={-tagW}
              y={-tagH / 2}
              width={tagW}
              height={tagH}
              rx="3"
              fill={colors.tagBg}
              stroke={colors.stroke}
              stroke-width="1"
            />
            <text
              x="-6"
              y="3.5"
              text-anchor="end"
              class="font-mono font-medium fill-primary pointer-events-none"
              font-size={layout.pitch < 24 ? 8.5 : 9.5}
            >
              {displayTag}
            </text>
          </g>
        {/if}
      {/if}
    </g>
  {/each}
</svg>
