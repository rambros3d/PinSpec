import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyPlacementEligibility,
  eligiblePlacementNames,
  type PeripheralPlacementEligibility,
} from '../src/core/placement-eligibility';
import type { ChipData, PinAssignment, PinInfo } from '../src/core/types';

const ROOT = process.cwd();

function ioPin(pos: string, name: string, signals: PinInfo['signals']): PinInfo {
  return { pos, name, type: 'io', signals };
}

function fixtureChip(): ChipData {
  const pins: PinInfo[] = [
    { pos: '1', name: 'VDD', type: 'power', signals: [] },
    ioPin('2', 'PA0', [
      { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      { peripheral: 'USART1', signal: 'TX', af: 7 },
    ]),
    ioPin('3', 'PA1', [
      { peripheral: 'SPI1', signal: 'SCK', af: 5 },
      { peripheral: 'USART1', signal: 'TX', af: 7 },
    ]),
    ioPin('4', 'PB0', [{ peripheral: 'USART1', signal: 'TX', af: 7 }]),
    ioPin('5', 'PB1', [{ peripheral: 'USART1', signal: 'TX', af: 7 }]),
    ioPin('6', 'PC0', [{ peripheral: 'I2C1', signal: 'SCL', af: 4 }]),
  ];
  return {
    id: 'ELIGIBILITYTEST',
    family: 'TEST',
    core: 'Synthetic',
    flashKb: 64,
    ramKb: 16,
    package: { name: 'TSSOP6', kind: 'perimeter', pinCount: 6, sides: [2, 0, 2, 0] },
    pins,
    peripherals: {
      SPI1: { kind: 'spi', signals: ['SCK'] },
      USART1: { kind: 'usart', signals: ['TX'] },
      I2C1: { kind: 'i2c', signals: ['SCL'] },
    },
  };
}

const chip = fixtureChip();
const sck: PinAssignment = { peripheral: 'SPI1', signal: 'SCK', af: 5 };
const tx: PinAssignment = { peripheral: 'USART1', signal: 'TX', af: 7 };
const scl: PinAssignment = { peripheral: 'I2C1', signal: 'SCL', af: 4 };

function statuses(
  assignments: Record<string, PinAssignment>,
  locked: Record<string, boolean> = {},
  names: readonly string[] = ['SPI1', 'USART1', 'I2C1', 'GPIO'],
): Record<string, PeripheralPlacementEligibility> {
  return Object.fromEntries(
    classifyPlacementEligibility(chip, assignments, locked, names).map((row) => [row.name, row]),
  );
}

describe('placement eligibility classification', () => {
  it('classifies a free alternate as eligible', () => {
    const rows = statuses({ '2': sck });
    expect(rows.SPI1.status).toBe('eligible');
    expect(rows.SPI1.reason).toBe('');
    expect(eligiblePlacementNames(chip, { '2': sck }, {}, ['SPI1'])).toEqual(['SPI1']);
  });

  it('accepts an occupied alternate whose occupant has a free alternate', () => {
    const assignments = { '2': sck, '3': tx };
    const rows = statuses(assignments);
    expect(rows.SPI1.status).toBe('eligible');
    expect(rows.USART1.status).toBe('eligible');
  });

  it('does not follow a second occupied hop', () => {
    const chainChip = fixtureChip();
    chainChip.pins = [
      chainChip.pins[0],
      ioPin('2', 'PA0', [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }]),
      ioPin('3', 'PA1', [
        { peripheral: 'SPI1', signal: 'SCK', af: 5 },
        { peripheral: 'I2C1', signal: 'SCL', af: 4 },
      ]),
      ioPin('4', 'PB0', [{ peripheral: 'I2C1', signal: 'SCL', af: 4 }]),
    ];
    const assignments = { '2': sck, '3': scl, '4': { peripheral: 'GPIO', signal: 'Output', af: null } };
    const rows = Object.fromEntries(
      classifyPlacementEligibility(chainChip, assignments, {}, ['SPI1', 'I2C1', 'GPIO']).map(
        (row) => [row.name, row],
      ),
    );
    expect(rows.SPI1.status).toBe('ineligible');
    expect(rows.I2C1.status).toBe('ineligible');
  });

  it('separates locked-only peripherals from eligible ones', () => {
    const rows = statuses({ '2': sck }, { '2': true });
    expect(rows.SPI1.status).toBe('locked-only');
    expect(rows.SPI1.reason).toContain('locked');
    expect(eligiblePlacementNames(chip, { '2': sck }, { '2': true }, ['SPI1'])).toEqual([]);
  });

  it('classifies a peripheral with no alternate as ineligible', () => {
    const rows = statuses({ '6': scl });
    expect(rows.I2C1.status).toBe('ineligible');
    expect(rows.I2C1.reason).toContain('No assigned pin has a movable alternate');
  });

  it('excludes GPIO even when every other pin is free', () => {
    const rows = statuses({ '4': { peripheral: 'GPIO', signal: 'Output', af: null } });
    expect(rows.GPIO).toBeUndefined();
    expect(
      classifyPlacementEligibility(
        chip,
        { '4': { peripheral: 'GPIO', signal: 'Output', af: null } },
        {},
        ['GPIO'],
      ),
    ).toEqual([]);
  });

  it('leaves an unassigned configured peripheral ineligible', () => {
    expect(statuses({})['SPI1'].status).toBe('ineligible');
  });
});

describe('placement eligibility UI wiring', () => {
  it('describes disabled locked rows, hides ineligible rows, and shares the canvas filter', () => {
    const panel = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PlacementPanel.svelte'),
      'utf8',
    );
    expect(panel).toContain('classifyPlacementEligibility');
    expect(panel).toContain("row.status !== 'ineligible'");
    expect(panel).toContain("disabled={row.status === 'locked-only'}");
    expect(panel).toContain('title={row.status === \'locked-only\' ? row.reason : undefined}');
    expect(panel).toContain('Placement bubble unavailable for ${row.name}: ${row.reason}');
    expect(panel).toContain('No configured peripheral has a reassignable pin.');
    expect(panel).not.toContain('configuredNames');

    const canvas = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/PackageCanvas.svelte'),
      'utf8',
    );
    expect(canvas).toContain('eligiblePlacementNames');
    expect(canvas).toContain('configuredPeripheralNames');
    expect(canvas).toContain('locked,');

    const drawer = fs.readFileSync(
      path.join(ROOT, 'src/components/workspace/SummaryDrawer.svelte'),
      'utf8',
    );
    expect(drawer).toContain('<PlacementPanel');
    expect(drawer).toMatch(/<PlacementPanel[\s\S]*?\{locked\}/);
  });
});
