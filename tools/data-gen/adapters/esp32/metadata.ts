/**
 * Narrow line readers for `esp-rs/esp-hal` `esp-metadata` TOML.
 * Only pin functions, limitations, matrix signal ids, and SoC facts are read.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MetadataDevice, MetadataFunction, MetadataGpio, MetadataSignal } from './types';

/** Extract a balanced inline TOML table starting at `start`. */
function balancedTable(text: string, start: number): string {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== '\\') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function tableValues(body: string): string[] {
  return Array.from(body.matchAll(/=\s*"([^"]+)"/g)).map((m) => m[1]);
}

function numberedFunctions(body: string): MetadataFunction[] {
  return Array.from(body.matchAll(/(\d+)\s*=\s*"([^"]+)"/g)).map((m) => ({
    id: Number(m[1]),
    name: m[2],
  }));
}

/** Parse one gpio.toml file. */
export function parseGpioToml(text: string, family: string, socText = ''): MetadataDevice {
  const gpios = new Map<number, MetadataGpio>();
  const inputSignals: MetadataSignal[] = [];
  const outputSignals: MetadataSignal[] = [];
  let section = '';
  let funcInSelOffset = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('func_in_sel_offset')) {
      funcInSelOffset = Number(/=\s*(\d+)/.exec(line)?.[1] ?? 0);
    }
    if (line.startsWith('pins')) {
      section = 'pins';
      continue;
    }
    if (line.startsWith('input_signals')) {
      section = 'input';
      continue;
    }
    if (line.startsWith('output_signals')) {
      section = 'output';
      continue;
    }
    if (!line || line.startsWith('#')) continue;

    if (section === 'pins') {
      const pinMatch = /\{\s*pin\s*=\s*(\d+)/.exec(line);
      if (!pinMatch) continue;
      const body = balancedTable(raw, pinMatch.index);
      const functionsBody = /functions\s*=\s*\{([^}]*)\}/.exec(body)?.[1] ?? '';
      const analogBody = /analog\s*=\s*\{([^}]*)\}/.exec(body)?.[1] ?? '';
      const lpBody = /lp\s*=\s*\{([^}]*)\}/.exec(body)?.[1] ?? '';
      const limitationsBody = /limitations\s*=\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '';
      const pin = Number(pinMatch[1]);
      gpios.set(pin, {
        pin,
        functions: numberedFunctions(functionsBody),
        analog: tableValues(analogBody),
        lp: tableValues(lpBody),
        limitations: limitationsBody
          .split(',')
          .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
          .filter((item) => item.length > 0),
      });
      continue;
    }

    if (section === 'input' || section === 'output') {
      const sigMatch = /\{\s*name\s*=\s*"([^"]+)"(?:\s*,\s*id\s*=\s*(\d+))?/.exec(line);
      if (!sigMatch) continue;
      const signal: MetadataSignal = {
        name: sigMatch[1],
        id: sigMatch[2] === undefined ? null : Number(sigMatch[2]),
      };
      (section === 'input' ? inputSignals : outputSignals).push(signal);
    }
  }

  const arch = /^arch\s*=\s*"([^"]+)"/m.exec(socText)?.[1] ?? '';
  const cores = Number(/^cores\s*=\s*(\d+)/m.exec(socText)?.[1] ?? 0);
  const dmaChannels = Array.from(socText.matchAll(/\{\s*name\s*=\s*"(GDMA|DMA)[^"]*"/g)).length;
  return { family, arch, cores, funcInSelOffset, gpios, inputSignals, outputSignals, dmaChannels };
}

/** Read every device gpio.toml and soc.toml from an esp-hal checkout. */
export function readEspMetadata(cacheDir: string): Map<string, MetadataDevice> {
  const devicesDir = path.join(cacheDir, 'esp-hal', 'esp-metadata', 'devices');
  const out = new Map<string, MetadataDevice>();
  if (!fs.existsSync(devicesDir)) return out;
  for (const family of fs.readdirSync(devicesDir).sort()) {
    const gpioPath = path.join(devicesDir, family, 'gpio.toml');
    if (!fs.existsSync(gpioPath)) continue;
    const socPath = path.join(devicesDir, family, 'soc.toml');
    const socText = fs.existsSync(socPath) ? fs.readFileSync(socPath, 'utf8') : '';
    out.set(
      family,
      parseGpioToml(fs.readFileSync(gpioPath, 'utf8'), family, socText),
    );
  }
  return out;
}
