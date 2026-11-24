/**
 * FUNCSEL table parser and GPIO join for RP parts.
 *
 * Two upstream shapes are normalized into one intermediate table:
 *   - picotool `main.cpp`: `pin_functions_rp2040` / `pin_functions_rp2350`
 *     arrays, indexed [FUNCSEL][GPIO].
 *   - pico-sdk `hardware/gpio.h`: Doxygen markdown tables headed by `F<n>`.
 * No pin mapping is hard-coded; function labels always come from the source.
 */

/** GPIO-indexed FUNCSEL table for one chip family. */
export interface FuncTable {
  id: 'rp2040' | 'rp2350';
  functionCount: number;
  gpioCount: number;
  byGpio: Map<number, Map<number, string>>;
}

function newTable(id: 'rp2040' | 'rp2350'): FuncTable {
  return { id, functionCount: 0, gpioCount: 0, byGpio: new Map() };
}

function setEntry(table: FuncTable, gpio: number, func: number, label: string): void {
  let row = table.byGpio.get(gpio);
  if (!row) {
    row = new Map();
    table.byGpio.set(gpio, row);
  }
  row.set(func, label);
  table.functionCount = Math.max(table.functionCount, func + 1);
  table.gpioCount = Math.max(table.gpioCount, gpio + 1);
}

/** Extracts balanced `{ ... }` groups that are direct children of `body`. */
function bracedGroups(body: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      if (!quoted) {
        quoted = true;
      } else if (body[i - 1] !== '\\') {
        quoted = false;
      }
      continue;
    }
    if (quoted) continue;
    if (ch === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        groups.push(body.slice(start, i));
        start = -1;
      }
    }
  }
  return groups;
}

/**
 * Parses picotool's C++ `pin_functions_*` arrays. The declaration's template
 * parameters supply the GPIO count and FUNCSEL slot count; each braced row is
 * one FUNCSEL index and each quoted cell is one GPIO.
 */
export function parsePicotoolFuncsel(text: string): Map<string, FuncTable> {
  const tables = new Map<string, FuncTable>();
  const arrayPattern =
    /std::array\s*<\s*std::array\s*<\s*string\s*,\s*(\d+)\s*>\s*,\s*(\d+)\s*>\s*pin_functions_(rp2040|rp2350)\s*\{\{([\s\S]*?)\}\};/g;
  for (const match of text.matchAll(arrayPattern)) {
    const gpioCount = Number.parseInt(match[1], 10);
    const declaredFunctions = Number.parseInt(match[2], 10);
    const id = match[3] as 'rp2040' | 'rp2350';
    const table = tables.get(id) ?? newTable(id);
    const rows = bracedGroups(match[4]);
    rows.forEach((row, func) => {
      if (func >= declaredFunctions) return;
      const cells = Array.from(row.matchAll(/"([^"]*)"/g)).map((cell) => cell[1].trim());
      cells.forEach((label, gpio) => {
        if (gpio < gpioCount && label) setEntry(table, gpio, func, label);
      });
    });
    tables.set(id, table);
  }
  return tables;
}

/**
 * Parses the pico-sdk Doxygen function-select tables. Header cells name the
 * FUNCSEL slots (`F0`..`F11`), data cells are keyed by GPIO number. Multiple
 * tables for one chip (QFN-80 GPIO30-47) are merged.
 */
export function parsePicoSdkFuncsel(text: string): Map<string, FuncTable> {
  const tables = new Map<string, FuncTable>();
  let current: { id: 'rp2040' | 'rp2350'; funcs: number[] } | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*\*?\s?/, '').trim();
    if (!line.startsWith('|') || !line.endsWith('|')) {
      current = undefined;
      continue;
    }
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
    if (cells[0] === 'GPIO') {
      const funcs = cells.slice(1).map((cell) => /^F(\d+)$/i.exec(cell)?.[1]);
      if (funcs.some((value) => value === undefined)) {
        current = undefined;
        continue;
      }
      // RP2040 tables start at F1; RP2350 tables include an F0 column.
      const id: 'rp2040' | 'rp2350' = funcs[0] === '0' ? 'rp2350' : 'rp2040';
      current = { id, funcs: funcs.map((value) => Number.parseInt(value!, 10)) };
      if (!tables.has(id)) tables.set(id, newTable(id));
      continue;
    }
    if (!current || !/^\d+$/.test(cells[0])) continue;
    const gpio = Number.parseInt(cells[0], 10);
    const table = tables.get(current.id)!;
    cells.slice(1).forEach((label, index) => {
      const func = current!.funcs[index];
      if (func !== undefined && label) setEntry(table, gpio, func, label);
    });
  }
  return tables;
}

/** Picks picotool when complete, otherwise merges the pico-sdk fallback. */
export function selectFuncTables(
  picotoolText: string | undefined,
  picoSdkText: string | undefined,
): Map<string, FuncTable> {
  const fromPicotool = picotoolText ? parsePicotoolFuncsel(picotoolText) : new Map();
  const fromSdk = picoSdkText ? parsePicoSdkFuncsel(picoSdkText) : new Map();
  const selected = new Map<string, FuncTable>();
  for (const id of ['rp2040', 'rp2350']) {
    const primary = fromPicotool.get(id);
    const fallback = fromSdk.get(id);
    if (primary && primary.byGpio.size > 0) {
      selected.set(id, primary);
    } else if (fallback && fallback.byGpio.size > 0) {
      selected.set(id, fallback);
    }
  }
  return selected;
}

/** One solver-facing signal derived from a FUNCSEL table cell. */
export interface FuncSignal {
  peripheral: string;
  signal: string;
  af: number;
  funcLabel: string;
  resourceId?: string;
}

/** Converts one FUNCSEL label; returns null for the plain SIO GPIO function. */
export function normalizeFuncLabel(
  label: string,
  gpio: number,
  func: number,
): Omit<FuncSignal, 'af' | 'funcLabel'> | null {
  const text = label.trim();
  if (!text || /^SIO$/i.test(text)) return null;

  const pwm = /^PWM\s*(\d+)\s*([AB])$/i.exec(text);
  if (pwm) {
    const resourceId = `PWM${pwm[1]}${pwm[2].toUpperCase()}`;
    return { peripheral: 'PWM', signal: resourceId, resourceId };
  }
  const hstx = /^HSTX(\d+)$/i.exec(text);
  if (hstx) return { peripheral: 'HSTX', signal: text.toUpperCase() };
  const pio = /^PIO(\d+)$/i.exec(text);
  if (pio) return { peripheral: `PIO${pio[1]}`, signal: 'PIO' };
  const jtag = /^JTAG\s+(\S+)$/i.exec(text);
  if (jtag) return { peripheral: 'JTAG', signal: jtag[1].toUpperCase() };
  if (/^USB\s+/i.test(text)) {
    return {
      peripheral: 'USB',
      signal: text.slice(4).trim().replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(),
    };
  }
  if (/^CLOCK\s+/i.test(text)) {
    return {
      peripheral: 'CLOCKS',
      signal: text.replace(/^CLOCK\s+/i, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(),
    };
  }

  const parts = text.split(/\s+/);
  const peripheral = parts[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const signal =
    parts.slice(1).join('_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase() || `GPIO${gpio}`;
  void func;
  return { peripheral: peripheral || 'OTHER', signal };
}

/** All non-SIO FUNCSEL signals for one GPIO, ordered by FUNCSEL index. */
export function funcselSignalsForGpio(table: FuncTable, gpio: number): FuncSignal[] {
  const row = table.byGpio.get(gpio);
  if (!row) return [];
  const out: FuncSignal[] = [];
  for (const func of Array.from(row.keys()).sort((a, b) => a - b)) {
    const label = row.get(func)!;
    const normalized = normalizeFuncLabel(label, gpio, func);
    if (!normalized) continue;
    out.push({ ...normalized, af: func, funcLabel: `F${func}` });
  }
  return out;
}

/** Largest PIO instance index in a table plus one (RP2040=2, RP2350=3). */
export function pioInstanceCount(table: FuncTable): number {
  let max = 1;
  for (const row of table.byGpio.values()) {
    for (const label of row.values()) {
      const match = /^PIO(\d+)$/i.exec(label.trim());
      if (match) max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return max + 1;
}
