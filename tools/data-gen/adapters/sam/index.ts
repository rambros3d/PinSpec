/**
 * Microchip SAM vendor adapter. Every emitted device fact is read from the
 * curated ATDF files fetched by CI; missing evidence is deferred with an
 * attributed warning instead of being filled in by hand.
 */
import fs from 'node:fs';
import type { CatalogIndexEntry, ChipData } from '../../../../src/core/types';
import type { AdapterContext, AdapterResult, VendorAdapter } from '../../types';
import { ATDF_PATHS, parseAtdf } from './atdf';
import { createSamGates } from './gates';
import { buildMemoryEvidence } from './memory';
import { buildPackage, buildPins } from './pins';
import { SAM_SOURCE_ID, atdfCachePath, microchipAtdfSourceSpecs as samSourceSpecs } from './sources';
import { joinSignals } from './signals';
import {
  coreForArchitecture,
  familyForStem,
  pinoutMetadata,
  primaryPackage,
  primaryPinout,
  seriesForStem,
  variantMetadata,
} from './variants';

/** Index peripheral counts mirror the declarative kinds used by the solver. */
function indexEntry(chip: ChipData): CatalogIndexEntry {
  const counts = { spi: 0, i2c: 0, usart: 0, can: 0, usb: 0, tim: 0, adc: 0 };
  for (const info of Object.values(chip.peripherals)) {
    if (info.kind === 'spi') counts.spi++;
    else if (info.kind === 'i2c') counts.i2c++;
    else if (info.kind === 'usart') counts.usart++;
    else if (info.kind === 'can') counts.can++;
    else if (info.kind === 'usb') counts.usb++;
    else if (info.kind === 'tim' || info.kind === 'pwm') counts.tim++;
    else if (info.kind === 'adc') counts.adc++;
  }
  return {
    id: chip.id,
    vendor: 'microchip',
    family: chip.family,
    ...(chip.series ? { series: chip.series } : {}),
    core: chip.core,
    package: chip.package.name,
    pinCount: chip.package.pinCount,
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    peripherals: counts,
  };
}

/** Generates one shard per curated ATDF part stem. */
export function generateSam(ctx: AdapterContext): AdapterResult {
  const chips = new Map<string, ChipData>();
  const index: CatalogIndexEntry[] = [];
  const families = new Set<string>();

  for (const relativePath of ATDF_PATHS) {
    const rawPath = atdfCachePath(ctx.paths.cacheDir, relativePath);
    const stem = relativePath.slice(relativePath.lastIndexOf('/') + 1, -'.atdf'.length);
    const defer = (reason: string): void => {
      ctx.warnings.add({ id: stem, vendor: 'microchip', source: SAM_SOURCE_ID, reason });
    };
    if (!fs.existsSync(rawPath)) {
      defer(`ATDF file ${relativePath} is unavailable; part deferred.`);
      continue;
    }
    let doc;
    try {
      doc = parseAtdf(fs.readFileSync(rawPath, 'utf8'), stem);
    } catch {
      defer(`ATDF file ${relativePath} is unparseable; part deferred.`);
      continue;
    }
    if (doc.variants.length === 0) {
      defer('ATDF declares no ordercode variants; part deferred.');
      continue;
    }
    const pinout = primaryPinout(doc);
    if (!pinout) {
      defer('ATDF declares no pinout with physical pins; part deferred.');
      continue;
    }

    const pins = buildPins(pinout, defer);
    if (pins.length === 0) {
      defer('ATDF pinout has no positioned pins; part deferred.');
      continue;
    }
    const joined = joinSignals(pins, doc.instances);
    if (joined.unmatchedPads.length > 0) {
      defer(
        `${joined.unmatchedPads.length} ATDF signal pads are absent from pinout ${pinout.name}; ` +
          `signals omitted (${joined.unmatchedPads.slice(0, 5).join(', ')}...).`,
      );
    }
    const memory = buildMemoryEvidence(doc.memories, doc.interrupts, doc.params);
    for (const missing of memory.missingSizes) {
      defer(`Memory segment ${missing} has no parseable size; value omitted.`);
    }
    if (memory.flashKb === null || memory.ramKb === null) {
      defer('ATDF has no readable FLASH or SRAM size; part deferred.');
      continue;
    }
    defer('ATDF declares no DMA channel-to-signal map; DMA channels are not emitted.');

    const chip: ChipData = {
      id: stem,
      vendor: 'microchip',
      muxModel: 'af',
      family: 'SAM',
      series: seriesForStem(stem),
      core: coreForArchitecture(doc.architecture),
      flashKb: memory.flashKb,
      ramKb: memory.ramKb,
      package: buildPackage(pinout, primaryPackage(doc)),
      pins,
      peripherals: joined.peripherals,
      variants: variantMetadata(doc.variants),
      pinouts: pinoutMetadata(doc.pinouts, (name) =>
        doc.variants.find((variant) => variant.pinout === name)?.package,
      ),
      capabilityEvidence: memory.capabilityEvidence,
    };
    chips.set(chip.id, chip);
    index.push(indexEntry(chip));
    families.add(familyForStem(stem));
  }

  return {
    vendor: 'microchip',
    chips,
    index,
    families: Array.from(families).sort(),
    totalVariants: ATDF_PATHS.length,
    matchedVariants: chips.size,
  };
}

/** Registered SAM adapter and its strict gate list. */
export const samAdapter: VendorAdapter = {
  vendor: 'microchip',
  sourceSpecs: samSourceSpecs(),
  primarySourceId: SAM_SOURCE_ID,
  strict: true,
  generate: generateSam,
  gates: createSamGates(),
};

export { createSamGates } from './gates';
