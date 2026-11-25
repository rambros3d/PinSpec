/**
 * STM32 vendor adapter: joins ST open pin XML geometry with Embassy AF/DMA data.
 *
 * All parsing, matching, normalization, and chip emission for STM32 lives here.
 * The orchestrator owns filesystem writes so every vendor contributes to the
 * same artifacts. Chip shard bytes are `JSON.stringify(chip)`, unchanged from
 * the pre-refactor generator.
 */
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type {
  CatalogIndexEntry,
  ChipData,
  PeripheralDma,
  PeripheralInfo,
  PinInfo,
  PinSignal,
} from '../../../src/core/types';
import {
  buildPackageInfo,
  canonicalizePartId,
  classifyPeripheralKind,
  expandRefNameVariants,
  extractEmbassyStem,
  extractGpioNames,
  indexGeometryFromPackage,
  normalizeCoreName,
  normalizePinType,
  normalizeSysSignals,
  parseXmlSignalName,
} from '../helpers';
import { stm32SourceSpecs } from '../sources';
import type {
  AdapterContext,
  AdapterResult,
  Gate,
  GateContext,
  GateResult,
  VendorAdapter,
} from '../types';

interface EmbassyPinEntry {
  pin: string;
  signal: string;
  af?: number;
}

interface EmbassyDmaEntry {
  signal: string;
  channel?: string;
  dmamux?: string;
  dma?: string;
  request?: number;
}

interface EmbassyPeripheral {
  name: string;
  registers?: { kind?: string };
  pins?: EmbassyPinEntry[];
  dma_channels?: EmbassyDmaEntry[];
}

interface EmbassyCore {
  name: string;
  peripherals?: EmbassyPeripheral[];
}

interface EmbassyMemoryRegion {
  name: string;
  kind: string;
  size: number;
}

interface EmbassyPackage {
  name: string;
  package: string;
  pins?: Array<{ position: string; signals: string[] }>;
}

interface EmbassyChip {
  name: string;
  family: string;
  line?: string;
  packages?: EmbassyPackage[];
  memory?: EmbassyMemoryRegion[][] | EmbassyMemoryRegion[];
  cores?: EmbassyCore[];
}

interface XmlSignalNode {
  '@_Name'?: string;
  '@_IOModes'?: string;
}

interface XmlPinNode {
  '@_Name'?: string;
  '@_Position'?: string;
  '@_Type'?: string;
  '@_Variant'?: string;
  Signal?: XmlSignalNode | XmlSignalNode[];
}

interface XmlMcuRoot {
  '@_Family'?: string;
  '@_Line'?: string;
  '@_Package'?: string;
  '@_RefName'?: string;
  Core?: string | string[];
  Flash?: number | string | Array<number | string>;
  Ram?: number | string | Array<number | string>;
  Pin?: XmlPinNode | XmlPinNode[];
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseKbMemory(embassyChip: EmbassyChip): { flashKb: number; ramKb: number } {
  let flashBytes = 0;
  let ramBytes = 0;
  const mem = embassyChip.memory;
  if (!mem) return { flashKb: 0, ramKb: 0 };

  // Embassy memory is typically array of banks (take first bank config to avoid double counting dual-bank views)
  const regions: EmbassyMemoryRegion[] = Array.isArray(mem[0])
    ? (mem[0] as EmbassyMemoryRegion[])
    : (mem as EmbassyMemoryRegion[]);

  const seenRam = new Set<string>();
  const seenFlash = new Set<string>();
  for (const r of regions) {
    if (!r || typeof r.size !== 'number') continue;
    if (r.kind === 'flash' && !seenFlash.has(r.name)) {
      seenFlash.add(r.name);
      flashBytes += r.size;
    } else if (r.kind === 'ram' && !seenRam.has(r.name)) {
      // Avoid counting CCMRAM_ICODE and CCMRAM_DCODE twice if both exist
      if (r.name === 'CCMRAM_ICODE' && regions.some((x) => x.name === 'CCMRAM_DCODE')) {
        continue;
      }
      seenRam.add(r.name);
      ramBytes += r.size;
    }
  }

  return {
    flashKb: Math.round(flashBytes / 1024),
    ramKb: Math.round(ramBytes / 1024),
  };
}

function formatDmaChannels(entries: EmbassyDmaEntry[] | undefined): PeripheralDma[] | undefined {
  if (!entries || entries.length === 0) return undefined;
  const bySignal = new Map<string, Set<string>>();

  for (const e of entries) {
    if (!e.signal) continue;
    const set = bySignal.get(e.signal) ?? new Set<string>();
    if (e.channel) {
      set.add(e.channel);
    } else if (e.dmamux) {
      set.add(e.request !== undefined ? `${e.dmamux}_REQ${e.request}` : e.dmamux);
    } else if (e.dma) {
      set.add(e.request !== undefined ? `${e.dma}_REQ${e.request}` : e.dma);
    }
    bySignal.set(e.signal, set);
  }

  const out: PeripheralDma[] = [];
  for (const [signal, channels] of bySignal.entries()) {
    if (channels.size > 0) {
      out.push({
        signal,
        channels: Array.from(channels).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        ),
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

function isSmpsVariant(name: string, pinNames: string[]): boolean {
  if (/(Q|P)$/.test(name) && !/LQFP/.test(name)) return true;
  return pinNames.some((n) => /SMPS/i.test(n));
}

/** Generates every STM32 chip shard and index entry from the acquired sources. */
export function generateStm32(ctx: AdapterContext): AdapterResult {
  const openPinSource = ctx.sources.find((s) => s.id === 'stm32-open-pin-data');
  const embassySource = ctx.sources.find((s) => s.id === 'embassy-stm32-data');
  if (!openPinSource || !embassySource) {
    throw new Error('STM32 adapter requires stm32-open-pin-data and embassy-stm32-data sources.');
  }

  const embassyChipsDir = path.join(embassySource.dir, 'data', 'chips');
  const xmlMcuDir = path.join(openPinSource.dir, 'mcu');

  // 1. Load all Embassy chips into lookup tables
  console.log('Loading Embassy stm32-data-generated chips...');
  const embassyFiles = fs.readdirSync(embassyChipsDir).filter((f) => f.endsWith('.json'));
  const embassyByStem = new Map<string, EmbassyChip>();
  const embassyByExactPkgName = new Map<string, EmbassyChip>();
  const embassyFallbackIndex = new Map<string, EmbassyChip>();

  for (const file of embassyFiles) {
    const raw = fs.readFileSync(path.join(embassyChipsDir, file), 'utf8');
    const chip = JSON.parse(raw) as EmbassyChip;
    const stem = chip.name.toUpperCase();
    embassyByStem.set(stem, chip);

    for (const pkg of chip.packages ?? []) {
      const pkgNameUpper = pkg.name.toUpperCase();
      embassyByExactPkgName.set(pkgNameUpper, chip);
      const pinNames = (pkg.pins ?? []).flatMap((p) => p.signals);
      const smps = isSmpsVariant(pkg.name, pinNames) ? 'smps' : 'std';
      const fallbackKey = [
        (chip.family ?? '').toUpperCase(),
        (chip.line ?? '').toUpperCase(),
        (pkg.package ?? '').toUpperCase(),
        String(pkg.pins?.length ?? 0),
        smps,
      ].join('|');
      if (!embassyFallbackIndex.has(fallbackKey)) {
        embassyFallbackIndex.set(fallbackKey, chip);
      }
    }
  }
  console.log(`Loaded ${embassyByStem.size} Embassy chip definitions.`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: true,
    trimValues: true,
  });

  const xmlFiles = fs.readdirSync(xmlMcuDir).filter((f) => f.endsWith('.xml')).sort();
  const chips = new Map<string, ChipData>();
  const index = new Map<string, CatalogIndexEntry>();
  const familiesSet = new Set<string>();

  let totalVariants = 0;
  let matchedVariants = 0;

  for (const file of xmlFiles) {
    let parsed: { Mcu?: XmlMcuRoot };
    try {
      const xmlStr = fs.readFileSync(path.join(xmlMcuDir, file), 'utf8');
      parsed = parser.parse(xmlStr) as { Mcu?: XmlMcuRoot };
    } catch (err) {
      ctx.warnings.add({
        vendor: 'stm32',
        file,
        reason: `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const mcu = parsed.Mcu;
    if (!mcu || !mcu['@_RefName'] || !mcu['@_Package']) {
      ctx.warnings.add({
        vendor: 'stm32',
        file,
        reason: 'Missing Mcu RefName or Package attribute.',
      });
      continue;
    }

    const family = String(mcu['@_Family'] ?? '').toUpperCase();
    const line = String(mcu['@_Line'] ?? '').toUpperCase();
    const pkgName = String(mcu['@_Package']).trim();
    const refName = String(mcu['@_RefName']).trim();
    const xmlPins = toArray(mcu.Pin);
    if (xmlPins.length === 0) {
      ctx.warnings.add({
        vendor: 'stm32',
        file,
        refName,
        reason: 'No <Pin> elements in XML.',
      });
      continue;
    }

    const xmlFlashes = toArray(mcu.Flash).map((v) => Number(v) || 0);
    const xmlRams = toArray(mcu.Ram).map((v) => Number(v) || 0);
    const xmlCore = normalizeCoreName(toArray(mcu.Core)[0]);

    const expandedRefs = expandRefNameVariants(refName);
    const allRawPinNames = xmlPins.map((p) => String(p['@_Name'] ?? ''));

    for (let idx = 0; idx < expandedRefs.length; idx++) {
      const variantRef = expandedRefs[idx];
      const partId = canonicalizePartId(variantRef).toUpperCase();

      // Skip already emitted identical part ID
      if (chips.has(partId)) continue;

      // Match against Embassy stm32-data-generated
      const stem = extractEmbassyStem(variantRef).toUpperCase();
      let embassyChip: EmbassyChip | undefined =
        embassyByExactPkgName.get(variantRef.toUpperCase()) ??
        embassyByStem.get(stem);

      if (!embassyChip) {
        // Fallback: (family, line, package, pin_count, smps_variant)
        const uniquePosCount = new Set(xmlPins.map((p) => String(p['@_Position'] ?? ''))).size;
        const smps = isSmpsVariant(variantRef, allRawPinNames) ? 'smps' : 'std';
        const fallbackKey = [family, line, pkgName.toUpperCase(), String(uniquePosCount), smps].join('|');
        embassyChip = embassyFallbackIndex.get(fallbackKey);
      }

      const isLinuxMpu = family.startsWith('STM32MP');
      if (!isLinuxMpu) {
        totalVariants++;
      }

      if (!embassyChip) {
        ctx.warnings.add({
          vendor: 'stm32',
          file,
          refName: variantRef,
          reason: isLinuxMpu
            ? `Skipped Cortex-A MPU ${variantRef} (outside Cortex-M Embassy catalog).`
            : `No Embassy chip match for stem ${stem} (${family} / ${pkgName}).`,
        });
        continue;
      }

      if (!isLinuxMpu) {
        matchedVariants++;
      }

      // Build GPIO -> PinSignal[] lookup from Embassy cores[0] (and secondary core if dual-core)
      const isF1 = family === 'STM32F1';
      const embassyPinSignals = new Map<string, PinSignal[]>();
      const embassyPeriphs = new Map<
        string,
        { kind: PeripheralInfo['kind']; signals: Set<string>; dma?: PeripheralDma[] }
      >();

      for (const core of embassyChip.cores ?? []) {
        for (const periph of core.peripherals ?? []) {
          if (!periph.name) continue;
          const pName = periph.name.toUpperCase();
          const pKind = classifyPeripheralKind(pName, periph.registers?.kind);
          const dma = formatDmaChannels(periph.dma_channels);

          let pEntry = embassyPeriphs.get(pName);
          if (!pEntry) {
            pEntry = { kind: pKind, signals: new Set<string>(), dma };
            embassyPeriphs.set(pName, pEntry);
          } else if (dma && !pEntry.dma) {
            pEntry.dma = dma;
          }

          for (const ps of periph.pins ?? []) {
            if (!ps.pin || !ps.signal) continue;
            const gpioKey = ps.pin.toUpperCase();
            const af = isF1 ? null : typeof ps.af === 'number' ? ps.af : null;
            const list = embassyPinSignals.get(gpioKey) ?? [];
            list.push({
              peripheral: pName,
              signal: ps.signal,
              af,
            });
            embassyPinSignals.set(gpioKey, list);
          }
        }
      }

      // Group XML <Pin> nodes by physical Position to handle dual-bonded pins cleanly
      const byPosition = new Map<
        string,
        {
          names: string[];
          types: string[];
          xmlSignals: string[];
        }
      >();

      for (const xPin of xmlPins) {
        const pos = String(xPin['@_Position'] ?? '').trim();
        const name = String(xPin['@_Name'] ?? '').trim();
        const type = String(xPin['@_Type'] ?? 'I/O').trim();
        if (!pos) continue;

        let bucket = byPosition.get(pos);
        if (!bucket) {
          bucket = { names: [], types: [], xmlSignals: [] };
          byPosition.set(pos, bucket);
        }
        if (name && !bucket.names.includes(name)) {
          bucket.names.push(name);
        }
        bucket.types.push(type);

        for (const sigNode of toArray(xPin.Signal)) {
          const sName = String(sigNode['@_Name'] ?? '').trim();
          if (sName && sName !== 'GPIO') {
            bucket.xmlSignals.push(sName);
          }
        }
      }

      const positions = Array.from(byPosition.keys());
      const packageInfo = buildPackageInfo(pkgName, positions);
      const pins: PinInfo[] = [];
      const chipPeripherals: Record<string, PeripheralInfo> = {};

      const addPeripheralSignal = (
        peripheral: string,
        signal: string,
        embassyMeta?: { kind: PeripheralInfo['kind']; dma?: PeripheralDma[] },
      ): void => {
        let entry = chipPeripherals[peripheral];
        if (!entry) {
          entry = {
            kind: embassyMeta?.kind ?? classifyPeripheralKind(peripheral),
            signals: [],
            ...(embassyMeta?.dma ? { dma: embassyMeta.dma } : {}),
          };
          chipPeripherals[peripheral] = entry;
        }
        if (!entry.signals.includes(signal)) {
          entry.signals.push(signal);
        }
      };

      // Sort positions naturally (1..N or A1..T20)
      positions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const pos of positions) {
        const bucket = byPosition.get(pos)!;
        // Build clean display name preserving dual-bonded labels (e.g. "PA11 [PA9]" or "PC14 / PB7")
        const displayName =
          bucket.names.length === 1
            ? bucket.names[0].replace(/\s*\([^)]+\)$/, '').trim()
            : bucket.names
                .map((n) => {
                  const gpios = extractGpioNames(n);
                  return gpios.length > 0 ? gpios[0] : n;
                })
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .join(' / ');

        // Determine pin type (if any bonded pin is I/O, treat physical pad as 'io')
        const normalizedTypes = bucket.types.map((t, i) =>
          normalizePinType(t, bucket.names[i] ?? displayName),
        );
        const pinType = normalizedTypes.includes('io')
          ? 'io'
          : normalizedTypes[0] ?? 'io';

        const dedupedSignals = new Map<string, PinSignal>();

        // 1. Merge signals from Embassy for every GPIO bonded to this physical pin
        const gpiosOnPin = Array.from(
          new Set(bucket.names.flatMap((n) => extractGpioNames(n))),
        );

        for (const gpio of gpiosOnPin) {
          for (const sig of embassyPinSignals.get(gpio) ?? []) {
            const key = `${sig.peripheral}:${sig.signal}`;
            if (!dedupedSignals.has(key)) {
              dedupedSignals.set(key, sig);
            }
          }
        }

        // 2. Merge SYS (SWD/JTAG) and RCC (OSC_IN/OSC_OUT) signals from ST XML when not already present
        for (const rawXmlSig of bucket.xmlSignals) {
          const parsedSig = parseXmlSignalName(rawXmlSig);
          if (!parsedSig) continue;

          if (parsedSig.peripheral === 'SYS' || parsedSig.peripheral === 'DEBUG') {
            const normalizedSigs = normalizeSysSignals(parsedSig.signal);
            for (const s of normalizedSigs) {
              const key = `SYS:${s}`;
              if (!dedupedSignals.has(key)) {
                dedupedSignals.set(key, {
                  peripheral: 'SYS',
                  signal: s,
                  af: isF1 ? null : 0,
                });
              }
            }
          } else if (parsedSig.peripheral === 'RCC') {
            const key = `RCC:${parsedSig.signal}`;
            if (!dedupedSignals.has(key)) {
              dedupedSignals.set(key, {
                peripheral: 'RCC',
                signal: parsedSig.signal,
                af: null,
              });
            }
          }
        }

        const pinSignals = Array.from(dedupedSignals.values()).sort((a, b) => {
          if (a.peripheral !== b.peripheral) {
            return a.peripheral.localeCompare(b.peripheral, undefined, { numeric: true });
          }
          return a.signal.localeCompare(b.signal, undefined, { numeric: true });
        });

        for (const ps of pinSignals) {
          const embMeta = embassyPeriphs.get(ps.peripheral);
          addPeripheralSignal(ps.peripheral, ps.signal, embMeta);
        }

        pins.push({
          pos,
          name: displayName,
          type: pinType,
          signals: pinSignals,
        });
      }

      // Sort signal arrays inside chipPeripherals
      for (const pInfo of Object.values(chipPeripherals)) {
        pInfo.signals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      }

      // Compute flash / RAM sizes
      const embMem = parseKbMemory(embassyChip);
      const flashKb =
        embMem.flashKb > 0
          ? embMem.flashKb
          : xmlFlashes[idx] ?? xmlFlashes[0] ?? 0;
      const ramKb =
        embMem.ramKb > 0
          ? embMem.ramKb
          : xmlRams[idx] ?? xmlRams[0] ?? 0;

      const coreName =
        normalizeCoreName(embassyChip.cores?.[0]?.name) || xmlCore;

      const chipData: ChipData = {
        id: partId,
        family,
        core: coreName,
        flashKb,
        ramKb,
        package: packageInfo,
        pins,
        peripherals: chipPeripherals,
      };

      chips.set(partId, chipData);

      familiesSet.add(family);
      index.set(partId, {
        id: partId,
        vendor: 'stm32',
        family,
        core: coreName,
        package: packageInfo.name,
        pinCount: packageInfo.pinCount,
        flashKb,
        ramKb,
        geometry: indexGeometryFromPackage(packageInfo),
      });
    }
  }

  return {
    vendor: 'stm32',
    chips,
    index: Array.from(index.values()).sort((a, b) => a.id.localeCompare(b.id)),
    families: Array.from(familiesSet).sort(),
    totalVariants,
    matchedVariants,
  };
}

function assertReferenceChip(
  ctx: GateContext,
  errors: string[],
  id: string,
  expectedPkg: string,
  expectedPins: number,
  expectedKind: 'perimeter' | 'grid',
  checks: (chip: ChipData) => void,
): void {
  const chip = ctx.chips.get(id);
  if (!chip) {
    errors.push(`STM32 gate failed: missing reference chip ${id}`);
    return;
  }
  if (chip.package.name !== expectedPkg) {
    errors.push(`STM32 gate failed: ${id} expected package ${expectedPkg}, got ${chip.package.name}`);
  }
  if (chip.pins.length !== expectedPins) {
    errors.push(`STM32 gate failed: ${id} expected ${expectedPins} pins, got ${chip.pins.length}`);
  }
  if (chip.package.kind !== expectedKind) {
    errors.push(`STM32 gate failed: ${id} expected kind ${expectedKind}, got ${chip.package.kind}`);
  }
  if (chip.vendor && chip.vendor !== 'stm32') {
    errors.push(`STM32 gate failed: ${id} expected vendor stm32, got ${chip.vendor}`);
  }
  if (chip.muxModel && chip.muxModel !== 'af') {
    errors.push(`STM32 gate failed: ${id} expected muxModel af, got ${chip.muxModel}`);
  }
  const powerPins = chip.pins.filter((p) => p.type === 'power');
  if (powerPins.length === 0) {
    errors.push(`STM32 gate failed: ${id} has zero power pins`);
  }
  checks(chip);
}

/** Six STM32 reference parts from Gate 1, checked field-by-field. */
export const stm32ReferenceGate: Gate = {
  name: 'stm32-reference-parts',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    assertReferenceChip(ctx, errors, 'STM32F411CEU6', 'UFQFPN48', 48, 'perimeter', (c) => {
      const pa5 = c.pins.find((p) => p.name === 'PA5');
      const spi1Sck = pa5?.signals.find((s) => s.peripheral === 'SPI1' && s.signal === 'SCK');
      if (!spi1Sck || spi1Sck.af !== 5) {
        errors.push('STM32 gate failed: STM32F411CEU6 PA5 missing SPI1_SCK AF5');
      }
    });
    assertReferenceChip(ctx, errors, 'STM32G431CBU6', 'UFQFPN48', 48, 'perimeter', (c) => {
      const pa5 = c.pins.find((p) => p.name === 'PA5');
      const spi1Sck = pa5?.signals.find((s) => s.peripheral === 'SPI1' && s.signal === 'SCK');
      if (!spi1Sck || spi1Sck.af !== 5) {
        errors.push('STM32 gate failed: STM32G431CBU6 PA5 missing SPI1_SCK AF5');
      }
      if (!c.peripherals.SYS?.signals.includes('SWDIO')) {
        errors.push('STM32 gate failed: STM32G431CBU6 missing SYS SWDIO');
      }
    });
    assertReferenceChip(ctx, errors, 'STM32F103C8T6', 'LQFP48', 48, 'perimeter', (c) => {
      const pa5 = c.pins.find((p) => p.name === 'PA5');
      const spi1Sck = pa5?.signals.find((s) => s.peripheral === 'SPI1' && s.signal === 'SCK');
      if (!spi1Sck || spi1Sck.af !== null) {
        errors.push('STM32 gate failed: STM32F103C8T6 PA5 should have SPI1_SCK with af: null (AFIO)');
      }
    });
    assertReferenceChip(ctx, errors, 'STM32H743VIT6', 'LQFP100', 100, 'perimeter', (c) => {
      if (!c.peripherals.SPI1 || !c.peripherals.TIM1) {
        errors.push('STM32 gate failed: STM32H743VIT6 missing SPI1 or TIM1');
      }
    });
    assertReferenceChip(ctx, errors, 'STM32U575RIT6', 'LQFP64', 64, 'perimeter', (c) => {
      if (!c.peripherals.SPI1 || !c.peripherals.GPDMA1 && !c.peripherals.SPI1.dma?.length) {
        errors.push('STM32 gate failed: STM32U575RIT6 missing SPI1 DMA metadata');
      }
    });
    assertReferenceChip(ctx, errors, 'STM32H743XIH6', 'TFBGA240', 265, 'grid', (c) => {
      if (!c.package.rows || c.package.rows.length === 0 || !c.package.cols || c.package.cols.length === 0) {
        errors.push('STM32 gate failed: STM32H743XIH6 missing BGA rows/cols');
      }
    });
    return { vendor: 'stm32', name: 'stm32-reference-parts', errors, notes: [] };
  },
};

/** STM32 build-blocking thresholds (MCU count, Embassy match rate, size). */
export const stm32ThresholdGate: Gate = {
  name: 'stm32-thresholds',
  evaluate(ctx: GateContext): GateResult {
    const errors: string[] = [];
    if (ctx.index.length < 1000) {
      errors.push(`STM32 gate failed: expected 1,000+ MCUs, got ${ctx.index.length}`);
    }
    if (ctx.matchRate < 95) {
      errors.push(`STM32 gate failed: MCU match rate ${ctx.matchRate.toFixed(2)}% is below 95% threshold`);
    }
    const totalMb = ctx.totalBytes / (1024 * 1024);
    if (totalMb >= 150) {
      errors.push(`STM32 gate failed: total output ${totalMb.toFixed(2)} MB exceeds 150 MB target`);
    }
    return { vendor: 'stm32', name: 'stm32-thresholds', errors, notes: [] };
  },
};

/** Registered STM32 vendor adapter. */
export const stm32Adapter: VendorAdapter = {
  vendor: 'stm32',
  sourceSpecs: stm32SourceSpecs(),
  primarySourceId: 'embassy-stm32-data',
  generate: generateStm32,
  gates: [stm32ReferenceGate, stm32ThresholdGate],
  strict: true,
};
