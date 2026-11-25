import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CATALOG_SOURCE_IDS, getChipMuxModel, type ChipData } from '../src/core/types';
import { parseAtdf } from '../tools/data-gen/adapters/sam/atdf';
import { createSamGates, generateSam, samAdapter } from '../tools/data-gen/adapters/sam';
import { buildMemoryEvidence, parseSize } from '../tools/data-gen/adapters/sam/memory';
import { buildPackage, buildPins, gridGeometry, pinTypeForPad } from '../tools/data-gen/adapters/sam/pins';
import {
  DEV_PACKS_REF,
  LICENSE_MICROCHIP_ATDF,
  SAM_ATDF_PATHS,
  SAM_SOURCE_ID,
} from '../tools/data-gen/adapters/sam/sources';
import { afIndexForFunction, joinSignals, signalIdentity } from '../tools/data-gen/adapters/sam/signals';
import { SAM_FAMILY_SCOPE, SAM_PART_COUNT, SAM_PART_STEMS } from '../tools/data-gen/adapters/sam/variants';
import { canonicalSourceId } from '../tools/data-gen/artifacts';
import { findInvalidValues } from '../tools/data-gen/gates';
import { indexGeometryFromPackage } from '../tools/data-gen/helpers';
import { DEFAULT_ADAPTERS, generateCatalog } from '../tools/data-gen/index';
import { microchipAtdfSourceSpecs } from '../tools/data-gen/sources';
import type { AdapterContext, GateContext } from '../tools/data-gen/types';
import { createWarningCollector } from '../tools/data-gen/warnings';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.cache');
const D21_ATDF = path.join(
  CACHE,
  'microchip-atdf',
  'Microchip/SAMD21_DFP/3.6.144/samd21a/atdf/ATSAMD21G18A.atdf',
);

/** Small ATDF document exercising every reader path with synthetic values. */
const SYNTHETIC_ATDF = `<?xml version="1.0" encoding="UTF-8"?>
<!-- SPDX-License-Identifier: Apache-2.0 -->
<avr-tools-device-file>
  <devices><device name="TEST" architecture="CORTEX-M0PLUS" series="SAMD21">
    <address-spaces><address-space id="base">
      <memory-segment name="FLASH" size="0x40000" type="flash"/>
      <memory-segment name="HSRAM" size="0x8000" type="ram"/>
      <memory-segment name="BAD" size="not-a-size" type="ram"/>
    </address-space></address-spaces>
    <parameters><param name="NUM_IRQ" value="28"/></parameters>
    <interrupts><interrupt name="Reset"/><interrupt name="UART0"/></interrupts>
    <peripherals><module name="PORT"><instance name="PORTA">
      <signals>
        <signal group="PAD" index="0" function="A" pad="PA00"/>
        <signal group="AIN" index="1" function="default" pad="PA01"/>
        <signal group="EXTINT" function="XIN32" pad="PA02"/>
        <signal group="AIN" index="2" function="B" pad="MISSING"/>
      </signals>
      <parameters><param name="DMAC_ID_RX" value="1"/></parameters>
    </instance></module></peripherals>
  </device></devices>
  <modules><module name="REGONLY"><register-group name="R"/></module></modules>
  <pinouts><pinout name="TEST48">
    <pin position="1" pad="PA00"/>
    <pin position="2" pad="PA01"/>
    <pin position="3" pad="PA02"/>
    <pin position="4" pad="VDDIO"/>
    <pin position="5" pad="GNDIO"/>
    <pin position="6" pad="RESET_N"/>
    <pin pad="NO_POS"/>
  </pinout></pinouts>
  <variants>
    <variant ordercode="TEST-AU" package="TQFP48" pinout="TEST48" tempmin="-40" tempmax="85" vccmin="1.62" vccmax="3.63"/>
  </variants>
</avr-tools-device-file>`;

function gateContext(chips: ChipData[], sources = microchipAtdfSourceSpecs(CACHE)): GateContext {
  return {
    paths: { root: ROOT, cacheDir: CACHE, outDir: '', chipsOutDir: '' },
    chips: new Map(chips.map((chip) => [chip.id, chip])),
    index: chips.map((chip) => ({
      id: chip.id,
      vendor: chip.vendor ?? 'microchip',
      family: chip.family,
      core: chip.core,
      package: chip.package.name,
      pinCount: chip.package.pinCount,
      flashKb: chip.flashKb,
      ramKb: chip.ramKb,
      geometry: indexGeometryFromPackage(chip.package),
    })),
    totalVariants: chips.length,
    matchedVariants: chips.length,
    matchRate: 100,
    totalBytes: 1024,
    warnings: [],
    sources: sources.map((spec) => ({ ...spec, commit: 'abc1234' })),
    serializedShards: new Map(chips.map((chip) => [chip.id, JSON.stringify(chip)])),
  };
}

describe('SAM source declarations and adapter registration', () => {
  it('declares one pinned raw-file source with 39 ATDF paths', () => {
    const specs = microchipAtdfSourceSpecs(CACHE);
    expect(specs).toHaveLength(1);
    expect(specs[0].id).toBe(SAM_SOURCE_ID);
    expect(specs[0].license).toBe(LICENSE_MICROCHIP_ATDF);
    expect(specs[0].rawFiles).toHaveLength(SAM_PART_COUNT);
    expect(specs[0].rawFiles?.every((file) => file.url.includes(DEV_PACKS_REF))).toBe(true);
    expect(specs[0].rawFiles?.map((file) => file.path)).toEqual([...SAM_ATDF_PATHS]);
  });

  it('adds one canonical id and registers the strict SAM adapter before Nordic', () => {
    expect(CATALOG_SOURCE_IDS).toHaveLength(13);
    expect(CATALOG_SOURCE_IDS).toContain('microchip-atdf');
    expect(canonicalSourceId('microchip-atdf')).toBe('microchip-atdf');
    expect(DEFAULT_ADAPTERS.map((adapter) => adapter.vendor)).toEqual([
      'stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic',
    ]);
    expect(DEFAULT_ADAPTERS[4]).toBe(samAdapter);
    expect(DEFAULT_ADAPTERS[5].vendor).toBe('nordic');
    expect(samAdapter.strict).toBe(true);
    expect(createSamGates().map((gate) => gate.name)).toEqual([
      'sam-reference-parts', 'sam-shard-values', 'sam-provenance',
    ]);
  });

  it('declares the curated family scope and stable part stems', () => {
    expect(SAM_FAMILY_SCOPE.map((scope) => scope.count)).toEqual([14, 9, 7, 9]);
    expect(SAM_PART_STEMS).toHaveLength(39);
    expect(SAM_PART_STEMS).toContain('ATSAMD21G18A');
    expect(SAM_PART_STEMS).toContain('ATSAMD51P20A');
    expect(SAM_PART_STEMS).toContain('ATSAME51J20A');
    expect(SAM_PART_STEMS).toContain('ATSAMV71Q21B');
  });
});

describe('narrow ATDF reader', () => {
  it('reads variants, pinouts, instance signals, memories and evidence', () => {
    const doc = parseAtdf(SYNTHETIC_ATDF, 'TEST');
    expect(doc.stem).toBe('TEST');
    expect(doc.series).toBe('SAMD21');
    expect(doc.architecture).toBe('CORTEX-M0PLUS');
    expect(doc.variants).toHaveLength(1);
    expect(doc.variants[0]).toMatchObject({
      ordercode: 'TEST-AU', package: 'TQFP48', pinout: 'TEST48', tempmin: '-40',
    });
    expect(doc.pinouts).toHaveLength(1);
    expect(doc.pinouts[0].pins).toHaveLength(7);
    expect(doc.instances).toHaveLength(1);
    expect(doc.instances[0].signals).toHaveLength(4);
    expect(doc.memories).toHaveLength(3);
    expect(doc.interrupts).toEqual(['Reset', 'UART0']);
    expect(doc.params).toContain('NUM_IRQ');
    expect(doc.params).toContain('DMAC_ID_RX');
    expect(doc.shape).toEqual({ spdx: true, pinCount: 7, signalCount: 4 });
  });

  it('matches the verified ATSAMD21G18A raw shape', () => {
    if (!fs.existsSync(D21_ATDF)) return;
    const doc = parseAtdf(fs.readFileSync(D21_ATDF, 'utf8'), 'ATSAMD21G18A');
    expect(doc.shape.spdx).toBe(true);
    expect(doc.shape.pinCount).toBe(48);
    expect(doc.shape.signalCount).toBe(259);
    expect(doc.variants.map((variant) => variant.package).sort()).toEqual([
      'QFN48', 'QFN48', 'QFN48', 'TQFP48', 'TQFP48', 'TQFP48',
    ]);
    const functions = new Set(doc.instances.flatMap((i) => i.signals.map((s) => s.function)));
    expect(functions.has('A')).toBe(true);
    expect(functions.has('H')).toBe(true);
    expect(functions.has('default')).toBe(true);
    expect(functions.has('XIN32')).toBe(true);
  });
});

describe('geometry, AF mapping and evidence', () => {
  it('classifies power, ground and reset pads from ATDF names', () => {
    expect(pinTypeForPad('VDDIO')).toBe('power');
    expect(pinTypeForPad('GNDIO')).toBe('power');
    expect(pinTypeForPad('RESET_N')).toBe('reset');
    expect(pinTypeForPad('PA00')).toBe('io');
  });

  it('defers unpositioned pins and builds perimeter or grid geometry', () => {
    const doc = parseAtdf(SYNTHETIC_ATDF, 'TEST');
    const deferred: string[] = [];
    const pins = buildPins(doc.pinouts[0], (reason) => deferred.push(reason));
    expect(pins).toHaveLength(6);
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toContain('NO_POS');
    expect(pins.find((pin) => pin.name === 'VDDIO')?.type).toBe('power');
    expect(pins.find((pin) => pin.name === 'RESET_N')?.type).toBe('reset');
    expect(buildPackage(doc.pinouts[0], 'TQFP48')).toMatchObject({
      kind: 'perimeter', pinCount: 7, sides: [4, 0, 3, 0],
    });
    expect(gridGeometry(['A1', 'A2', 'B1', 'B2'])).toEqual({
      rows: ['A', 'B'], cols: [1, 2],
    });
  });

  it('maps function letters to AF indices and preserves non-letter labels', () => {
    expect(afIndexForFunction('A')).toBe(0);
    expect(afIndexForFunction('H')).toBe(7);
    expect(afIndexForFunction('default')).toBeNull();
    expect(afIndexForFunction('XIN32')).toBeNull();
    expect(signalIdentity({ group: 'AIN', index: '0', function: 'B', pad: 'PA00' })).toBe('AIN0');
    expect(signalIdentity({ group: 'VREFP', function: 'B', pad: 'PA03' })).toBe('VREFP');

    const doc = parseAtdf(SYNTHETIC_ATDF, 'TEST');
    const pins = buildPins(doc.pinouts[0], () => {});
    const joined = joinSignals(pins, doc.instances);
    expect(pins.find((pin) => pin.name === 'PA00')?.signals[0]).toMatchObject({
      peripheral: 'PORTA', signal: 'PAD0', af: 0,
    });
    expect(pins.find((pin) => pin.name === 'PA01')?.signals[0]).toMatchObject({
      af: null, funcLabel: 'default',
    });
    expect(pins.find((pin) => pin.name === 'PA02')?.signals[0]).toMatchObject({
      af: null, funcLabel: 'XIN32',
    });
    expect(joined.unmatchedPads).toEqual(['MISSING']);
    expect(joined.joinedSignals).toBe(3);
    expect(joined.peripherals.PORTA.signals).toEqual(['AIN1', 'EXTINT', 'PAD0']);
  });

  it('derives memory sizes and defers unreadable sizes', () => {
    const doc = parseAtdf(SYNTHETIC_ATDF, 'TEST');
    const evidence = buildMemoryEvidence(doc.memories, doc.interrupts, doc.params);
    expect(parseSize('0x40000')).toBe(262144);
    expect(evidence.flashKb).toBe(256);
    expect(evidence.ramKb).toBe(32);
    expect(evidence.missingSizes).toEqual(['BAD']);
    expect(evidence.capabilityEvidence.interrupts).toEqual(['Reset', 'UART0']);
    expect(evidence.capabilityEvidence.params).toContain('DMAC_ID_RX');
  });
});

describe('strict SAM gates', () => {
  function referenceChips(): ChipData[] {
    const base = (id: string, pinCount: number): ChipData => ({
      id,
      vendor: 'microchip',
      muxModel: 'af',
      family: 'SAM',
      core: 'Cortex-M4',
      flashKb: 256,
      ramKb: 32,
      package: { name: 'TQFP', kind: 'perimeter', pinCount, sides: [1, 1, 1, 1] },
      pins: [
        {
          pos: '1', name: 'PA00', type: 'io',
          signals: [{ peripheral: 'PORT', signal: 'PAD0', af: 0 }],
        },
        ...Array.from({ length: pinCount - 1 }, (_, i) => ({
          pos: String(i + 2), name: `P${i}`, type: 'io' as const, signals: [],
        })),
      ],
      peripherals: {},
    });
    return [
      { ...base('ATSAMD21G18A', 48), package: { ...base('x', 48).package, pinCount: 48 } },
      base('ATSAMD51P20A', 120),
      base('ATSAME51J20A', 64),
      base('ATSAMV71Q21B', 144),
      ...Array.from({ length: 35 }, (_, i) => base(`SAMPART${i}`, 8)),
    ].slice(0, 39);
  }

  it('accepts a complete 39-part catalog with D51 dual pinouts', () => {
    const chips = referenceChips();
    chips[1] = {
      ...chips[1],
      pinouts: [
        { name: 'SAMD51P', package: 'TQFP128', pinCount: 128 },
        { name: 'SAMD51PC', package: 'TFBGA120', pinCount: 120 },
      ],
    };
    const ctx = gateContext(chips);
    expect(createSamGates().map((gate) => gate.evaluate(ctx).errors)).toEqual([[], [], []]);
  });

  it('fails on a missing part, missing AF, or absent provenance', () => {
    const chips = referenceChips().slice(1);
    chips[0] = {
      ...chips[0],
      pinouts: [
        { name: 'SAMD51P', package: 'TQFP128', pinCount: 128 },
        { name: 'SAMD51PC', package: 'TFBGA120', pinCount: 120 },
      ],
    };
    const [reference] = createSamGates();
    expect(reference.evaluate(gateContext(chips)).errors.some((e) => e.includes('39'))).toBe(true);
    const noAf = referenceChips().map((chip) => ({
      ...chip,
      pins: chip.pins.map((pin) => ({ ...pin, signals: [] })),
    }));
    noAf[1].pinouts = [
      { name: 'SAMD51P', package: 'TQFP128', pinCount: 128 },
      { name: 'SAMD51PC', package: 'TFBGA120', pinCount: 120 },
    ];
    expect(reference.evaluate(gateContext(noAf)).errors.some((e) => e.includes('function-letter'))).toBe(true);
    const prov = createSamGates()[2];
    expect(
      prov.evaluate(gateContext(referenceChips(), [])).errors.some((e) => e.includes('provenance')),
    ).toBe(true);
  });
});

describe('generated SAM catalog', () => {
  it('writes no partial catalog when a forced SAM gate error occurs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincraft-sam-gate-'));
    const failing = {
      ...samAdapter,
      sourceSpecs: [],
      gates: [
        {
          name: 'injected-sam-failure',
          evaluate: () => ({
            vendor: 'microchip' as const,
            name: 'injected-sam-failure',
            errors: ['microchip gate: injected assertion failure'],
            notes: [],
          }),
        },
      ],
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(() => generateCatalog(root, [failing])).toThrow('injected assertion failure');
      expect(fs.existsSync(path.join(root, 'public', 'data', 'meta.json'))).toBe(false);
      expect(fs.existsSync(path.join(root, 'public', 'data', 'chips'))).toBe(true);
      expect(fs.readdirSync(path.join(root, 'public', 'data', 'chips'))).toEqual([]);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits 39 shards from the cached ATDF files with complete metadata', () => {
    const context: AdapterContext = {
      paths: { root: ROOT, cacheDir: CACHE, outDir: '', chipsOutDir: '' },
      sources: microchipAtdfSourceSpecs(CACHE).map((spec) => ({ ...spec, commit: 'abc1234' })),
      warnings: createWarningCollector(),
    };
    const result = generateSam(context);
    expect(result.index).toHaveLength(39);
    expect(result.index.every((entry) => entry.vendor === 'microchip')).toBe(true);
    const d21 = result.chips.get('ATSAMD21G18A')!;
    expect(d21.pins).toHaveLength(48);
    expect(getChipMuxModel(d21)).toBe('af');
    expect(d21.flashKb).toBe(256);
    expect(d21.ramKb).toBe(32);
    expect(d21.variants?.length).toBeGreaterThan(0);
    expect(d21.capabilityEvidence?.interrupts.length).toBeGreaterThan(0);
    for (const chip of result.chips.values()) {
      expect(findInvalidValues(chip)).toEqual([]);
    }
    expect(context.warnings.all().every((warning) => warning.vendor === 'microchip')).toBe(true);
  });
});
