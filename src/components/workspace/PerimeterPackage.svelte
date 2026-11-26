<script module lang="ts">
  // Module-scoped counter: unique SVG defs ids per instance without reading
  // reactive props during initialization.
  let surfaceCounter = 0;

  function nextSurfaceId(): string {
    surfaceCounter += 1;
    return `ic-perimeter-${surfaceCounter}`;
  }
</script>

<script lang="ts">
  import { pinKeyboardClick } from '../../state/pin-keyboard';
  import { isQuarterTurn, localLabelAngle } from '../../core/package-rotation';
  import { pinStatusTokens } from '../../core/pin-view';
  import {
    formatMuxLabel,
    type ChipData,
    type MuxModel,
    type PackageRotation,
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
    rotation?: PackageRotation;
    muxModel?: MuxModel;
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
    zoom = 1,
    rotation = 0,
    muxModel = 'af',
    highlightedPins = new Set<string>(),
    remapSourcePos = null,
    selectedPinPos = null,
    compact = false,
    onPinClick,
    onPinContextMenu,
    onPinHover,
  }: Props = $props();

  const surfaceId = nextSurfaceId();

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
    // SOP-family packages are two-sided even if an upstream shard declares
    // four equal sides. Keep four-sided QFN/LQFP layouts untouched.
    const packageName = chip.package.name.toUpperCase();
    const twoSidedPackage = /SOP|SOIC|SSOP|DIP|SO-/.test(packageName);
    const declaredSides = chip.package.sides ?? [
      Math.ceil(chip.pins.length / 4),
      Math.floor(chip.pins.length / 4),
      Math.ceil(chip.pins.length / 4),
      Math.floor(chip.pins.length / 4),
    ];
    const sides =
      twoSidedPackage && (declaredSides[1] > 0 || declaredSides[2] > 0)
        ? [Math.ceil(chip.pins.length / 2), 0, Math.floor(chip.pins.length / 2), 0]
        : declaredSides;
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

  // Geometry rotates around the viewBox centre. Each label applies the local
  // angle for its displayed side so screen text is never upside down. At a
  // quarter turn the viewBox extents swap, so the rotating group is recentred.
  const viewCenterX = $derived(layout.totalWidth / 2);
  const viewCenterY = $derived(layout.totalHeight / 2);
  const quarterTurn = $derived(isQuarterTurn(rotation));
  const svgWidth = $derived(quarterTurn ? layout.totalHeight : layout.totalWidth);
  const svgHeight = $derived(quarterTurn ? layout.totalWidth : layout.totalHeight);
  const geometryTransform = $derived(
    rotation === 0
      ? undefined
      : `${quarterTurn ? `translate(${(svgWidth - layout.totalWidth) / 2} ${(svgHeight - layout.totalHeight) / 2}) ` : ''}rotate(${rotation} ${viewCenterX} ${viewCenterY})`,
  );
  // Centre markings and the exposed-pad marking have no pin edge; treat them as
  // left-edge text so they stay readable at every orientation.
  const centreLabelAngle = $derived(localLabelAngle('left', rotation));
  // Module identity is generated catalog data; bare dies keep the IC body.
  const isModule = $derived(chip.module?.kind === 'module');
  const moduleName = $derived(chip.module?.name ?? '');

  function getColors(pos: string) {
    return pinStatusTokens(pinStatus[pos] ?? 'unused', {
      selected: selectedPinPos === pos,
      remapSource: remapSourcePos === pos,
      highlighted: highlightedPins.has(pos),
    });
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

  /** Full SVG tooltip text: bonded pads, tags and the vendor-correct mux. */
  /** Keyboard activation follows the same pin-click path as pointer input. */
  function activatePinWithKeyboard(pin: PinInfo, e: KeyboardEvent): void {
    if (pin.type !== 'io') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onPinClick?.(pin, pinKeyboardClick(e.currentTarget as Element | null));
  }

  function pinTitle(pin: PinInfo): string {
    const parts = [`${pin.name} (pos ${pin.pos})`];
    if (pin.bondedNames?.length) parts.push(`Bonded pads: ${pin.bondedNames.join(' / ')}`);
    if (pin.tags?.length) parts.push(`Tags: ${pin.tags.join(', ')}`);
    const asgn = assignments[pin.pos];
    if (asgn) {
      parts.push(
        `${asgn.peripheral}_${asgn.signal} [${formatMuxLabel(asgn, muxModel)}]`,
      );
    }
    if (pin.note) parts.push(pin.note);
    return parts.join(' | ');
  }
</script>

<svg
  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
  width={svgWidth}
  height={svgHeight}
  class="select-none text-foreground overflow-visible"
  role="img"
  aria-label={`${chip.id} ${chip.package.name} pinout diagram`}
>
  <defs>
    <clipPath id={`${surfaceId}-clip`}>
      <rect
        x={layout.originX}
        y={layout.originY}
        width={layout.bodyWidth}
        height={layout.bodyHeight}
        rx="6"
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

  <g transform={geometryTransform}>
  <!-- IC Package Body -->
  <g>
    <rect
      x={layout.originX}
      y={layout.originY}
      width={layout.bodyWidth}
      height={layout.bodyHeight}
      rx="6"
      class="fill-neutral stroke-base-300"
      stroke-width="2"
      style={`filter: drop-shadow(0 3px 5px color-mix(in oklab, var(--color-neutral) 55%, transparent));`}
    />
    <rect
      x={layout.originX}
      y={layout.originY}
      width={layout.bodyWidth}
      height={layout.bodyHeight}
      rx="6"
      fill={`url(#${surfaceId}-depth)`}
      opacity="0.55"
      pointer-events="none"
    />
    <rect
      x={layout.originX}
      y={layout.originY}
      width={layout.bodyWidth}
      height={layout.bodyHeight}
      rx="6"
      fill="currentColor"
      filter={`url(#${surfaceId}-noise)`}
      clip-path={`url(#${surfaceId}-clip)`}
      style="mix-blend-mode: overlay;"
      opacity="0.7"
      pointer-events="none"
    />
    <!-- Subtle inner die outline -->
    <rect
      x={layout.originX + 12}
      y={layout.originY + 12}
      width={layout.bodyWidth - 24}
      height={layout.bodyHeight - 24}
      rx="3"
      fill="none"
      class="stroke-base-300"
      stroke-width="1"
    />

    {#if isModule}
      <!-- Module PCB body derived from chip.module identity: decorative only. -->
      <rect
        x={layout.originX + 3}
        y={layout.originY + 3}
        width={layout.bodyWidth - 6}
        height={layout.bodyHeight - 6}
        rx="4"
        class="fill-base-100 stroke-base-300 pointer-events-none"
        stroke-width="1.5"
      />
      <!-- Dashed inner die outline on the module substrate. -->
      <rect
        x={layout.originX + 12}
        y={layout.originY + 12}
        width={layout.bodyWidth - 24}
        height={layout.bodyHeight - 24}
        rx="3"
        fill="none"
        class="stroke-base-content/30 pointer-events-none"
        stroke-width="1"
        stroke-dasharray="4 3"
      />
      <!-- Castellated half-hole edge marks aligned with the placed pads. -->
      {#each layout.placed as item (item.pin.pos)}
        {@const edgeX = item.side === 'left' ? layout.originX + 3 : item.side === 'right' ? layout.originX + layout.bodyWidth - 3 : item.x + item.width / 2}
        {@const edgeY = item.side === 'top' ? layout.originY + 3 : item.side === 'bottom' ? layout.originY + layout.bodyHeight - 3 : item.y + item.height / 2}
        <circle
          cx={edgeX}
          cy={edgeY}
          r="2.6"
          class="fill-base-100 stroke-base-300 pointer-events-none"
          stroke-width="1"
        />
      {/each}
    {/if}

    {#if chip.package.hasExposedPad}
      <!-- Exposed thermal/ground pad declared by the generated package -->
      <g>
        <rect
          x={layout.originX + layout.bodyWidth / 2 - 19}
          y={layout.originY + layout.bodyHeight - 28}
          width="38"
          height="15"
          rx="2"
          class="fill-base-300 stroke-base-300"
          stroke-width="1"
          stroke-dasharray="3 2"
        />
        <text
          x={layout.originX + layout.bodyWidth / 2}
          y={layout.originY + layout.bodyHeight - 17}
          transform={`rotate(${centreLabelAngle} ${layout.originX + layout.bodyWidth / 2} ${layout.originY + layout.bodyHeight - 17})`}
          text-anchor="middle"
          class="font-mono fill-base-content/40 pointer-events-none"
          font-size="8"
        >
          EP
        </text>
      </g>
    {/if}

    <!-- Pin 1 Chamfer + Orientation Dot at Top-Left -->
    <path
      d={`M ${layout.originX} ${layout.originY + 20} L ${layout.originX + 20} ${layout.originY}`}
      class="stroke-base-content/20"
      stroke-width="1.5"
    />
    <circle
      cx={layout.originX + 22}
      cy={layout.originY + 22}
      r="5"
      class="fill-warning"
    />

    <!-- Center IC Marking -->
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 - 10}
      transform={`rotate(${centreLabelAngle} ${layout.originX + layout.bodyWidth / 2} ${layout.originY + layout.bodyHeight / 2 - 10})`}
      text-anchor="middle"
      class="font-mono fill-base-content font-semibold"
      font-size={compact ? 14 : 16}
    >
      {chip.id}
    </text>
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 + 12}
      transform={`rotate(${centreLabelAngle} ${layout.originX + layout.bodyWidth / 2} ${layout.originY + layout.bodyHeight / 2 + 12})`}
      text-anchor="middle"
      class="font-mono fill-base-content/60"
      font-size={compact ? 11 : 12}
    >
      {chip.package.name} · {chip.core}
    </text>
    <text
      x={layout.originX + layout.bodyWidth / 2}
      y={layout.originY + layout.bodyHeight / 2 + 29}
      transform={`rotate(${centreLabelAngle} ${layout.originX + layout.bodyWidth / 2} ${layout.originY + layout.bodyHeight / 2 + 29})`}
      text-anchor="middle"
      class="font-mono fill-base-content/40"
      font-size="10"
    >
      {chip.flashKb ?? '—'} KB Flash · {chip.ramKb} KB RAM
    </text>
    {#if isModule}
      <!-- upright through the same centre-label angle as the other markings -->
      <text
        x={layout.originX + layout.bodyWidth / 2}
        y={layout.originY + layout.bodyHeight / 2 - 27}
        transform={`rotate(${centreLabelAngle} ${layout.originX + layout.bodyWidth / 2} ${layout.originY + layout.bodyHeight / 2 - 27})`}
        text-anchor="middle"
        class="font-mono fill-base-content/70 pointer-events-none"
        font-size={compact ? 10 : 12}
      >
        {moduleName}
      </text>
    {/if}
  </g>

  <!-- Perimeter Pins -->
  {#each layout.placed as item (item.pin.pos)}
    {@const colors = getColors(item.pin.pos)}
    {@const tag = formatExternalTag(item.pin.pos)}
    {@const isHighlighted = highlightedPins.has(item.pin.pos)}
    {@const isLocked = Boolean(locked[item.pin.pos])}
    {@const isInteractive = item.pin.type === 'io'}
    {@const bondedNames = item.pin.bondedNames ?? []}
    {@const isBonded = bondedNames.length > 0 || Boolean(item.pin.tags?.includes('bonded'))}
    {@const padLabel = bondedNames.length > 0 ? bondedNames.join('/') : item.pin.name}
    {@const cx = item.x + item.width / 2}
    {@const cy = item.y + item.height / 2}
    {@const labelAngle = localLabelAngle(item.side, rotation)}

    <g
      data-pin-pos={item.pin.pos}
      role="button"
      tabindex={isInteractive ? 0 : -1}
      aria-label={pinTitle(item.pin)}
      aria-disabled={!isInteractive}
      class={isInteractive ? 'cursor-pointer' : 'cursor-default'}
      onclick={(e) => {
        e.stopPropagation();
        onPinClick?.(item.pin, e);
      }}
      onkeydown={(e) => activatePinWithKeyboard(item.pin, e)}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPinContextMenu?.(item.pin, e);
      }}
      onmouseenter={(e) => onPinHover?.(item.pin, e)}
      onmouseleave={() => onPinHover?.(null)}
    >
      <title>{pinTitle(item.pin)}</title>

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
        stroke-dasharray={isBonded ? '4 2' : undefined}
        class={isHighlighted ? 'animate-pin-pulse' : ''}
      />

      {#if isBonded}
        <rect
          x={item.x + 3}
          y={item.y + 3}
          width={item.width - 6}
          height={item.height - 6}
          rx="1.5"
          fill="none"
          class="stroke-base-300 pointer-events-none"
          stroke-width="0.8"
          stroke-dasharray="2 1.5"
        />
      {/if}

      <!-- Pin Port Name inside pad -->
      <text
        x={cx}
        y={cy + 3.5}
        text-anchor="middle"
        transform={`rotate(${labelAngle} ${cx} ${cy + 3.5})`}
        class="font-mono font-medium pointer-events-none fill-base-content"
        font-size={layout.pitch < 24 ? 8.5 : 10}
      >
        {shortPinName(padLabel)}
      </text>

      <!-- Physical Pin Number just inside IC body edge -->
      {#if item.side === 'left'}
        <text
          x={layout.originX + 6}
          y={cy + 3}
          transform={`rotate(${labelAngle} ${layout.originX + 6} ${cy + 3})`}
          text-anchor="start"
          class="font-mono fill-base-content/40 pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else if item.side === 'right'}
        <text
          x={layout.originX + layout.bodyWidth - 6}
          y={cy + 3}
          transform={`rotate(${labelAngle} ${layout.originX + layout.bodyWidth - 6} ${cy + 3})`}
          text-anchor="end"
          class="font-mono fill-base-content/40 pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else if item.side === 'bottom'}
        <text
          x={cx}
          y={layout.originY + layout.bodyHeight - 6}
          transform={`rotate(${labelAngle} ${cx} ${layout.originY + layout.bodyHeight - 6})`}
          text-anchor="middle"
          class="font-mono fill-base-content/40 pointer-events-none"
          font-size="8.5"
        >
          {item.pin.pos}
        </text>
      {:else}
        <text
          x={cx}
          y={layout.originY + 13}
          transform={`rotate(${labelAngle} ${cx} ${layout.originY + 13})`}
          text-anchor="middle"
          class="font-mono fill-base-content/40 pointer-events-none"
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

      <!-- External Signal + User Label Tag (suppressed at minimum zoom to avoid overlap) -->
      {#if tag && zoom >= 0.6}
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
            transform={`rotate(${labelAngle} ${item.x - 13} ${cy + 3.5})`}
            text-anchor="end"
            class="font-mono font-medium fill-base-content pointer-events-none"
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
            transform={`rotate(${labelAngle} ${item.x + item.width + 13} ${cy + 3.5})`}
            text-anchor="start"
            class="font-mono font-medium fill-base-content pointer-events-none"
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
          <g transform={`translate(${cx}, ${item.y - 8}) rotate(${labelAngle})`}>
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
              class="font-mono font-medium fill-base-content pointer-events-none"
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
          <g transform={`translate(${cx}, ${item.y + item.height + 8}) rotate(${labelAngle})`}>
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
              class="font-mono font-medium fill-base-content pointer-events-none"
              font-size={layout.pitch < 24 ? 8.5 : 9.5}
            >
              {displayTag}
            </text>
          </g>
        {/if}
      {/if}
    </g>
  {/each}
  </g>
</svg>
