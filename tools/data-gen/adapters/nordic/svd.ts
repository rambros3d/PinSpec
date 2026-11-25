/** Narrow CMSIS-SVD reader. Register maps are never used as physical pin evidence. */
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type { SvdDevice } from './types';

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/** Parses one SVD file into peripheral, interrupt, CPU, and address-block facts. */
export function parseSvd(xml: string, file = 'unknown.svd'): SvdDevice {
  const device = (PARSER.parse(xml) as Record<string, unknown>).device as Record<string, unknown>;
  const peripheralNode = device.peripherals as Record<string, unknown> | undefined;
  const peripherals = asArray<Record<string, unknown>>(
    peripheralNode?.peripheral as unknown as Record<string, unknown> | undefined,
  );
  const cpuNames = asArray<Record<string, unknown>>(device.cpu as Record<string, unknown>)
    .map((cpu) => text(cpu.name))
    .filter((name) => name !== '');
  const interrupts = new Set<string>();
  const addressBlockBytes: Record<string, number> = {};
  for (const peripheral of peripherals) {
    const name = text(peripheral.name);
    for (const interrupt of asArray<Record<string, unknown>>(
      peripheral.interrupt as unknown as Record<string, unknown> | undefined,
    )) {
      const label = text(interrupt.name);
      if (label !== '') interrupts.add(label);
    }
    const block = peripheral.addressBlock as Record<string, unknown> | undefined;
    const size = Number(block?.size);
    if (name !== '' && Number.isFinite(size) && size > 0) addressBlockBytes[name] = size;
  }
  return {
    name: text(device.name) || path.basename(file, '.svd'),
    series: text(device.series),
    cpuNames,
    peripherals: peripherals.map((item) => text(item.name)).filter((name) => name !== ''),
    interrupts: Array.from(interrupts).sort(),
    addressBlockBytes,
  };
}

/** Reads one SVD file from the gitignored nrf-pacs checkout. */
export function readSvd(cacheDir: string, file: string): SvdDevice {
  return parseSvd(fs.readFileSync(path.join(cacheDir, 'nrf-pacs', 'svds', file), 'utf8'), file);
}

/** Human-readable core label from CMSIS-SVD CPU names. */
export function coreLabel(cpuNames: string[]): string {
  const labels = cpuNames.map((name) => {
    const upper = name.toUpperCase();
    if (upper.startsWith('CM0')) return 'Cortex-M0+';
    if (upper.startsWith('CM4')) return 'Cortex-M4';
    if (upper.startsWith('CM7')) return 'Cortex-M7';
    if (upper.startsWith('CM33') || upper === 'CM33') return 'Cortex-M33';
    return name;
  });
  return Array.from(new Set(labels)).sort().join(' + ') || 'unknown';
}
