/**
 * Variant fact normalization for RP parts.
 *
 * Memory sizes and GPIO counts come from Zephyr device trees; flash, package,
 * ADC and PWM channel counts come from the raspberrypi/documentation variant
 * tables. Nothing is fabricated when a source is absent: parsers return empty
 * records and the adapter defers the affected part with a build warning.
 */

/** Facts extracted from the Zephyr `sram0` node and `ngpios` properties. */
export interface ZephyrFacts {
  ramKb?: number;
  gpioCount?: number;
}

/**
 * Parses `DT_SIZE_K(...)` of `sram0` and the `ngpios` properties of a part's
 * device-tree files. Files are passed base-first: a variant overlay's GPIO
 * properties override the base port definitions, so only the last file that
 * declares `ngpios` contributes to the count (RP2350A declares 30, RP2350B
 * declares 32 + 16).
 */
export function parseZephyrFacts(texts: string[]): ZephyrFacts {
  let ramKb: number | undefined;
  let gpioCounts: number[] = [];
  for (const text of texts) {
    const ram = /sram0\s*:\s*memory@[0-9a-fA-F]+\s*\{[\s\S]*?DT_SIZE_K\((\d+)\)/.exec(text);
    if (ram) ramKb = Number.parseInt(ram[1], 10);
    const counts = Array.from(text.matchAll(/ngpios\s*=\s*<(\d+)>/g)).map((m) =>
      Number.parseInt(m[1], 10),
    );
    if (counts.length > 0) gpioCounts = counts;
  }
  return {
    ramKb,
    gpioCount: gpioCounts.length > 0 ? gpioCounts.reduce((sum, n) => sum + n, 0) : undefined,
  };
}

/** One row of the documentation variant table. */
export interface DocVariant {
  id: string;
  package: string;
  flashKb: number;
  gpioCount?: number;
  adcCount?: number;
  pwmChannels?: number;
}

function parseFlashKb(cell: string): number {
  const stacked = /Stacked\s+(\d+(?:\.\d+)?)\s*MB/i.exec(cell);
  if (stacked) return Math.round(Number.parseFloat(stacked[1]) * 1024);
  if (/^\s*None\s*$/i.test(cell)) return 0;
  const kb = /(\d+)\s*kB/i.exec(cell);
  return kb ? Number.parseInt(kb[1], 10) : 0;
}

function numericCell(cell: string): number | undefined {
  const value = Number.parseInt(cell.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(value) ? value : undefined;
}

/** Parses every `|===` AsciiDoc table whose first column is `Variant`. */
export function parseDocumentationVariants(text: string): Map<string, DocVariant> {
  const variants = new Map<string, DocVariant>();
  for (const block of text.split(/\|===/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('|'));
    const headerIndex = lines.findIndex((line) => {
      const first = line.slice(1).split('|')[0].trim();
      return /^\*?Variant\*?$/.test(first);
    });
    if (headerIndex < 0) continue;
    const columns = lines[headerIndex].slice(1).split('|').map((cell) => cell.trim());
    const flashColumn = columns.findIndex((cell) => /flash/i.test(cell));
    const gpioColumn = columns.findIndex((cell) => /GPIO pins/i.test(cell));
    const adcColumn = columns.findIndex((cell) => /Analogue inputs/i.test(cell));
    const pwmColumn = columns.findIndex((cell) => /PWM channels/i.test(cell));
    const packageColumn = columns.findIndex((cell) => /^Package$/i.test(cell));

    for (const line of lines.slice(headerIndex + 1)) {
      const cells = line.slice(1).split('|').map((cell) => cell.trim().replace(/\*/g, ''));
      const id = cells[0];
      if (!/^RP\d{4}[AB]?$/.test(id)) continue;
      variants.set(id, {
        id,
        package: packageColumn >= 0 ? cells[packageColumn] : '',
        flashKb: flashColumn >= 0 ? parseFlashKb(cells[flashColumn]) : 0,
        gpioCount: gpioColumn >= 0 ? numericCell(cells[gpioColumn]) : undefined,
        adcCount: adcColumn >= 0 ? numericCell(cells[adcColumn]) : undefined,
        pwmChannels: pwmColumn >= 0 ? numericCell(cells[pwmColumn]) : undefined,
      });
    }
  }
  return variants;
}

/** RP2040 has no variant table; its facts are stated in prose. */
export function parseRp2040DocFacts(text: string): DocVariant | undefined {
  if (!/RP2040/.test(text)) return undefined;
  const flash = /\bno (?:built-in|on-board) flash memory\b/i.test(text) ? 0 : undefined;
  if (flash === undefined) return undefined;
  return {
    id: 'RP2040',
    package: /QFN-56/.test(text) ? 'QFN-56' : '',
    flashKb: flash,
  };
}

/** RP hardware constants that are not derived from a pin table. */
export const RP_STATE_MACHINES_PER_PIO = 4;

/**
 * RP2350B exposes two GPIO banks (0-31 and 16-47); smaller parts have only
 * one window starting at zero. Derived from the documented GPIO count.
 */
export function gpioBaseOptions(gpioCount: number): number[] {
  return gpioCount > 32 ? [0, 16] : [0];
}
