/** Physical pin geometry derived from ATDF `<pinouts><pin position pad>` entries. */
import type { PackageInfo, PinInfo, PinType } from '../../../../src/core/types';
import type { AtdfPinout } from './types';

/** Pin type classified from the ATDF pad name alone. */
export function pinTypeForPad(pad: string): PinType {
  const name = pad.toUpperCase();
  if (/RESET|RST_N|NRST/.test(name)) return 'reset';
  if (/^GND|GND/.test(name)) return 'power';
  if (/^V(DD|CC|BAT|BUS|SW)|VDD|VCC/.test(name)) return 'power';
  return 'io';
}

/** Sort BGA positions by JEDEC row letters, skipping omitted I and O. */
function rowRank(row: string): number {
  let rank = 0;
  for (const char of row) {
    const code = char.charCodeAt(0) - 64;
    rank = rank * 26 + code - (code > 8 ? 1 : 0) - (code > 14 ? 1 : 0);
  }
  return rank;
}

/** Rows and columns of a BGA pinout, or empty arrays for perimeter packages. */
export function gridGeometry(positions: string[]): { rows: string[]; cols: number[] } {
  const rows = new Set<string>();
  const cols = new Set<number>();
  for (const pos of positions) {
    const match = pos.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { rows: [], cols: [] };
    rows.add(match[1]);
    cols.add(Number.parseInt(match[2], 10));
  }
  return {
    rows: Array.from(rows).sort((a, b) => rowRank(a) - rowRank(b)),
    cols: Array.from(cols).sort((a, b) => a - b),
  };
}

/** Perimeter side counts from a package name and physical position count. */
export function perimeterSides(packageName: string, count: number): [number, number, number, number] {
  if (count > 0 && count % 4 === 0 && /QFP|QFN|LGA|DFN|SOIC|SSOP|TSSOP|BGA/i.test(packageName)) {
    const side = count / 4;
    return [side, side, side, side];
  }
  const left = Math.ceil(count / 2);
  return [left, 0, count - left, 0];
}

/** Package descriptor for the selected pinout. */
export function buildPackage(pinout: AtdfPinout, packageName: string): PackageInfo {
  const positions = pinout.pins.map((pin) => pin.position ?? '');
  const grid = /BGA|WLCSP/i.test(packageName)
    ? gridGeometry(positions)
    : { rows: [], cols: [] };
  const kind = grid.rows.length > 0 && grid.cols.length > 0 ? 'grid' : 'perimeter';
  return {
    name: packageName,
    kind,
    pinCount: pinout.pins.length,
    ...(kind === 'grid'
      ? { rows: grid.rows, cols: grid.cols }
      : { sides: perimeterSides(packageName, pinout.pins.length) }),
  };
}

/**
 * Builds physical pins in ATDF position order. Entries without a position are
 * skipped and reported through `defer` so no pin number is invented.
 */
export function buildPins(
  pinout: AtdfPinout,
  defer: (reason: string) => void,
): PinInfo[] {
  const pins: PinInfo[] = [];
  for (const pin of pinout.pins) {
    if (pin.position === undefined || pin.position === '') {
      defer(`ATDF pinout ${pinout.name} has a pad ${pin.pad} with no position; pin deferred.`);
      continue;
    }
    if (pin.pad === '') {
      defer(`ATDF pinout ${pinout.name} has position ${pin.position} with no pad name; pin deferred.`);
      continue;
    }
    pins.push({ pos: pin.position, name: pin.pad, type: pinTypeForPad(pin.pad), signals: [] });
  }
  pins.sort((a, b) =>
    a.pos.localeCompare(b.pos, undefined, { numeric: true, sensitivity: 'base' }),
  );
  return pins;
}
