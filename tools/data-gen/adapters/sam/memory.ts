/** Memory and capability evidence derived from ATDF memory segments and names. */
import type { ChipCapabilityEvidence } from '../../../../src/core/types';
import type { AtdfMemorySegment } from './types';

/** Parses an ATDF size literal (decimal or `0x` hexadecimal). */
export function parseSize(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = /^0x/i.test(raw) ? Number.parseInt(raw.slice(2), 16) : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Kilobyte size of the first matching memory segment type. */
export function memoryKb(
  segments: AtdfMemorySegment[],
  type: string,
): number | null {
  const segment = segments.find((item) => item.type === type);
  if (!segment) return null;
  const bytes = parseSize(segment.size);
  if (bytes === null) return null;
  return Math.round((bytes / 1024) * 100) / 100;
}

export interface MemoryEvidence {
  flashKb: number | null;
  ramKb: number | null;
  capabilityEvidence: ChipCapabilityEvidence;
  missingSizes: string[];
}

/** Derives flash/RAM and retains interrupt/parameter names as evidence. */
export function buildMemoryEvidence(
  segments: AtdfMemorySegment[],
  interrupts: string[],
  params: string[],
): MemoryEvidence {
  const flashKb = memoryKb(segments, 'flash');
  const ram = memoryKb(segments, 'ram');
  const missingSizes = segments
    .filter((segment) => (segment.type === 'flash' || segment.type === 'ram') && parseSize(segment.size) === null)
    .map((segment) => segment.name || segment.type || 'unnamed');
  return {
    flashKb,
    ramKb: ram,
    capabilityEvidence: { interrupts: [...interrupts].sort(), params: [...params].sort() },
    missingSizes,
  };
}
