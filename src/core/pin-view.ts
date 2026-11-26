/**
 * Pure presentation helpers for pin and peripheral status.
 *
 * These helpers translate solver and workspace state into the CSS variables,
 * daisyUI tokens, and labels used by the SVG package renderers and the
 * peripheral sidebar. They contain no DOM, Svelte, or color-literal values so
 * the mapping can be unit-tested on the host and reused by every surface.
 */

import type {
  ChipData,
  PeripheralStatus,
  PinAssignment,
  PinInfo,
  PinVisualStatus,
} from './types';

/** CSS-variable tokens that color one pin badge. */
export interface PinStatusTokens {
  fill: string;
  stroke: string;
  text: string;
  tagBg: string;
}

/** Interaction flags that outrank the solver status of a pin. */
export interface PinStatusFlags {
  selected?: boolean;
  remapSource?: boolean;
  highlighted?: boolean;
}

/** Labels and daisyUI tokens for one peripheral status. */
export interface PeripheralStatusView {
  color: string;
  border: string;
  badge: string;
  label: string;
}

/** Fixed power, reset, and boot pins share one visual status. */
export function isPowerPin(pin: PinInfo): boolean {
  return pin.type === 'power' || pin.type === 'reset' || pin.type === 'boot';
}

/**
 * Baseline status for a chip preview: I/O pins follow their assignment, fixed
 * power pins are always `power`, and unassigned or non-I/O pins are `unused`.
 */
export function basePinStatus(
  chip: ChipData,
  assignments: Record<string, PinAssignment>,
): Record<string, PinVisualStatus> {
  const ioPositions = new Set(chip.pins.filter((pin) => pin.type === 'io').map((pin) => pin.pos));
  const status: Record<string, PinVisualStatus> = {};
  for (const pin of chip.pins) {
    status[pin.pos] = ioPositions.has(pin.pos)
      ? assignments[pin.pos]
        ? 'assigned'
        : 'unused'
      : isPowerPin(pin)
        ? 'power'
        : 'unused';
  }
  return status;
}

/** Resolve the exact badge tokens for a pin status and interaction flags. */
export function pinStatusTokens(
  status: PinVisualStatus,
  flags: PinStatusFlags = {},
): PinStatusTokens {
  if (flags.remapSource) {
    return {
      fill: 'var(--pin-selected-fill)',
      stroke: 'var(--pin-remap)',
      text: 'var(--pin-selected-text)',
      tagBg: 'var(--pin-remap-tag)',
    };
  }
  if (flags.highlighted) {
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
        stroke: flags.selected ? 'var(--pin-remap)' : 'var(--pin-assigned)',
        text: 'var(--pin-text)',
        tagBg: 'var(--pin-assigned-tag)',
      };
    case 'partial':
      return {
        fill: 'var(--pin-partial-fill)',
        stroke: flags.selected ? 'var(--pin-remap)' : 'var(--pin-partial)',
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
        stroke: flags.selected ? 'var(--pin-remap)' : 'var(--pin-unused)',
        text: 'currentColor',
        tagBg: 'transparent',
      };
  }
}

/** Single source of hue, border, badge, and label tokens for peripheral status. */
export const PERIPHERAL_STATUS_VIEW: Readonly<Record<PeripheralStatus, PeripheralStatusView>> = {
  none: {
    color: 'bg-base-300',
    border: 'border-base-content/50',
    badge: 'badge-ghost',
    label: 'Unused',
  },
  partial: {
    color: 'bg-warning',
    border: 'border-warning',
    badge: 'badge-warning',
    label: 'Partial',
  },
  active: {
    color: 'bg-success',
    border: 'border-success',
    badge: 'badge-success',
    label: 'Active',
  },
  error: {
    color: 'bg-error',
    border: 'border-error',
    badge: 'badge-error',
    label: 'Conflict',
  },
};
