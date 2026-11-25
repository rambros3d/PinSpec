/** Narrow Zephyr device-tree reader for GPIO counts, flash size, and peripherals. */
import fs from 'node:fs';
import path from 'node:path';
import type { DeviceTree } from './types';

/** Parses one Nordic DTS file. Facts absent from the file are left null/empty. */
export function parseDeviceTree(text: string, file: string): DeviceTree {
  const gpioPorts: DeviceTree['gpioPorts'] = [];
  const gpioNode = /([\w.-]+):\s*gpio@[0-9a-fA-F]+\s*\{([\s\S]*?)\n\s*\};/g;
  for (const match of text.matchAll(gpioNode)) {
    const portMatch = match[2].match(/\bport\s*=\s*<\s*(\d+)\s*>/);
    const ngpiosMatch = match[2].match(/\bngpios\s*=\s*<\s*(\d+)\s*>/);
    gpioPorts.push({
      port: portMatch ? Number.parseInt(portMatch[1], 10) : -1,
      ngpios: ngpiosMatch ? Number.parseInt(ngpiosMatch[1], 10) : null,
    });
  }

  const flashNode = text.match(/flash0:\s*flash@0\s*\{([\s\S]*?)\n\s*\};/);
  const flashMatch = flashNode?.[1].match(/DT_SIZE_K\(\s*(\d+)\s*\)/);
  const flashKb = flashMatch ? Number.parseInt(flashMatch[1], 10) : null;
  const sramNode = text.match(
    /(?:sram0:\s*memory@[0-9a-fA-F]+|&sram0)\s*\{([\s\S]*?)\n\s*\};/,
  );
  const ramMatch = sramNode?.[1].match(/DT_SIZE_K\(\s*(\d+)\s*\)/);
  const ramKb = ramMatch ? Number.parseInt(ramMatch[1], 10) : null;

  const interrupts = Array.from(
    new Set(
      Array.from(text.matchAll(/\binterrupts\s*=\s*<\s*(\d+)/g), (match) => match[1]).sort(
        (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
      ),
    ),
  );
  const peripherals = Array.from(
    new Set(
      Array.from(text.matchAll(/compatible\s*=\s*"nordic,([^"]+)"/g), (match) => match[1]).sort(),
    ),
  );

  return { file, gpioPorts, flashKb, ramKb, interrupts, peripherals };
}

/** Reads one Nordic Zephyr device-tree file from the shared Zephyr cache. */
export function readDeviceTree(cacheDir: string, file: string): DeviceTree {
  return parseDeviceTree(
    fs.readFileSync(path.join(cacheDir, 'zephyr', file), 'utf8'),
    file,
  );
}
