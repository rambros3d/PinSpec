/**
 * Narrow readers for Espressif KiCad symbol and footprint files.
 * Only pin names, numbers, electrical types, and exposed-pad geometry are read.
 */
import type { KicadFootprint, KicadSymbol, KicadSymbolPin } from './types';

/** Extract a balanced parenthesized expression starting at `start`. */
function balanced(text: string, start: number): string {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== '\\') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Parse every top-level symbol of an Espressif `.kicad_sym` file. */
export function parseEspKicadSymbols(text: string): Map<string, KicadSymbol> {
  const out = new Map<string, KicadSymbol>();
  const header = /^\t\(symbol "([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = header.exec(text)) !== null) {
    const block = balanced(text, match.index + 1);
    const pins = new Map<string, KicadSymbolPin>();
    const pinHeader = /\(pin\s+([a-z_]+)\s+([a-z_]+)/g;
    let pinMatch: RegExpExecArray | null;
    while ((pinMatch = pinHeader.exec(block)) !== null) {
      const pinBlock = balanced(block, pinMatch.index);
      const name = /\(name\s+"([^"]*)"/.exec(pinBlock)?.[1] ?? '';
      const number = /\(number\s+"([^"]*)"/.exec(pinBlock)?.[1] ?? '';
      if (!number || pins.has(number)) continue;
      pins.set(number, { number, name, electrical: pinMatch[1] });
    }
    const description = /\(property "Description" "([^"]*)"/.exec(block)?.[1] ?? '';
    const footprint = /\(property "Footprint" "([^"]*)"/.exec(block)?.[1] ?? '';
    out.set(match[1], {
      name: match[1],
      description,
      footprint,
      pins: Array.from(pins.values()).sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    });
    header.lastIndex = match.index + block.length;
  }
  return out;
}

/** Parse physical pad numbers and the exposed thermal pad of a footprint. */
export function parseEspKicadFootprint(text: string, name: string): KicadFootprint {
  const numbered: string[] = [];
  let hasExposedPad = false;
  const padHeader = /\(pad "([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = padHeader.exec(text)) !== null) {
    const block = balanced(text, match.index);
    const padName = match[1];
    if (/^\d+$/.test(padName)) numbered.push(padName);
    const layers = /\(layers\s+([^)]*)\)/.exec(block)?.[1] ?? '';
    const size = /\(size\s+([\d.]+)/.exec(block)?.[1] ?? '0';
    if (/F\.Cu/.test(layers) && !/F\.Paste/.test(layers) && Number(size) > 1) {
      hasExposedPad = true;
    }
    padHeader.lastIndex = match.index + block.length;
  }
  return { name, numberedPads: numbered, hasExposedPad };
}
