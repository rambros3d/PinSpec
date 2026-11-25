/**
 * Narrow reader for the ATDF XML emitted by Microchip DFP packs.
 *
 * Only the sections consumed by the catalog are accessed: device variants,
 * pinouts, device-peripheral instance signals, memory segments, interrupts,
 * and instance parameters. Register maps and value groups are never emitted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { SAM_ATDF_PATHS } from '../../sources';
import type {
  AtdfDocument,
  AtdfInstance,
  AtdfMemorySegment,
  AtdfPinout,
  AtdfSignal,
  AtdfVariant,
} from './types';

/** XML parser instance configured to preserve ATDF attribute names verbatim. */
const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

type XmlRecord = Record<string, unknown>;

function record(value: unknown): XmlRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as XmlRecord)
    : {};
}

function attr(value: unknown, name: string): string | undefined {
  return str(record(value)[`@_${name}`]);
}

function readVariants(root: XmlRecord): AtdfVariant[] {
  return asArray<unknown>(record(root.variants).variant)
    .map((item) => {
      const ordercode = attr(item, 'ordercode');
      const pkg = attr(item, 'package');
      const pinout = attr(item, 'pinout');
      if (!ordercode || !pkg || !pinout) return undefined;
      return {
        ordercode,
        package: pkg,
        pinout,
        ...(attr(item, 'speedmax') ? { speedmax: attr(item, 'speedmax') } : {}),
        ...(attr(item, 'tempmin') ? { tempmin: attr(item, 'tempmin') } : {}),
        ...(attr(item, 'tempmax') ? { tempmax: attr(item, 'tempmax') } : {}),
        ...(attr(item, 'vccmin') ? { vccmin: attr(item, 'vccmin') } : {}),
        ...(attr(item, 'vccmax') ? { vccmax: attr(item, 'vccmax') } : {}),
      } satisfies AtdfVariant;
    })
    .filter((item): item is AtdfVariant => item !== undefined);
}

function readPinouts(root: XmlRecord): AtdfPinout[] {
  return asArray<unknown>(record(root.pinouts).pinout)
    .map((item) => {
      const name = attr(item, 'name');
      if (!name) return undefined;
      const pins = asArray<unknown>(record(item).pin).map((pin) => ({
        ...(attr(pin, 'position') ? { position: attr(pin, 'position') } : {}),
        pad: attr(pin, 'pad') ?? '',
      }));
      return { name, pins };
    })
    .filter((item): item is AtdfPinout => item !== undefined);
}

function readInstances(root: XmlRecord): AtdfInstance[] {
  const modules = asArray<unknown>(record(record(root.devices).device).peripherals).flatMap(
    (peripherals) => asArray<unknown>(record(peripherals).module),
  );
  // The top-level `<modules>` section holds register groups, not signals.
  // Only `<devices><device><peripherals><module><instance>` is consumed here.
  return modules.flatMap((module) =>
    asArray<unknown>(record(module).instance).map((instance) => {
      const signals: AtdfSignal[] = asArray<unknown>(record(instance).signals)
        .flatMap((signalsNode) => asArray<unknown>(record(signalsNode).signal))
        .map((signal) => ({
          group: attr(signal, 'group') ?? '',
          ...(attr(signal, 'index') ? { index: attr(signal, 'index') } : {}),
          function: attr(signal, 'function') ?? '',
          pad: attr(signal, 'pad') ?? '',
        }))
        .filter((signal) => signal.group !== '' && signal.pad !== '');
      return { name: attr(instance, 'name') ?? '', signals };
    }),
  ).filter((instance) => instance.name !== '');
}

function readMemories(root: XmlRecord): AtdfMemorySegment[] {
  const device = record(record(root.devices).device);
  const spaces = asArray<unknown>(record(device['address-spaces'])['address-space']);
  return spaces.flatMap((space) =>
    asArray<unknown>(record(space)['memory-segment']).map((segment) => ({
      name: attr(segment, 'name') ?? '',
      ...(attr(segment, 'size') ? { size: attr(segment, 'size') } : {}),
      ...(attr(segment, 'type') ? { type: attr(segment, 'type') } : {}),
    })),
  );
}

function readInterrupts(root: XmlRecord): string[] {
  const device = record(record(root.devices).device);
  return asArray<unknown>(record(device.interrupts).interrupt)
    .map((item) => attr(item, 'name'))
    .filter((name): name is string => name !== undefined);
}

function readParams(root: XmlRecord): string[] {
  const device = record(record(root.devices).device);
  const deviceParams = asArray<unknown>(record(device.parameters).param)
    .map((item) => attr(item, 'name'))
    .filter((name): name is string => name !== undefined);
  const instanceParams: string[] = [];
  // Instance parameter names are read from the raw tree separately to keep the
  // normalized instance records small.
  const modules = asArray<unknown>(record(device.peripherals).module);
  for (const module of modules) {
    for (const instance of asArray<unknown>(record(module).instance)) {
      for (const item of asArray<unknown>(record(record(instance).parameters).param)) {
        const name = attr(item, 'name');
        if (name) instanceParams.push(name);
      }
    }
  }
  return Array.from(new Set([...deviceParams, ...instanceParams])).sort();
}

/** Parses one ATDF file into the normalized intermediate record. */
export function parseAtdf(xml: string, stem: string): AtdfDocument {
  const root = record(PARSER.parse(xml)['avr-tools-device-file']);
  const device = record(record(root.devices).device);
  const pinouts = readPinouts(root);
  const instances = readInstances(root);
  return {
    stem,
    ...(attr(device, 'series') ? { series: attr(device, 'series') } : {}),
    ...(attr(device, 'architecture') ? { architecture: attr(device, 'architecture') } : {}),
    variants: readVariants(root),
    pinouts,
    instances,
    memories: readMemories(root),
    interrupts: readInterrupts(root),
    params: readParams(root),
    shape: {
      spdx: /SPDX-License-Identifier:\s*Apache-2\.0/.test(xml),
      pinCount: pinouts.reduce((total, pinout) => total + pinout.pins.length, 0),
      signalCount: instances.reduce((total, instance) => total + instance.signals.length, 0),
    },
  };
}

/** Reads one curated ATDF file from the gitignored raw-file cache. */
export function readAtdfFile(cacheDir: string, relativePath: string): AtdfDocument {
  const stem = path.basename(relativePath, '.atdf');
  return parseAtdf(fs.readFileSync(path.join(cacheDir, 'microchip-atdf', relativePath), 'utf8'), stem);
}

/** All curated ATDF paths in declaration order. */
export const ATDF_PATHS = SAM_ATDF_PATHS;
