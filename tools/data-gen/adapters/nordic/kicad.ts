/** Narrow reader for KiCad Nordic symbol pin numbers and names. */
import fs from 'node:fs';
import path from 'node:path';
import type { KicadPin, KicadSymbol } from './types';

/** Extracts balanced s-expression blocks beginning with `(pin `. */
function pinBlocks(text: string): string[] {
  const out: string[] = [];
  for (let start = text.indexOf('(pin '); start !== -1; start = text.indexOf('(pin ', start + 1)) {
    let depth = 0;
    let quoted = false;
    let end = start;
    for (; end < text.length; end++) {
      const char = text[end];
      if (char === '"' && text[end - 1] !== '\\') quoted = !quoted;
      if (quoted) continue;
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    if (depth === 0) out.push(text.slice(start, end));
  }
  return out;
}

/** GPIO port and pin parsed from a multi-function label such as `AIN7/P0.31`. */
export function gpioIdentity(name: string): { port: number; pin: number } | null {
  const match = name.match(/P(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    port: Number.parseInt(match[1], 10),
    pin: Number.parseInt(match[2], 10),
  };
}

/** Parses one KiCad symbol file into physical pin records. */
export function parseKicadSymbol(text: string, file = 'unknown.kicad_sym'): KicadSymbol {
  const symbolName = text.match(/^\s*\(symbol\s+"([^"]+)"/m)?.[1] ?? path.basename(file, '.kicad_sym');
  const footprint = text.match(/\(property\s+"Footprint"\s+"([^"]+)"/)?.[1] ?? '';
  const pins: KicadPin[] = pinBlocks(text)
    .map((block) => ({
      number: block.match(/\(number\s+"([^"]*)"/)?.[1] ?? '',
      name: block.match(/\(name\s+"([^"]*)"/)?.[1] ?? '',
      electrical: block.match(/^\(pin\s+([a-z_]+)/)?.[1] ?? '',
    }))
    .filter((pin) => pin.number !== '' && pin.name !== '');
  const hasExposedPad =
    /-1EP\b/i.test(footprint) || pins.some((pin) => /^EP$/i.test(pin.number) || /\bEP\b/i.test(pin.name));
  return { name: symbolName, footprint, pins, hasExposedPad };
}

/** Reads one Nordic symbol from the gitignored KiCad raw-file cache. */
export function readKicadSymbol(cacheDir: string, file: string): KicadSymbol {
  const text = fs.readFileSync(
    path.join(cacheDir, 'kicad-nordic', 'MCU_Nordic.kicad_symdir', file),
    'utf8',
  );
  return parseKicadSymbol(text, file);
}
