/** Reader for the Zephyr Nordic pinctrl binding and function header. */
import fs from 'node:fs';
import path from 'node:path';
import type { PselFunction } from './types';

/** Generic normalization of a Zephyr PSEL function name into peripheral/signal. */
export function splitPselFunction(funcLabel: string): { peripheral: string; signal: string } {
  const separator = funcLabel.indexOf('_');
  if (separator <= 0) return { peripheral: funcLabel, signal: funcLabel };
  const prefix = funcLabel.slice(0, separator);
  const signal = funcLabel.slice(separator + 1);
  return { peripheral: `${prefix}0`, signal };
}

/** Function names declared by the pinctrl header as `NRF_FUN_<NAME>` defines. */
export function parsePselHeader(text: string): string[] {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/^#define\s+NRF_FUN_([A-Z0-9_]+)\s/gm), (match) => match[1]).sort(),
    ),
  );
}

/** `NRF_PSEL(<FUNC>, <port>, <pin>)` examples found in the binding description. */
export function parsePselBinding(text: string): string[] {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/NRF_PSEL\(\s*([A-Z0-9_]+)\s*,/g), (match) => match[1]).sort(),
    ),
  );
}

/** Combines header functions with binding examples into catalog PSEL records. */
export function buildPselFunctions(headerText: string, bindingText: string): PselFunction[] {
  const examples = parsePselBinding(bindingText);
  return parsePselHeader(headerText).map((funcLabel) => ({
    funcLabel,
    ...splitPselFunction(funcLabel),
    examples: examples.includes(funcLabel) ? examples.filter((item) => item === funcLabel) : [],
  }));
}

/** Reads the pinctrl header and binding from the gitignored Zephyr cache. */
export function readPselFunctions(cacheDir: string): PselFunction[] {
  const header = fs.readFileSync(
    path.join(cacheDir, 'zephyr', 'include/zephyr/dt-bindings/pinctrl/nrf-pinctrl.h'),
    'utf8',
  );
  const binding = fs.readFileSync(
    path.join(cacheDir, 'zephyr', 'dts/bindings/pinctrl/nordic,nrf-pinctrl.yaml'),
    'utf8',
  );
  return buildPselFunctions(header, binding);
}
