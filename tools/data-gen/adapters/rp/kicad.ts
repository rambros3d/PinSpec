/**
 * Minimal KiCad s-expression reader used by the RP adapter.
 *
 * Only two upstream shapes are consumed: `.kicad_sym` symbol libraries
 * (`MCU_RaspberryPi.kicad_symdir/*.kicad_sym`, CC-BY-SA-4.0 with the generated
 * file exception) and `.kicad_mod` QFN footprints (perimeter geometry only).
 * Unknown nodes are ignored so schema additions upstream do not break parsing.
 */

/** One parsed s-expression node: an atom or a list of children. */
export type SExpr = string | SExpr[];

interface Token {
  kind: 'open' | 'close' | 'atom';
  value?: string;
}

/** Tokenizes KiCad s-expressions, honouring quoted strings and `;` comments. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === ';') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'open' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'close' });
      i++;
      continue;
    }
    if (ch === '"') {
      i++;
      let value = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const escaped = text[i + 1];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
          i += 2;
        } else {
          value += text[i++];
        }
      }
      if (i < text.length) i++; // closing quote
      tokens.push({ kind: 'atom', value });
      continue;
    }
    let value = '';
    while (
      i < text.length &&
      !/[\s();]/.test(text[i])
    ) {
      value += text[i++];
    }
    tokens.push({ kind: 'atom', value });
  }
  return tokens;
}

/** Parses every top-level s-expression in `text`. */
export function parseSExpressions(text: string): SExpr[] {
  const tokens = tokenize(text);
  let cursor = 0;
  const parseNode = (): SExpr => {
    const token = tokens[cursor];
    if (token?.kind === 'atom') {
      cursor++;
      return token.value ?? '';
    }
    if (token?.kind !== 'open') {
      throw new Error('Unexpected end of KiCad s-expression.');
    }
    cursor++;
    const list: SExpr[] = [];
    while (cursor < tokens.length && tokens[cursor].kind !== 'close') {
      list.push(parseNode());
    }
    if (cursor >= tokens.length) {
      throw new Error('Unbalanced KiCad s-expression: missing `)`.');
    }
    cursor++;
    return list;
  };
  const roots: SExpr[] = [];
  while (cursor < tokens.length) {
    roots.push(parseNode());
  }
  return roots;
}

/** Returns the leading atom of a list, used as the node name. */
export function listHead(node: SExpr): string | undefined {
  return Array.isArray(node) && typeof node[0] === 'string' ? node[0] : undefined;
}

/** Returns all direct child lists whose head equals `head`. */
export function childLists(node: SExpr, head: string): SExpr[][] {
  if (!Array.isArray(node)) return [];
  return node.filter((child): child is SExpr[] => listHead(child) === head);
}

/** Returns the first direct child list whose head equals `head`. */
export function childList(node: SExpr, head: string): SExpr[] | undefined {
  return childLists(node, head)[0];
}

/** Returns the atom at `index` of a list (list head is index zero). */
export function atomAt(list: SExpr[] | undefined, index: number): string | undefined {
  const value = list?.[index];
  return typeof value === 'string' ? value : undefined;
}

/** Finds every nested list with the given head, excluding the root itself. */
export function findNestedLists(node: SExpr, head: string): SExpr[][] {
  if (!Array.isArray(node)) return [];
  const out: SExpr[][] = [];
  for (const child of node) {
    if (Array.isArray(child)) {
      if (listHead(child) === head) out.push(child);
      out.push(...findNestedLists(child, head));
    }
  }
  return out;
}

/** One physical KiCad symbol pin, preserving the full multi-name pad label. */
export interface KiCadPin {
  number: string;
  name: string;
  electricalType: string;
}

/** One KiCad symbol definition, possibly inheriting pins via `extends`. */
export interface KiCadSymbol {
  name: string;
  extendsName?: string;
  footprint?: string;
  description?: string;
  pins: KiCadPin[];
}

/** Parses one `.kicad_sym` file into symbols keyed by their quoted name. */
export function parseKiCadSymbolFile(text: string): Map<string, KiCadSymbol> {
  const symbols = new Map<string, KiCadSymbol>();
  for (const root of parseSExpressions(text)) {
    if (listHead(root) !== 'kicad_symbol_lib') continue;
    for (const node of childLists(root, 'symbol')) {
      const name = atomAt(node, 1);
      if (!name) continue;
      const pins: KiCadPin[] = [];
      for (const pin of findNestedLists(node, 'pin')) {
        const number = atomAt(childList(pin, 'number'), 1);
        const pinName = atomAt(childList(pin, 'name'), 1);
        if (!number || !pinName) continue;
        pins.push({
          number,
          name: pinName,
          electricalType: atomAt(pin, 1) ?? '',
        });
      }
      const footprintProp = childLists(node, 'property').find(
        (prop) => atomAt(prop, 1) === 'Footprint',
      );
      const descriptionProp = childLists(node, 'property').find(
        (prop) => atomAt(prop, 1) === 'Description',
      );
      symbols.set(name, {
        name,
        extendsName: atomAt(childList(node, 'extends'), 1),
        footprint: atomAt(footprintProp, 2),
        description: atomAt(descriptionProp, 2),
        pins,
      });
    }
  }
  return symbols;
}

/** Resolves a symbol's `extends` chain, merging inherited pins and metadata. */
export function resolveKiCadSymbol(
  symbols: Map<string, KiCadSymbol>,
  name: string,
  seen: Set<string> = new Set(),
): KiCadSymbol | undefined {
  const symbol = symbols.get(name);
  if (!symbol || seen.has(name)) return undefined;
  seen.add(name);
  const parent = symbol.extendsName
    ? resolveKiCadSymbol(symbols, symbol.extendsName, seen)
    : undefined;
  if (!parent) return symbol;
  return {
    ...parent,
    ...symbol,
    footprint: symbol.footprint ?? parent.footprint,
    description: symbol.description ?? parent.description,
    pins: symbol.pins.length > 0 ? symbol.pins : parent.pins,
  };
}

/** Perimeter pad counts `[left, bottom, right, top]` plus exposed-pad flag. */
export interface FootprintGeometry {
  sides: [number, number, number, number];
  hasExposedPad: boolean;
}

/** Parses a `.kicad_mod` QFN footprint for side counts and its exposed pad. */
export function parseKiCadFootprint(text: string): FootprintGeometry | undefined {
  const root = parseSExpressions(text).find((node) => listHead(node) === 'footprint');
  if (!root) return undefined;
  const sides: [number, number, number, number] = [0, 0, 0, 0];
  let hasExposedPad = false;
  for (const pad of findNestedLists(root, 'pad')) {
    const number = atomAt(pad, 1) ?? '';
    const at = childList(pad, 'at');
    const size = childList(pad, 'size');
    const x = Number.parseFloat(atomAt(at, 1) ?? '');
    const y = Number.parseFloat(atomAt(at, 2) ?? '');
    const width = Number.parseFloat(atomAt(size, 1) ?? '');
    const height = Number.parseFloat(atomAt(size, 2) ?? '');
    const nested = JSON.stringify(pad);
    const isHeatSink = nested.includes('pad_prop_heatsink') || (x === 0 && y === 0);
    if (isHeatSink && (!number || width > 1 && height > 1)) {
      hasExposedPad = true;
      continue;
    }
    if (!number) continue; // paste-only sub-pad of the exposed pad
    if (width >= height) {
      sides[y < 0 ? 1 : 3]++;
    } else {
      sides[x < 0 ? 0 : 2]++;
    }
  }
  if (sides.every((count) => count === 0)) return undefined;
  return { sides, hasExposedPad };
}
