import { describe, expect, it } from 'vitest';
import {
  buildPackageInfo,
  canonicalizePartId,
  classifyPeripheralKind,
  compareGridRows,
  expandRefNameVariants,
  extractEmbassyStem,
  extractGpioNames,
  normalizeSysSignals,
  parseXmlSignalName,
} from '../tools/data-gen/helpers';

describe('data-gen helpers', () => {
  it('expands parenthesized RefName variants cleanly', () => {
    expect(expandRefNameVariants('STM32G431C(6-8-B)Ux')).toEqual([
      'STM32G431C6Ux',
      'STM32G431C8Ux',
      'STM32G431CBUx',
    ]);
    expect(expandRefNameVariants('STM32F411C(C-E)Ux')).toEqual([
      'STM32F411CCUx',
      'STM32F411CEUx',
    ]);
    expect(expandRefNameVariants('STM32H743VITx')).toEqual(['STM32H743VITx']);
  });

  it('canonicalizes part IDs preserving SMPS and variant suffixes', () => {
    expect(canonicalizePartId('STM32G431CBUx')).toBe('STM32G431CBU6');
    expect(canonicalizePartId('STM32U575RITxQ')).toBe('STM32U575RIT6Q');
    expect(canonicalizePartId('STM32C071C8TxN')).toBe('STM32C071C8T6N');
  });

  it('extracts Embassy chip stem accurately', () => {
    expect(extractEmbassyStem('STM32G431CBUx')).toBe('STM32G431CB');
    expect(extractEmbassyStem('STM32U575RITxQ')).toBe('STM32U575RI');
    expect(extractEmbassyStem('STM32F103C8T6')).toBe('STM32F103C8');
  });

  it('extracts GPIO names from dual-bonded and suffixed labels', () => {
    expect(extractGpioNames('PA0')).toEqual(['PA0']);
    expect(extractGpioNames('PA11 [PA9]')).toEqual(['PA11', 'PA9']);
    expect(extractGpioNames('PC14-OSC32_IN (PC14)')).toEqual(['PC14']);
    expect(extractGpioNames('VDD')).toEqual([]);
  });

  it('builds perimeter package side counts for 4-sided and 2-sided packages', () => {
    const pos48 = Array.from({ length: 48 }, (_, i) => String(i + 1));
    const ufqfpn48 = buildPackageInfo('UFQFPN48', pos48);
    expect(ufqfpn48.kind).toBe('perimeter');
    expect(ufqfpn48.sides).toEqual([12, 12, 12, 12]);

    const pos20 = Array.from({ length: 20 }, (_, i) => String(i + 1));
    const tssop20 = buildPackageInfo('TSSOP20', pos20);
    expect(tssop20.kind).toBe('perimeter');
    expect(tssop20.sides).toEqual([10, 0, 10, 0]);
  });

  it('builds JEDEC-ordered BGA grid rows and columns', () => {
    const bgaPositions = ['A1', 'A2', 'B1', 'H1', 'J1', 'AA1', 'T12', 'A12'];
    const bga = buildPackageInfo('UFBGA169', bgaPositions);
    expect(bga.kind).toBe('grid');
    expect(bga.rows).toEqual(['A', 'B', 'H', 'J', 'T', 'AA']);
    expect(bga.cols).toEqual([1, 2, 12]);
    expect(compareGridRows('T', 'AA')).toBeLessThan(0);
  });

  it('classifies peripherals and normalizes SYS/OTG signals', () => {
    expect(classifyPeripheralKind('SPI1', 'spi')).toBe('spi');
    expect(classifyPeripheralKind('FDCAN1')).toBe('can');
    expect(classifyPeripheralKind('LPUART1')).toBe('usart');
    expect(classifyPeripheralKind('USB_OTG_FS')).toBe('usb');
    expect(parseXmlSignalName('USB_OTG_FS_DM')).toEqual({
      peripheral: 'USB_OTG_FS',
      signal: 'DM',
    });
    expect(normalizeSysSignals('JTMS-SWDIO')).toEqual(['SWDIO', 'JTMS']);
  });
});
