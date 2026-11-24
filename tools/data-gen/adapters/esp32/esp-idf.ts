/** Narrow reader for the pinned ESP-IDF `gpio_sig_map.h` signal evidence. */
import fs from 'node:fs';
import path from 'node:path';
import type { EspIdfSignalCounts } from './types';

/**
 * Count distinct matrix input and output signal indices from `#define` lines.
 * Aliases such as `SPICLK_OUT_MUX_IDX` are excluded because they do not end in
 * `_IN_IDX` / `_OUT_IDX`.
 */
export function parseEspIdfSignalCounts(text: string, family = 'esp32c3'): EspIdfSignalCounts {
  const input = new Set<string>();
  const output = new Set<string>();
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*#define\s+([A-Z0-9_]+)_(IN|OUT)_IDX\s+(\d+)/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (match[2] === 'IN') input.add(name);
    else output.add(name);
    names.add(name);
  }
  return { family, inputCount: input.size, outputCount: output.size, matchedNames: names };
}

/** Read the pinned C3 header from a fetched ESP-IDF cache. */
export function readEspIdfSignalCounts(cacheDir: string): EspIdfSignalCounts | null {
  const file = path.join(
    cacheDir,
    'esp-idf',
    'components/soc/esp32c3/include/soc/gpio_sig_map.h',
  );
  if (!fs.existsSync(file)) return null;
  return parseEspIdfSignalCounts(fs.readFileSync(file, 'utf8'));
}
