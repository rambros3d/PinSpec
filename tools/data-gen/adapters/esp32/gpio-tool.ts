/**
 * Narrow line readers for `espressif/esp-gpio-tool` target YAML.
 * Only the declared fields are consumed; unexpected structure is skipped
 * rather than guessed, and a missing file yields no target.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GpioToolGpio, GpioToolSoc, GpioToolTarget } from './types';

/** Convert a lowercase target id into the first-party display name. */
export function displayFamily(family: string): string {
  const upper = family.toUpperCase();
  return upper === 'ESP32' ? upper : upper.replace(/^ESP32(S|C|H|P)/, 'ESP32-$1');
}

function braceField(text: string, key: string): string | null {
  const match = new RegExp(`(?:^|[,{\\s])${key}:\\s*([^,}\\n]+)`).exec(text);
  return match ? match[1].trim() : null;
}

function listField(text: string, key: string): string[] {
  const match = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(text);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter((item) => item.length > 0);
}

/** Parse one target YAML file into a normalized record. */
export function parseGpioToolTarget(text: string, family: string): GpioToolTarget {
  const lines = text.split(/\r?\n/);
  const gpios = new Map<number, GpioToolGpio>();
  const soc = new Map<string, GpioToolSoc>();
  let section = '';
  let sramKb = 0;
  let wifi = false;
  let adc2WifiConflict = false;
  let inWifi = false;
  let inAdc = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('features:')) {
      section = 'features';
      continue;
    }
    if (line.startsWith('gpio:')) {
      section = 'gpio';
      continue;
    }
    if (line.startsWith('soc:')) {
      section = 'soc';
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;

    if (section === 'features') {
      if (/^wifi:/.test(line)) {
        inWifi = true;
        inAdc = false;
        continue;
      }
      if (/^ADC:/.test(line)) {
        inAdc = true;
        inWifi = false;
        continue;
      }
      if (indent >= 4 && inWifi && /^supported:\s*true/.test(line)) wifi = true;
      if (indent >= 4 && inAdc && /^wifi_conflict:\s*true/.test(line)) adc2WifiConflict = true;
      if (/^sram_kb:/.test(line)) {
        const value = Number(/sram_kb:\s*(\d+)/.exec(line)?.[1] ?? 0);
        if (Number.isFinite(value)) sramKb = value;
      }
      continue;
    }

    if (section === 'gpio') {
      const gpioMatch = /^(\d+):\s*\{(.*)\}/.exec(line);
      if (!gpioMatch) continue;
      const gpio = Number(gpioMatch[1]);
      const body = gpioMatch[2];
      const strapping = braceField(body, 'strapping');
      const reset = braceField(body, 'at_reset');
      const outputFlag = braceField(body, 'is_output');
      gpios.set(gpio, {
        gpio,
        powerDomain: braceField(body, 'power_domain') ?? '',
        rtc: /\brtc:\s*true\b/.test(body),
        functions: listField(body, 'functions'),
        ...(strapping ? { strappingNote: strapping.replace(/^['"]|['"]$/g, '') } : {}),
        ...(reset === 'PUP' || reset === 'PDOWN' ? { atReset: reset } : {}),
        isOutput: outputFlag !== 'false',
      });
      continue;
    }

    if (section === 'soc') {
      const socMatch = /^([A-Za-z0-9-]+):\s*\{([^}]*)\}(.*)$/.exec(line);
      if (!socMatch) continue;
      const comment = socMatch[3] ?? '';
      const flashMatch = /flash\s+(\d+)\s*MB/i.exec(comment);
      soc.set(socMatch[1], {
        name: socMatch[1],
        reservedPins: listField(socMatch[2], 'reserved_pins').map(Number),
        notConnected: listField(socMatch[2], 'not_connected').map(Number),
        flashKb: flashMatch ? Number(flashMatch[1]) * 1024 : null,
        psram: /PSRAM/i.test(comment),
      });
    }
  }

  return { family, displayName: displayFamily(family), sramKb, wifi, adc2WifiConflict, gpios, soc };
}

/** Read every target YAML from a gpio-tool checkout. */
export function readGpioToolTargets(cacheDir: string): Map<string, GpioToolTarget> {
  const dir = path.join(cacheDir, 'esp-gpio-tool', 'esp_gpio_tool_cli', 'targets');
  const out = new Map<string, GpioToolTarget>();
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort()) {
    const family = file.replace(/\.yaml$/, '');
    out.set(
      family,
      parseGpioToolTarget(fs.readFileSync(path.join(dir, file), 'utf8'), family),
    );
  }
  return out;
}
