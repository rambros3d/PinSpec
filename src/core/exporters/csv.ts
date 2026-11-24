import type { ChipData, WorkspaceState } from '../types';

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCsv(chip: ChipData, state: WorkspaceState, includeUnassigned = false): string {
  const header = 'Position,Pin,Type,Peripheral,Signal,AF,Label,Locked';
  const rows: string[] = [header];

  const sortedPins = [...chip.pins].sort((a, b) =>
    a.pos.localeCompare(b.pos, undefined, { numeric: true }),
  );

  for (const pin of sortedPins) {
    const asgn = state.assignments[pin.pos];
    if (!asgn && !includeUnassigned) continue;

    const cells = [
      pin.pos,
      pin.name,
      pin.type,
      asgn ? asgn.peripheral : '',
      asgn ? asgn.signal : '',
      asgn && asgn.af !== null ? `AF${asgn.af}` : '',
      state.labels[pin.pos] ?? '',
      state.locked[pin.pos] ? 'true' : 'false',
    ];
    rows.push(cells.map(escapeCsvCell).join(','));
  }

  return rows.join('\n') + '\n';
}
