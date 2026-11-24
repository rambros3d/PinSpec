import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  orderPeripheralNames,
  partitionPeripherals,
  peripheralCategoryForKind,
  PERIPHERAL_CATEGORIES,
} from '../src/core/vendor-view';
import type { ChipData, PeripheralStatus } from '../src/core/types';

const ROOT = process.cwd();

function readChip(id: string): ChipData {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'data', 'chips', `${id}.json`), 'utf8'),
  ) as ChipData;
}

function freshStatus(chip: ChipData): Record<string, PeripheralStatus> {
  return Object.fromEntries(Object.keys(chip.peripherals).map((name) => [name, 'none']));
}

describe('pure peripheral partition', () => {
  it('imports without Svelte or any DOM API', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/core/vendor-view.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]svelte|from ['"][^'"]+\.svelte/);
    for (const api of [
      'window.localStorage',
      'window.location',
      'window.matchMedia',
      'document.',
      'navigator.',
      'localStorage.',
    ]) {
      expect(source, api).not.toContain(api);
    }
  });

  it('partitions a fresh STM32G431CBU6 workspace as entirely unconfigured', () => {
    const chip = readChip('STM32G431CBU6');
    const partition = partitionPeripherals(freshStatus(chip), {});
    expect(partition.configured).toEqual([]);
    expect(partition.unconfigured).toEqual(Object.keys(chip.peripherals).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ));
  });

  it('partitions a fresh STM32F103C8T6 workspace as entirely unconfigured', () => {
    const chip = readChip('STM32F103C8T6');
    const statuses = freshStatus(chip);
    statuses.SPI1 = 'none';
    const partition = partitionPeripherals(statuses, { SPI1: 'disabled', USART1: '' });
    expect(partition.configured).toEqual([]);
    expect(partition.unconfigured).toContain('SPI1');
    expect(partition.unconfigured).toContain('USART1');
  });

  it('separates status-driven and mode-driven work for CH32V203C8T6', () => {
    const chip = readChip('CH32V203C8T6');
    const partition = partitionPeripherals(
      { ...freshStatus(chip), SPI1: 'active', USART1: 'partial', I2C1: 'error' },
      { SPI1: 'full_duplex', USB: 'device_fs', TIM1: 'disabled' },
    );
    expect(partition.configured).toEqual(['I2C1', 'SPI1', 'USART1', 'USB']);
    expect(partition.unconfigured).not.toContain('I2C1');
    expect(partition.unconfigured).toContain('TIM1');
    expect(partition.configured.every((name) => name in chip.peripherals)).toBe(true);
  });

  it('separates configured work for RP2040 and RP2350B', () => {
    for (const [id, expected] of [
      ['RP2040', ['SPI0', 'UART0']],
      ['RP2350B', ['I2C0', 'PIO1']],
    ] as const) {
      const chip = readChip(id);
      const status = freshStatus(chip);
      status[expected[0]] = 'active';
      const partition = partitionPeripherals(status, { [expected[1]]: 'custom' });
      expect(partition.configured, id).toEqual([...expected].sort());
      expect(partition.unconfigured.length, id).toBe(
        Object.keys(chip.peripherals).length - expected.length,
      );
    }
  });

  it('orders configured names first without disturbing alphabetical order', () => {
    const partition = partitionPeripherals({ TIM2: 'active', SPI1: 'none' }, { USART1: 'async' });
    expect(orderPeripheralNames(['SPI1', 'TIM2', 'USART1'], partition)).toEqual([
      'TIM2',
      'USART1',
      'SPI1',
    ]);
  });

  it('exposes the shared category table used by the tree and detail header', () => {
    expect(PERIPHERAL_CATEGORIES.find((category) => category.id === 'programmable')?.kinds).toEqual([
      'pwm',
      'pio',
    ]);
    expect(PERIPHERAL_CATEGORIES.find((category) => category.id === 'other')?.label).toBe(
      'Other peripherals',
    );
    expect(peripheralCategoryForKind('pio').id).toBe('programmable');
    expect(peripheralCategoryForKind('sys').id).toBe('system');
  });
});
