/**
 * CH32 vendor adapter: converts the public CSV surface of
 * `ch32-riscv-ug/ch32-device-data` into complete `ChipData` catalog entries.
 *
 * Tables under the upstream `index/` directory are manifest-verified and are
 * the source of geometry, signals, and remaps. One additional checkout file,
 * `evidence/pins.csv`, supplies electrical I/O types; it has no upstream digest
 * entry, so this adapter requires its columns and records its own SHA-256 in
 * provenance. No other working-layer file is read.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogEvidenceFile,
  CatalogIndexEntry,
  ChipData,
  PeripheralInfo,
  PeripheralRemapOption,
  PinInfo,
  PinSignal,
  PinTag,
  PinType,
} from '../../../src/core/types';
import { parseCsv, requireColumns } from '../csv';
import { buildPackageInfo, classifyPeripheralKind } from '../helpers';
import { sha256Hex } from '../hashes';
import { CH32_EVIDENCE_FILE, LICENSE_CH32_DEVICE_DATA, ch32SourceSpecs } from '../sources';
import type {
  AdapterContext,
  AdapterResult,
  DeclaredSourceFile,
  Gate,
  GateContext,
  GateResult,
  VendorAdapter,
} from '../types';

export const CH32_SOURCE_ID = 'ch32-device-data';
export const CH32_INDEX_DIR = 'index';

/** Every CH32 CSV read by this adapter; each must have a manifest digest. */
export const CH32_CONSUMED_FILES = [
  'parts.csv',
  'pinout.csv',
  'routes.csv',
  'packages.csv',
  'series.csv',
] as const;

const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  'manifest.csv': ['path', 'rows', 'sha256'],
  'parts.csv': ['part_number', 'series', 'family', 'package', 'pins', 'flash_bytes', 'sram_bytes'],
  'pinout.csv': [
    'part_number', 'pin', 'pad', 'kind', 'peripheral', 'role', 'signal', 'route',
    'selector', 'value', 'af', 'condition', 'confidence', 'basis',
  ],
  'routes.csv': ['series', 'selector', 'value', 'register', 'bits'],
  'packages.csv': ['package', 'pin_count'],
  'series.csv': ['series', 'core'],
};

type Row = Record<string, string>;

export interface Ch32ManifestEntry {
  path: string;
  rows: number;
  sha256: string;
}

interface RouteEvidence {
  register: string;
  bits: string;
}

/** Parses `index/manifest.csv` into digest entries keyed by relative path. */
export function parseCh32Manifest(text: string): Map<string, Ch32ManifestEntry> {
  const { columns, rows } = parseCsv(text);
  requireColumns(columns, REQUIRED_COLUMNS['manifest.csv'], 'manifest.csv');
  const entries = new Map<string, Ch32ManifestEntry>();
  for (const row of rows) {
    const filePath = row.path.trim();
    if (!filePath) continue;
    entries.set(filePath, {
      path: filePath,
      rows: Number.parseInt(row.rows, 10) || 0,
      sha256: row.sha256.trim().toLowerCase(),
    });
  }
  return entries;
}

/**
 * Hashes every consumed CSV and compares it with `index/manifest.csv` before
 * any table is parsed. A missing or mismatching digest aborts CH32 generation
 * with an error naming the offending file.
 */
export function verifyCh32Sources(indexDir: string): Map<string, Ch32ManifestEntry> {
  const manifestPath = path.join(indexDir, 'manifest.csv');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`CH32 manifest verification failed: missing ${manifestPath}.`);
  }
  const manifest = parseCh32Manifest(fs.readFileSync(manifestPath, 'utf8'));
  for (const name of CH32_CONSUMED_FILES) {
    const expected = manifest.get(name);
    if (!expected) {
      throw new Error(`CH32 manifest verification failed: no digest entry for index/${name}.`);
    }
    const filePath = path.join(indexDir, name);
    const raw = fs.readFileSync(filePath);
    const actual = sha256Hex(raw);
    if (actual !== expected.sha256) {
      throw new Error(
        `CH32 manifest verification failed: SHA-256 mismatch for index/${name} ` +
        `(expected ${expected.sha256}, got ${actual}).`,
      );
    }
    const lineCount = parseCsv(raw.toString('utf8')).rows.length;
    if (lineCount !== expected.rows) {
      throw new Error(
        `CH32 manifest verification failed: row count mismatch for index/${name} ` +
        `(expected ${expected.rows}, got ${lineCount}).`,
      );
    }
  }
  return manifest;
}

/** Parsed tolerance evidence plus the digest of the exact upstream bytes. */
export interface Ch32ToleranceEvidence {
  rows: Row[];
  sha256: string;
  declared: DeclaredSourceFile;
}

/**
 * Reads the declared, non-manifest-verified electrical-kind file. Missing or
 * column-incomplete evidence aborts CH32 generation instead of silently
 * dropping tolerance tags.
 */
export function readCh32ToleranceEvidence(sourceDir: string): Ch32ToleranceEvidence {
  const declared = CH32_EVIDENCE_FILE;
  const target = path.join(sourceDir, declared.path);
  if (!fs.existsSync(target)) {
    throw new Error(`CH32 evidence verification failed: missing ${declared.path}.`);
  }
  const raw = fs.readFileSync(target);
  const { columns, rows } = parseCsv(raw.toString('utf8'));
  requireColumns(columns, declared.columns, declared.path);
  if (rows.length === 0) {
    throw new Error(`CH32 evidence verification failed: ${declared.path} has no data rows.`);
  }
  return { rows, sha256: sha256Hex(raw), declared };
}

/** Normalized join key spanning part number, physical pin position, and pad. */
export function ch32ToleranceKey(part: string, pin: string, pad: string): string {
  return [part, pin, pad]
    .map((value) => (value ?? '').trim().toUpperCase())
    .join('|');
}

/** Keys of upstream `I/O/FT` rows; plain `I/O` and other kinds are excluded. */
export function ch32FtToleranceKeys(rows: Row[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if ((row.type ?? '').trim().toLowerCase() !== 'i/o/ft') continue;
    keys.add(ch32ToleranceKey(row.part_number, row.pin, row.pad));
  }
  return keys;
}

/** Provenance record for the evidence file consumed by a CH32 generation run. */
export function ch32EvidenceProvenance(evidence: Ch32ToleranceEvidence): CatalogEvidenceFile {
  return {
    path: evidence.declared.path,
    sha256: evidence.sha256,
    rows: evidence.rows.length,
    url: evidence.declared.url,
    license: LICENSE_CH32_DEVICE_DATA,
  };
}

/** Reads and column-checks one manifest-verified CSV table. */
function readTable(indexDir: string, name: string): Row[] {
  const raw = fs.readFileSync(path.join(indexDir, name), 'utf8');
  const { columns, rows } = parseCsv(raw);
  requireColumns(columns, REQUIRED_COLUMNS[name], name);
  return rows;
}

/** Maps a source route to a remap-group id. AF-number routes use remap zero. */
export function routeToRemapId(route: string): number {
  const remap = /^remap-(\d+)$/.exec(route.trim());
  return remap ? Number.parseInt(remap[1], 10) : 0;
}

/** Returns a display label for a route, or undefined for the default route. */
export function routeFuncLabel(route: string): string | undefined {
  const trimmed = route.trim();
  const remap = /^remap-(\d+)$/.exec(trimmed);
  if (remap) return `RM${remap[1]}`;
  const af = /^af-(\d+)$/.exec(trimmed);
  if (af) return `AF${af[1]}`;
  return undefined;
}

/** Maps an upstream electrical `kind` plus pad name to a catalog pin type. */
export function mapPinType(kind: string, pad: string): PinType {
  const lower = (kind ?? '').trim().toLowerCase();
  const name = (pad ?? '').trim().toUpperCase();
  if (lower === 'power') return 'power';
  if (lower === 'nc') return 'nc';
  if (lower === 'reset' || name === 'NRST' || name === 'RST') return 'reset';
  if (lower === 'boot' || /^BOOT[0-9]?$/.test(name)) return 'boot';
  if (lower === 'mono' || lower === 'monoio') return 'mono';
  return 'io';
}

/**
 * Applies evidence-based semantic tags. 1-wire SDI signals are distinguished
 * from two-wire SWD pairs by the upstream signal spelling; 5 V tolerance is
 * only tagged when a row's condition or basis explicitly documents it.
 */
export function derivePinTags(rows: Row[]): PinTag[] {
  const tags = new Set<PinTag>();
  for (const row of rows) {
    const peripheral = (row.peripheral ?? '').toUpperCase();
    const role = (row.role ?? '').toUpperCase();
    const signal = (row.signal ?? '').toUpperCase();
    const pad = (row.pad ?? '').toUpperCase();
    const evidence = `${row.condition ?? ''} ${row.basis ?? ''}`;

    if (peripheral === 'SDI') {
      if (/^(SWIO|SWIM|DIO)$/.test(signal) || (role === 'SWDIO' && signal === 'SWIO')) {
        tags.add('debug-sdi');
      } else if (/^(SWDIO|SWCLK|DCK)$/.test(signal) || /^(SWDIO|SWCLK)$/.test(role)) {
        tags.add('debug-swd');
      }
    }
    if (/^USB/.test(peripheral)) tags.add('usb');
    if (/^ADC/.test(peripheral) && /^IN\d+$/.test(role)) tags.add('adc');
    if (/^BOOT[0-9]?$/.test(pad) || /^BOOT[0-9]?$/.test(role)) tags.add('boot');
    if (/5\s*V/i.test(evidence)) tags.add('5v-tolerant');
  }
  return Array.from(tags).sort();
}

/** Builds a register note only when `index/routes.csv` actually carries evidence. */
export function buildRegisterNote(
  series: string,
  selector: string,
  value: string,
  routeIndex: Map<string, RouteEvidence>,
): string | undefined {
  if (!selector || !value) return undefined;
  const evidence =
    routeIndex.get(`${series}|${selector}|${value}`) ?? routeIndex.get(`${selector}|${value}`);
  if (!evidence || !evidence.register) return undefined;
  const bit = evidence.bits.split(';')[0].split(':').pop()?.trim() || evidence.bits;
  return bit ? `${evidence.register}[${bit}] = ${value}` : undefined;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Canonical solver-facing signal name; upstream `role` is the normalized one. */
function canonicalSignal(row: Row): string {
  return (row.role || row.signal || '').trim();
}

function remapName(id: number): string {
  return id === 0 ? 'Default (RM0)' : `Remap ${id} (RM${id})`;
}

/**
 * Converts one part's pinout rows into a complete chip. The caller is
 * responsible for deferring malformed or low-confidence parts before calling.
 */
export function buildCh32Chip(
  part: Row,
  pinoutRows: Row[],
  routeIndex: Map<string, RouteEvidence>,
  core: string,
  ftToleranceKeys: ReadonlySet<string> = new Set<string>(),
): ChipData {
  const partId = part.part_number.trim().toUpperCase();
  const series = part.series.trim();
  const family = (part.family || part.series).trim();
  const pinsByPosition = new Map<string, Row[]>();
  let hasExposedPad = false;

  for (const row of pinoutRows) {
    const pos = (row.pin || '').trim();
    if (!pos || pos.toUpperCase() === 'EP' || pos.toUpperCase() === 'EXPOSED') {
      if (pos) hasExposedPad = true;
      continue;
    }
    const bucket = pinsByPosition.get(pos) ?? [];
    bucket.push(row);
    pinsByPosition.set(pos, bucket);
  }

  const positions = Array.from(pinsByPosition.keys()).sort(naturalCompare);
  const packageInfo = buildPackageInfo(part.package, positions);
  const declaredPins = Number.parseInt(part.pins, 10) || positions.length;
  packageInfo.pinCount = declaredPins;
  if (hasExposedPad) packageInfo.hasExposedPad = true;

  const pins: PinInfo[] = [];
  const peripherals: Record<string, PeripheralInfo> = {};
  const remapOptions = new Map<string, Map<number, PeripheralRemapOption>>();
  const peripheralSignals = new Map<string, Set<string>>();

  const registerPeripheral = (peripheral: string, signal: string): PeripheralInfo => {
    let entry = peripherals[peripheral];
    if (!entry) {
      entry = {
        kind: peripheral === 'SDI' ? 'sys' : classifyPeripheralKind(peripheral),
        signals: [],
        remaps: [],
      };
      peripherals[peripheral] = entry;
    }
    if (signal) {
      const set = peripheralSignals.get(peripheral) ?? new Set<string>();
      set.add(signal);
      peripheralSignals.set(peripheral, set);
    }
    return entry;
  };

  for (const pos of positions) {
    const rows = pinsByPosition.get(pos)!;
    const padNames = Array.from(new Set(rows.map((r) => r.pad.trim()).filter(Boolean)));
    const signalMap = new Map<string, PinSignal>();

    for (const row of rows) {
      const peripheral = (row.peripheral || '').trim();
      const route = (row.route || '').trim();
      if (route === 'alias') continue;
      const signalName = canonicalSignal(row);
      const remapId = routeToRemapId(route);
      const funcLabel = routeFuncLabel(route);

      if (peripheral && signalName) {
        const key = `${peripheral}|${signalName}|${remapId}`;
        if (!signalMap.has(key)) {
          signalMap.set(key, {
            peripheral,
            signal: signalName,
            af: null,
            ...(funcLabel ? { funcLabel } : {}),
            remapId,
          });
        }
        registerPeripheral(peripheral, signalName);

        const byId = remapOptions.get(peripheral) ?? new Map<number, PeripheralRemapOption>();
        remapOptions.set(peripheral, byId);
        let option = byId.get(remapId);
        if (!option) {
          const note = buildRegisterNote(series, row.selector, row.value, routeIndex);
          option = {
            id: remapId,
            name: remapName(remapId),
            signals: {},
            ...(note ? { registerNote: note } : {}),
          };
          byId.set(remapId, option);
        }
        if (row.pad && !(signalName in option.signals)) {
          option.signals[signalName] = row.pad;
        }
      }
    }

    const kinds = rows.map((r) => mapPinType(r.kind, r.pad));
    const pinType = kinds.includes('io') ? 'io' : kinds[0] ?? 'io';
    const tags = derivePinTags(rows);
    if (padNames.some((pad) => ftToleranceKeys.has(ch32ToleranceKey(partId, pos, pad)))) {
      tags.push('5v-tolerant');
    }
    if (padNames.length > 1) tags.push('bonded');

    pins.push({
      pos,
      name: padNames.length === 1 ? padNames[0] : padNames.join(' / '),
      type: pinType,
      signals: Array.from(signalMap.values()).sort((a, b) =>
        a.peripheral.localeCompare(b.peripheral, undefined, { numeric: true }) ||
        a.signal.localeCompare(b.signal, undefined, { numeric: true }) ||
        (a.remapId ?? 0) - (b.remapId ?? 0),
      ),
      ...(padNames.length > 1 ? { bondedNames: padNames } : {}),
      ...(tags.length > 0 ? { tags: Array.from(new Set(tags)).sort() } : {}),
    });
  }

  for (const [peripheral, options] of remapOptions) {
    peripherals[peripheral].remaps = Array.from(options.values()).sort((a, b) => a.id - b.id);
    peripherals[peripheral].signals = Array.from(peripheralSignals.get(peripheral) ?? []).sort(
      naturalCompare,
    );
  }

  const flashKb = Math.round((Number.parseInt(part.flash_bytes, 10) || 0) / 1024);
  const ramKb = Math.round((Number.parseInt(part.sram_bytes, 10) || 0) / 1024);

  return {
    id: partId,
    vendor: 'ch32',
    muxModel: 'remap-group',
    family,
    core: core || 'QingKe RISC-V',
    flashKb,
    ramKb,
    package: packageInfo,
    pins,
    peripherals,
  };
}

/** Index entry for one emitted CH32 part. */
export function ch32IndexEntry(chip: ChipData): CatalogIndexEntry {
  const counts = { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 };
  for (const info of Object.values(chip.peripherals)) {
    if (info.kind in counts) counts[info.kind as keyof typeof counts]++;
  }
  return {
    id: chip.id,
    vendor: 'ch32',
    family: chip.family,
    core: chip.core,
    package: chip.package.name,
    pinCount: chip.package.pinCount,
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    peripherals: counts,
  };
}

/** Generates every CH32 chip shard and index entry from the acquired source. */
export function generateCh32(ctx: AdapterContext): AdapterResult {
  const source = ctx.sources.find((s) => s.id === CH32_SOURCE_ID);
  if (!source) {
    throw new Error(`CH32 adapter requires the ${CH32_SOURCE_ID} source.`);
  }
  const indexDir = path.join(source.dir, CH32_INDEX_DIR);
  console.log('Loading CH32 ch32-device-data index tables...');
  verifyCh32Sources(indexDir);
  const evidence = readCh32ToleranceEvidence(source.dir);
  const ftToleranceKeys = ch32FtToleranceKeys(evidence.rows);

  const partRows = readTable(indexDir, 'parts.csv');
  const pinoutRows = readTable(indexDir, 'pinout.csv');
  const routeRows = readTable(indexDir, 'routes.csv');
  readTable(indexDir, 'packages.csv'); // required-column check; package geometry comes from parts
  const seriesRows = readTable(indexDir, 'series.csv');

  const coreBySeries = new Map<string, string>();
  for (const row of seriesRows) {
    if (row.series && row.core) coreBySeries.set(row.series.trim(), row.core.trim());
  }

  const routeIndex = new Map<string, RouteEvidence>();
  for (const row of routeRows) {
    if (!row.selector || !row.value || !row.register) continue;
    const evidence = { register: row.register.trim(), bits: (row.bits ?? '').trim() };
    const key = `${row.series}|${row.selector}|${row.value}`;
    if (!routeIndex.has(key)) routeIndex.set(key, evidence);
    const fallback = `${row.selector}|${row.value}`;
    if (!routeIndex.has(fallback)) routeIndex.set(fallback, evidence);
  }

  const pinoutsByPart = new Map<string, Row[]>();
  for (const row of pinoutRows) {
    const id = (row.part_number || '').trim().toUpperCase();
    if (!id) continue;
    const bucket = pinoutsByPart.get(id) ?? [];
    bucket.push(row);
    pinoutsByPart.set(id, bucket);
  }

  const chips = new Map<string, ChipData>();
  const index = new Map<string, CatalogIndexEntry>();
  const families = new Set<string>();
  let totalVariants = 0;
  let matchedVariants = 0;

  for (const part of partRows) {
    const id = (part.part_number || '').trim().toUpperCase();
    totalVariants++;
    if (!id || !/^CH32/.test(id)) {
      ctx.warnings.add({ vendor: 'ch32', refName: id || '(empty)', reason: 'Unrecognized CH32 part number; part deferred.' });
      continue;
    }
    const rows = pinoutsByPart.get(id) ?? [];
    if (rows.length === 0) {
      ctx.warnings.add({
        vendor: 'ch32',
        refName: id,
        reason: 'Part has no pinout rows in the CH32 index; uncovered stem deferred.',
      });
      continue;
    }
    const lowConfidence = rows.find((r) => !['confirmed', 'reference'].includes((r.confidence ?? '').trim()));
    if (lowConfidence) {
      ctx.warnings.add({
        vendor: 'ch32',
        refName: id,
        reason: `Pinout rows with confidence '${lowConfidence.confidence || 'unspecified'}' are not corroborated; part deferred.`,
      });
      continue;
    }
    const declaredPins = Number.parseInt(part.pins, 10) || 0;
    if (declaredPins <= 0 || !(Number.parseInt(part.flash_bytes, 10) > 0)) {
      ctx.warnings.add({
        vendor: 'ch32',
        refName: id,
        reason: `Invalid package pin count (${part.pins}) or flash size (${part.flash_bytes}); part deferred.`,
      });
      continue;
    }

    const chip = buildCh32Chip(
      part,
      rows,
      routeIndex,
      coreBySeries.get((part.series || '').trim()) ?? '',
      ftToleranceKeys,
    );
    chips.set(id, chip);
    index.set(id, ch32IndexEntry(chip));
    families.add(chip.family);
    matchedVariants++;
  }

  // Pinout rows without a matching part record are uncovered variants.
  const partIds = new Set(partRows.map((p) => (p.part_number || '').trim().toUpperCase()));
  for (const id of pinoutsByPart.keys()) {
    if (!partIds.has(id)) {
      ctx.warnings.add({
        vendor: 'ch32',
        refName: id,
        reason: 'Pinout rows exist but no part record covers this stem; uncovered variant deferred.',
      });
      totalVariants++;
    }
  }

  console.log(
    `CH32 adapter: ${partRows.length} parts in source, emitted ${chips.size} chips ` +
    `from ${pinoutRows.length} pinout rows.`,
  );

  return {
    vendor: 'ch32',
    chips,
    index: Array.from(index.values()).sort((a, b) => a.id.localeCompare(b.id)),
    families: Array.from(families).sort(),
    totalVariants,
    matchedVariants,
    evidenceFiles: [ch32EvidenceProvenance(evidence)],
  };
}

interface Ch32Reference {
  id: string;
  pkg: string;
  pins: number;
  hasExposedPad: boolean;
  bonded?: boolean;
}

/** Four priority parts from the CH32 gate contract. */
export const CH32_REFERENCES: readonly Ch32Reference[] = [
  { id: 'CH32V003F4P6', pkg: 'TSSOP20', pins: 20, hasExposedPad: false },
  { id: 'CH32V003J4M6', pkg: 'SOP8', pins: 8, hasExposedPad: false, bonded: true },
  { id: 'CH32V203C8T6', pkg: 'LQFP48', pins: 48, hasExposedPad: true },
  { id: 'CH32X035G8U6', pkg: 'QFN28', pins: 28, hasExposedPad: true },
];

/** Per-part package, bonding, mux, remap, and tag assertions for the CH32 gate. */
export const ch32ReferenceGate: Gate = {
  name: 'ch32-reference-parts',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    let groupedRemaps = 0;
    let sdiTaggedPd1 = 0;
    let ftTaggedParts = 0;
    for (const ref of CH32_REFERENCES) {
      const errorCountBefore = errors.length;
      const chip = ctx.chips.get(ref.id);
      if (!chip) {
        errors.push(`CH32 gate failed: missing reference part ${ref.id}.`);
        continue;
      }
      if (chip.vendor !== 'ch32' || chip.muxModel !== 'remap-group') {
        errors.push(
          `CH32 gate failed: ${ref.id} expected vendor ch32 and muxModel remap-group, ` +
          `got ${chip.vendor}/${chip.muxModel}.`,
        );
      }
      if (chip.package.name !== ref.pkg) {
        errors.push(
          `CH32 gate failed: ${ref.id} expected package ${ref.pkg}, got ${chip.package.name}.`,
        );
      }
      if (chip.pins.length !== ref.pins || chip.package.pinCount !== ref.pins) {
        errors.push(
          `CH32 gate failed: ${ref.id} expected ${ref.pins} pins, got ${chip.pins.length} ` +
          `(package pinCount ${chip.package.pinCount}).`,
        );
      }
      if (Boolean(chip.package.hasExposedPad) !== ref.hasExposedPad) {
        errors.push(
          `CH32 gate failed: ${ref.id} expected hasExposedPad=${ref.hasExposedPad}, ` +
          `got ${Boolean(chip.package.hasExposedPad)}.`,
        );
      }
      if (ref.bonded && !chip.pins.some((p) => (p.bondedNames?.length ?? 0) > 1)) {
        errors.push(`CH32 gate failed: ${ref.id} has no bonded physical lead.`);
      }
      if (ref.bonded && !chip.pins.some((p) => p.tags?.includes('bonded'))) {
        errors.push(`CH32 gate failed: ${ref.id} bonded lead is missing the bonded tag.`);
      }
      if (chip.pins.some((p) => p.signals.some((s) => s.af !== null))) {
        errors.push(`CH32 gate failed: ${ref.id} has a signal with a non-null AF index.`);
      }
      for (const peripheral of Object.values(chip.peripherals)) {
        for (const remap of peripheral.remaps ?? []) {
          groupedRemaps += 1;
          if (!Number.isInteger(remap.id) || Object.keys(remap.signals).length === 0) {
            errors.push(`CH32 gate failed: ${ref.id} has an empty or unnumbered remap group.`);
          }
        }
      }
      if (chip.pins.some((p) =>
        (p.name.includes('PD1') || (p.bondedNames ?? []).includes('PD1')) &&
        p.tags?.includes('debug-sdi'),
      )) {
        sdiTaggedPd1 += 1;
      }
      if (chip.pins.some((p) => p.tags?.includes('5v-tolerant'))) {
        ftTaggedParts += 1;
      }
      if (errors.length === errorCountBefore) {
        console.log(`  ch32 reference: ${ref.id} ${ref.pins} pins OK`);
      }
    }
    if (groupedRemaps === 0) {
      errors.push('CH32 gate failed: no priority part contains grouped remaps[].');
    }
    if (sdiTaggedPd1 === 0) {
      errors.push('CH32 gate failed: no priority part carries a debug-sdi tag on PD1.');
    }
    if (ftTaggedParts === 0) {
      errors.push(
        `CH32 gate failed: no priority part (${CH32_REFERENCES.map((ref) => ref.id).join(', ')}) ` +
        `carries a 5v-tolerant pin from ${CH32_EVIDENCE_FILE.path}.`,
      );
    }
    return { vendor: 'ch32', name: 'ch32-reference-parts', errors, notes: [] };
  },
};

/** Requires the complete 105-part upstream catalog to be emitted. */
export const ch32CountGate: Gate = {
  name: 'ch32-part-count',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    if (ctx.index.length !== 105) {
      errors.push(`CH32 gate failed: expected 105 covered parts, got ${ctx.index.length}.`);
    }
    console.log(`  ch32 parts: ${ctx.index.length} emitted`);
    return { vendor: 'ch32', name: 'ch32-part-count', errors, notes: [] };
  },
};

/** Registered CH32 vendor adapter. */
export const ch32Adapter: VendorAdapter = {
  vendor: 'ch32',
  sourceSpecs: ch32SourceSpecs(),
  primarySourceId: CH32_SOURCE_ID,
  generate: generateCh32,
  gates: [ch32ReferenceGate, ch32CountGate],
  strict: true,
};
