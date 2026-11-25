import { describe, expect, it } from 'vitest';
import { exportCHeader } from '../src/core/exporters/c-header';
import { exportCsv } from '../src/core/exporters/csv';
import { exportEmbassyRust } from '../src/core/exporters/embassy-rust';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { createWorkspaceHistory } from '../src/core/history';
import { createEmptyWorkspace } from '../src/core/solver';
import type { ChipData, WorkspaceState } from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const sampleChip: ChipData = {
  id: 'STM32G431CBU6',
  family: 'STM32G4',
  core: 'Cortex-M4',
  flashKb: 128,
  ramKb: 32,
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 4, sides: [1, 1, 1, 1] },
  pins: [
    { pos: '15', name: 'PA5', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'SCK', af: 5 }] },
    { pos: '16', name: 'PA6', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MISO', af: 5 }] },
    { pos: '17', name: 'PA7', type: 'io', signals: [{ peripheral: 'SPI1', signal: 'MOSI', af: 5 }] },
    { pos: '1', name: 'VBAT', type: 'power', signals: [] },
  ],
  peripherals: {
    SPI1: { kind: 'spi', signals: ['SCK', 'MISO', 'MOSI'] },
  },
};

const sampleState: WorkspaceState = {
  mcuId: 'STM32G431CBU6',
  assignments: {
    '15': { peripheral: 'SPI1', signal: 'SCK', af: 5 },
    '16': { peripheral: 'SPI1', signal: 'MISO', af: 5 },
    '17': { peripheral: 'SPI1', signal: 'MOSI', af: 5 },
  },
  labels: {
    '15': 'IMU_CLK',
    '16': 'IMU_MISO',
  },
  locked: {
    '15': true,
  },
  peripheralModes: {
    SPI1: 'full_duplex',
  },
};

describe('history stack', () => {
  it('supports push, undo, redo, and deduplication', () => {
    const s0 = createEmptyWorkspace('STM32G431CBU6');
    const history = createWorkspaceHistory(s0);

    expect(history.canUndo).toBe(false);
    expect(history.push(s0)).toBe(false); // identical state ignored

    expect(history.push(sampleState)).toBe(true);
    expect(history.canUndo).toBe(true);
    expect(history.current.assignments['15']?.signal).toBe('SCK');

    const undone = history.undo();
    expect(undone?.assignments['15']).toBeUndefined();
    expect(history.canRedo).toBe(true);

    const redone = history.redo();
    expect(redone?.assignments['15']?.signal).toBe('SCK');
    expect(history.canRedo).toBe(false);
  });
});

describe('fflate URL state codec', () => {
  it('round-trips workspace state with zero data loss', () => {
    const encoded = encodeWorkspaceState(sampleState);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.state).toEqual(sampleState);
    }
  });

  it('gracefully rejects malformed URL payloads', () => {
    const bad = decodeWorkspaceState('!!!not-valid-base64!!!');
    expect(bad.ok).toBe(false);
    const corrupted = decodeWorkspaceState('AAAAAAAA');
    expect(corrupted.ok).toBe(false);
  });
});

describe('exporters', () => {
  it('generates clean Embassy Rust bindings with snake_case labels', () => {
    const rs = exportEmbassyRust(sampleChip, sampleState);
    expect(rs).toContain('use embassy_stm32::peripherals;');
    expect(rs).toContain('pub imu_clk: peripherals::PA5');
    expect(rs).toContain('pub spi1_mosi: peripherals::PA7');
    expect(rs).toContain('[AF5]');
  });

  it('generates include-guarded C header macros', () => {
    const h = exportCHeader(sampleChip, sampleState);
    expect(h).toContain('#ifndef PINCRAFT_STM32G431CBU6_PINOUT_H');
    expect(h).toContain('#define IMU_CLK_GPIO_PORT GPIOA');
    expect(h).toContain('#define IMU_CLK_PIN 5U');
    expect(h).toContain('#define IMU_CLK_AF 5U');
    expect(h).toContain('#endif');
  });

  it('generates a vendor-neutral CSV table', () => {
    const csv = exportCsv(sampleChip, sampleState);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(
      'Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked,Level,Drive,Pull,Speed',
    );
    expect(lines[1]).toBe('stm32,15,PA5,io,SPI1,SCK,AF5,,IMU_CLK,true,,,,');
  });

  it('exports deterministic JSON and re-imports cleanly', () => {
    const jsonText = exportPinoutJson(sampleState);
    const parsed = parsePinoutJson(jsonText);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state).toEqual(sampleState);
    }
    expect(parsePinoutJson('{ bad json').ok).toBe(false);
  });

  it('keeps generated module metadata out of version-2 share and project files', () => {
    const moduleChip: ChipData = {
      ...sampleChip,
      id: 'ESP32-WROOM-E',
      vendor: 'esp32',
      module: {
        kind: 'module',
        name: 'ESP32-WROOM-E',
        baseFamily: 'esp32',
        symbol: 'ESP32-WROOM-E',
      },
    };
    const decoded = decodeWorkspaceState(encodeWorkspaceState(sampleState));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(sampleState);
    const project = exportPinoutJson(sampleState);
    expect(project).not.toContain('"module"');
    expect(parsePinoutJson(project).ok).toBe(true);
    for (const output of [
      exportCsv(moduleChip, sampleState),
      exportEmbassyRust(moduleChip, sampleState),
      exportCHeader(moduleChip, sampleState),
      project,
    ]) {
      expect(output).not.toContain('module');
    }
    expect(exportEmbassyRust(moduleChip, sampleState)).toContain('use esp_hal::peripherals;');
  });

  it('round-trips extended mux fields through URL, JSON and history', () => {
    const extended: WorkspaceState = {
      ...sampleState,
      mcuId: 'RP2350BTEST',
      assignments: {
        '15': {
          peripheral: 'PWM',
          signal: 'PWM0A',
          af: 4,
          funcLabel: 'F4',
          resourceId: 'PWM0A',
        },
        '16': {
          peripheral: 'USART1',
          signal: 'TX',
          af: null,
          funcLabel: 'RM1',
          remapId: 1,
        },
      },
      activeRemaps: { USART1: 1 },
      pioAssignments: { '15': { instance: 'PIO0', sm: 0, role: 'TX' } },
    };

    const decoded = decodeWorkspaceState(encodeWorkspaceState(extended));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.state.assignments['15']).toEqual(extended.assignments['15']);
      expect(decoded.state.assignments['16']).toEqual(extended.assignments['16']);
    }

    const imported = parsePinoutJson(exportPinoutJson(extended));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.state.assignments['15']).toEqual(extended.assignments['15']);
      expect(imported.state.assignments['16']).toEqual(extended.assignments['16']);
    }

    const history = createWorkspaceHistory(extended);
    history.push({ ...extended, labels: { ...extended.labels, '15': 'SPARE_CLK' } });
    history.undo();
    expect(history.current.assignments['15']).toEqual(extended.assignments['15']);
    expect(history.current.assignments['16']).toEqual(extended.assignments['16']);
  });
});
