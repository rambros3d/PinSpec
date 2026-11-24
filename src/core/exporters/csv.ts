import {
  formatMuxLabel,
  getChipMuxModel,
  getChipVendor,
  type ChipData,
  type WorkspaceState,
} from '../types';

/** RFC-style CSV cell escaping: quote when needed and double embedded quotes. */
function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export a vendor-neutral pin table. `Mux` uses the single mux-label helper
 * (AF/F/RM/GPIO mode) and `Resource` carries shared-hardware keys such as
 * PWM slice IDs. The electrical columns are empty for unconfigured pins.
 */
export function exportCsv(chip: ChipData, state: WorkspaceState, includeUnassigned = false): string {
  const header = 'Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked,Level,Drive,Pull,Speed';
  const rows: string[] = [header];
  const vendor = getChipVendor(chip);
  const muxModel = getChipMuxModel(chip);

  const sortedPins = [...chip.pins].sort((a, b) =>
    a.pos.localeCompare(b.pos, undefined, { numeric: true }),
  );

  for (const pin of sortedPins) {
    const asgn = state.assignments[pin.pos];
    if (!asgn && !includeUnassigned) continue;

    const gpio = state.gpioConfig?.[pin.pos];
    const cells = [
      vendor,
      pin.pos,
      pin.name,
      pin.type,
      asgn ? asgn.peripheral : '',
      asgn ? asgn.signal : '',
      asgn ? formatMuxLabel(asgn, muxModel) : '',
      asgn?.resourceId ?? '',
      state.labels[pin.pos] ?? '',
      state.locked[pin.pos] ? 'true' : 'false',
      gpio?.outputLevel ?? '',
      gpio?.drive ?? '',
      gpio?.pull ?? '',
      gpio?.speed ?? '',
    ];
    rows.push(cells.map(escapeCsvCell).join(','));
  }

  return rows.join('\n') + '\n';
}
