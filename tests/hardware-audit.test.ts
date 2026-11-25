import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildHardwareAudit,
  formatHardwareAuditText,
  type HardwareAuditReport,
} from '../src/core/hardware-audit';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { cloneWorkspaceState, createWorkspaceHistory } from '../src/core/history';
import { createEmptyWorkspace, evaluateWorkspace } from '../src/core/solver';
import {
  DOCK_TABS,
  PINCRAFT_STATE_VERSION,
  normalizeDockTab,
  type ChipData,
  type WorkspaceState,
} from '../src/core/types';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';
import { stubCatalogChips } from './helpers/catalog-stub';

const ROOT = process.cwd();
const readSource = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const stm32Chip: ChipData = {
  id: 'STM32G431CBU6',
  vendor: 'stm32',
  muxModel: 'af',
  family: 'STM32G4',
  core: 'Cortex-M4',
  flashKb: 128,
  ramKb: 32,
  package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 9, sides: [3, 2, 2, 2] },
  pins: [
    { pos: '1', name: 'VDD', type: 'power', signals: [] },
    { pos: '2', name: 'PC13-BOOT0', type: 'io', signals: [] },
    { pos: '3', name: 'PG10-NRST', type: 'io', signals: [] },
    { pos: '4', name: 'PA13', type: 'io', signals: [{ peripheral: 'SYS', signal: 'SWDIO', af: 0 }] },
    { pos: '5', name: 'PF0', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_IN', af: null }] },
    { pos: '6', name: 'PF1', type: 'io', signals: [{ peripheral: 'RCC', signal: 'OSC_OUT', af: null }] },
    { pos: '7', name: 'PA11 [PA9]', type: 'io', signals: [] },
    { pos: '8', name: 'PB8', type: 'io', signals: [] },
    { pos: '9', name: 'BOOT0', type: 'boot', signals: [] },
  ],
  peripherals: {
    I2C1: { kind: 'i2c', signals: ['SCL', 'SDA'] },
    USB: { kind: 'usb', signals: ['DM', 'DP'] },
  },
};

const ch32Chip: ChipData = {
  id: 'CH32V003J4M6',
  vendor: 'ch32',
  muxModel: 'remap-group',
  family: 'CH32V003',
  core: 'QingKe V2A',
  flashKb: 16,
  ramKb: 2,
  package: { name: 'SOP8', kind: 'perimeter', pinCount: 6, sides: [2, 1, 2, 1] },
  pins: [
    {
      pos: '1',
      name: 'PD1 / PD6',
      type: 'io',
      bondedNames: ['PD1', 'PD6'],
      tags: ['debug-sdi', 'bonded', '5v-tolerant'],
      signals: [{ peripheral: 'SDI', signal: 'SWDIO', af: null }],
    },
    { pos: '2', name: 'NRST', type: 'reset', signals: [] },
    { pos: '3', name: 'BOOT0', type: 'boot', signals: [] },
    { pos: '4', name: 'PC1', type: 'io', tags: ['5v-tolerant'], signals: [] },
    { pos: '5', name: 'PC2', type: 'io', signals: [] },
    {
      pos: '6',
      name: 'PA1',
      type: 'io',
      signals: [{ peripheral: 'OSC', signal: 'IN', af: null }],
    },
  ],
  peripherals: { I2C1: { kind: 'i2c', signals: ['SCL', 'SDA'] } },
};

const rpChip: ChipData = {
  id: 'RP2040',
  vendor: 'rp',
  muxModel: 'funcsel-pio',
  family: 'RP2040',
  core: 'Cortex-M0+',
  flashKb: 0,
  ramKb: 264,
  package: { name: 'QFN-56', kind: 'perimeter', pinCount: 6, sides: [2, 1, 2, 1] },
  pins: [
    { pos: '1', name: 'IOVDD', type: 'power', signals: [] },
    { pos: '2', name: 'GPIO0', type: 'io', tags: ['usb'], signals: [{ peripheral: 'USB', signal: 'DM', af: 0 }] },
    { pos: '3', name: 'GPIO1', type: 'io', signals: [] },
    { pos: '24', name: 'SWCLK', type: 'io', tags: ['debug-swd'], signals: [] },
    { pos: '26', name: 'RUN', type: 'reset', tags: ['boot'], signals: [] },
    { pos: '56', name: '~{QSPI_SS}', type: 'io', tags: ['qspi'], signals: [] },
  ],
  peripherals: {
    I2C0: { kind: 'i2c', signals: ['SDA', 'SCL'] },
    USB: { kind: 'usb', signals: ['DM', 'DP'] },
  },
};

function stateFor(chip: ChipData, overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return { ...createEmptyWorkspace(chip.id), ...overrides };
}

function stm32State(): WorkspaceState {
  return stateFor(stm32Chip, {
    assignments: { '7': { peripheral: 'GPIO', signal: 'Input', af: null } },
    labels: { '2': 'BOOT_SEL', '4': 'UART_5V_TX' },
    gpioConfig: {
      '2': { outputLevel: 'Low', drive: 'PushPull', pull: 'Up', speed: 'Medium' },
    },
    peripheralModes: { I2C1: 'i2c', USB: 'device_fs' },
  });
}

describe('pure hardware audit module', () => {
  it('uses only pure TypeScript, with no Svelte or DOM access', () => {
    const source = readSource('src/core/hardware-audit.ts');
    expect(source).not.toMatch(/from ['"]svelte|from ['"]\.\/.*\.svelte/);
    expect(source).not.toMatch(/\bwindow\.|\bdocument\.|\bnavigator\./);
  });

  it('builds structured STM32 facts with evidence from types, names, and signals', () => {
    const report = buildHardwareAudit(stm32Chip, stm32State());
    expect(report.chipId).toBe('STM32G431CBU6');
    expect(report.vendor).toBe('stm32');

    const byPos = (pos: string) => report.strapping.filter((fact) => fact.pos === pos);
    expect(byPos('9')).toEqual([
      expect.objectContaining({
        role: 'boot',
        evidence: 'chip-shard-pin-type',
        pull: 'unknown',
        pullEvidence: 'data-unavailable',
      }),
    ]);
    expect(byPos('2')[0]).toMatchObject({
      role: 'boot',
      evidence: 'chip-shard-pin-name',
      detail: 'PC13-BOOT0',
      pull: 'Up',
      pullEvidence: 'workspace-gpio-config',
      label: 'BOOT_SEL',
      labelEvidence: 'workspace-label',
    });
    expect(byPos('3')[0]).toMatchObject({ role: 'reset', evidence: 'chip-shard-pin-name' });
    expect(byPos('4')[0]).toMatchObject({
      role: 'debug-swd',
      detail: 'SYS.SWDIO',
      evidence: 'chip-shard-signal',
    });
    expect(report.strapping.some((fact) => fact.pinName.includes('/'))).toBe(false);

    expect(report.interfaces.interfaces).toEqual([
      expect.objectContaining({ id: 'I2C1', status: 'present', detail: 'I2C1:i2c' }),
      expect.objectContaining({ id: 'USB', status: 'present', detail: 'USB:device_fs' }),
    ]);
    expect(report.interfaces.oscillators.map((fact) => fact.id)).toEqual(['OSC_IN', 'OSC_OUT']);
    expect(report.interfaces.oscillators.every((fact) => fact.evidence === 'chip-shard-signal')).toBe(true);
    expect(report.interfaces.powerDomains).toEqual([
      { id: 'VDD', status: 'present', detail: '1:VDD', evidence: 'chip-shard-pin-type' },
    ]);
    expect(report.interfaces.passiveFields.length).toBeGreaterThan(0);
    expect(report.interfaces.passiveFields.every((fact) =>
      fact.status === 'data-unavailable' && fact.evidence === 'data-unavailable',
    )).toBe(true);

    expect(report.unusedPins.unused.map((fact) => fact.pos)).toEqual(['2', '3', '4', '5', '6', '8']);
    expect(report.unusedPins.bonded).toEqual([]);
    expect(report.voltageTolerance.find((fact) => fact.pos === '4')).toMatchObject({
      tolerance: 'user-labeled-5v',
      evidence: 'workspace-label',
      detail: 'UART_5V_TX',
    });
    expect(report.voltageTolerance.find((fact) => fact.pos === '2')?.tolerance).toBe('unknown');
  });

  it('marks absent interfaces and oscillators when the workspace is empty', () => {
    const report = buildHardwareAudit(stm32Chip, stateFor(stm32Chip));
    expect(report.interfaces.interfaces.map((fact) => fact.status)).toEqual(['absent', 'absent']);
    expect(buildHardwareAudit(rpChip, stateFor(rpChip)).interfaces.oscillators[0]).toMatchObject({
      id: 'OSC',
      status: 'absent',
      evidence: 'data-unavailable',
    });
  });

  it('classifies CH32 roles, bonded pads, and tag-backed tolerance', () => {
    const report = buildHardwareAudit(ch32Chip, stateFor(ch32Chip));
    const roles = report.strapping.map((fact) => `${fact.pos}:${fact.role}:${fact.evidence}`);
    expect(roles).toContain('1:debug-sdi:chip-shard-tag');
    expect(roles).toContain('2:reset:chip-shard-pin-type');
    expect(roles).toContain('3:boot:chip-shard-pin-type');
    expect(report.strapping.some((fact) => fact.role === 'bootsel' as never)).toBe(false);
    expect(report.unusedPins.bonded).toEqual([
      {
        pos: '1',
        pinName: 'PD1 / PD6',
        bondedNames: ['PD1', 'PD6'],
        evidence: 'chip-shard-bonded-names',
      },
    ]);
    expect(report.voltageTolerance.find((fact) => fact.pos === '1')).toMatchObject({
      tolerance: '5v-tolerant',
      evidence: 'chip-shard-tag',
    });
    expect(report.voltageTolerance.find((fact) => fact.pos === '4')?.tolerance).toBe('5v-tolerant');
    expect(report.voltageTolerance.find((fact) => fact.pos === '5')?.tolerance).toBe('unknown');
    expect(report.interfaces.interfaces[0].status).toBe('absent');
  });

  it('classifies RP RUN and QSPI_SS without inventing BOOTSEL or 5V tolerance', () => {
    const state = stateFor(rpChip, { peripheralModes: { I2C0: 'i2c', USB: 'device_fs' } });
    const report = buildHardwareAudit(rpChip, state);
    const roles = report.strapping.map((fact) => `${fact.pos}:${fact.role}`);
    expect(roles).toEqual(['24:debug-swd', '26:reset-and-boot', '56:qspi']);
    expect(report.strapping.some((fact) => fact.role === 'bootsel' as never)).toBe(false);
    expect(report.voltageTolerance.every((fact) => fact.tolerance === 'unknown')).toBe(true);
    expect(report.voltageTolerance.find((fact) => fact.pos === '2')?.evidence).toBe('data-unavailable');
  });

  it('uses a user label only as a label-backed claim, not a device claim', () => {
    const state = stateFor(rpChip, { labels: { '3': '5V_UART_TX' } });
    const report = buildHardwareAudit(rpChip, state);
    expect(report.voltageTolerance.find((fact) => fact.pos === '3')).toMatchObject({
      tolerance: 'user-labeled-5v',
      evidence: 'workspace-label',
    });
    const text = formatHardwareAuditText(report);
    expect(text).not.toContain('device 5V tolerant');
    expect(text).not.toMatch(/\b\d+(?:\.\d+)?\s+(?:ohm|Ω|kΩ|µF|uF|nF|pF|V)\b/i);
  });

  it('renders stable text with identical facts on repeated calls', () => {
    const report = buildHardwareAudit(stm32Chip, stm32State());
    const text = formatHardwareAuditText(report);
    expect(text).toMatchSnapshot();
    expect(formatHardwareAuditText(buildHardwareAudit(stm32Chip, stm32State()))).toBe(text);
    expect(formatHardwareAuditText(report)).toBe(text);
    for (const heading of ['Strapping', 'Interfaces', 'Unused Pins', 'Bonded Pads', 'Voltage Tolerance']) {
      expect(text, heading).toContain(heading);
    }
    expect(text).not.toContain('BOOTSEL');
    expect(text).not.toMatch(/recommend|should|pull-up\s+\d/i);
  });
});

describe('solver diagnostics stay unchanged', () => {
  const conflictState = (chip: ChipData): WorkspaceState =>
    stateFor(chip, {
      assignments: {
        '4': { peripheral: 'SYS', signal: 'SWDIO', af: 0 },
        '7': { peripheral: 'SYS', signal: 'SWDIO', af: 0 },
        '8': { peripheral: 'GPIO', signal: 'Input', af: null },
      },
      peripheralModes: { I2C1: 'i2c', USB: 'device_fs' },
      labels: { '4': 'DBG' },
    });

  it('produces identical ids, codes, severities, and counts in either order', () => {
    for (const chip of [stm32Chip, ch32Chip, rpChip]) {
      const state = conflictState(chip);
      const before = evaluateWorkspace(chip, state);
      const audit: HardwareAuditReport = buildHardwareAudit(chip, state);
      const after = evaluateWorkspace(chip, state);
      expect(audit.chipId).toBe(chip.id);

      const shape = (items: typeof before.diagnostics) =>
        items.map((item) => ({ id: item.id, code: item.code, severity: item.severity }));
      expect(shape(after.diagnostics)).toEqual(shape(before.diagnostics));
      expect(after.errorCount).toBe(before.errorCount);
      expect(after.warningCount).toBe(before.warningCount);
      expect(after.infoCount).toBe(before.infoCount);

      // Evaluate after the audit first, then again to prove order independence.
      const first = evaluateWorkspace(chip, state);
      buildHardwareAudit(chip, state);
      const second = evaluateWorkspace(chip, state);
      expect(shape(second.diagnostics)).toEqual(shape(first.diagnostics));
    }
  });

  it('leaves every workspace field and history stack untouched', () => {
    const state = conflictState(stm32Chip);
    const snapshot = JSON.stringify(state);
    buildHardwareAudit(stm32Chip, state);
    formatHardwareAuditText(buildHardwareAudit(stm32Chip, state));
    expect(JSON.stringify(state)).toBe(snapshot);

    const history = createWorkspaceHistory(state);
    const undoBefore = history.canUndo;
    const redoBefore = history.canRedo;
    buildHardwareAudit(stm32Chip, history.current);
    expect(history.canUndo).toBe(undoBefore);
    expect(history.canRedo).toBe(redoBefore);
    expect(history.current).toEqual(state);
  });
});

describe('workspace UI and dock integration', () => {
  it('renders four read-only sections with no workspace mutation callback', () => {
    const panel = readSource('src/components/workspace/HardwareAuditPanel.svelte');
    for (const heading of ['Strapping', 'Interfaces', 'Unused pins', 'Voltage tolerance']) {
      expect(panel, heading).toContain(heading);
    }
    expect(panel).toContain('buildHardwareAudit');
    expect(panel).not.toMatch(/onCommit|workspaceStore\.set|onSetLabel|onApplyFix/);
    expect(readSource('src/components/workspace/SummaryDrawer.svelte')).toContain(
      "activeTab = 'audit'",
    );
    const modal = readSource('src/components/workspace/ExportModal.svelte');
    expect(modal).toContain("case 'audit'");
    expect(modal).toContain('formatHardwareAuditText');
    expect(modal).toContain('_hardware_audit.txt');
  });

  it('adds the audit value to the dock set without persisting it as pin configuration', () => {
    expect(DOCK_TABS).toContain('audit');
    expect(DOCK_TABS).not.toContain('configuration');
    expect(normalizeDockTab('audit')).toBe('audit');
    expect(normalizeDockTab('bootsel')).toBe('peripherals');

    const state = stateFor(stm32Chip, {
      assignments: { '7': { peripheral: 'GPIO', signal: 'Input', af: null } },
    });
    expect(cloneWorkspaceState(state)).toEqual(state);
    expect(decodeWorkspaceState(encodeWorkspaceState(state)).ok).toBe(true);
    const decoded = decodeWorkspaceState(encodeWorkspaceState(state));
    if (decoded.ok) expect(decoded.state).toEqual(state);
    const parsed = parsePinoutJson(exportPinoutJson(state));
    if (parsed.ok) expect(parsed.state).toEqual(state);

    expect(PINCRAFT_STATE_VERSION).toBe(2);
    expect(Object.keys(JSON.parse(exportPinoutJson(state)) as Record<string, unknown>).sort()).toEqual([
      'assignments', 'format', 'labels', 'locked', 'mcuId', 'peripheralModes', 'version',
    ]);
    expect(readSource('src/core/types.ts')).not.toMatch(/audit[A-Z]\w*\??:/);

    const history = createWorkspaceHistory(createEmptyWorkspace(stm32Chip.id));
    expect(history.push(state)).toBe(true);
    expect(history.current).toEqual(state);
    expect(Object.keys(history.current)).not.toContain('dockTab');
    expect(history.undo()).toEqual(createEmptyWorkspace(stm32Chip.id));

    const page = readSource('src/pages/WorkspacePage.svelte');
    expect(page).toContain("audit: 'Audit'");
    expect(readSource('src/app.css')).toContain("[data-dock-tab='audit']");
  });

  it('keeps an audit dock selection in localStorage only', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();
    try {
      const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
      const { catalogStore } = await import('../src/state/catalog.svelte.ts');
      stubCatalogChips(catalogStore, stm32Chip);
      await workspaceStore.openMcu(stm32Chip.id);
      workspaceStore.setDockTab('audit');
      expect(workspaceStore.dockTab).toBe('audit');

      const preferences = JSON.parse(
        storage.get('pincraft:workspace_view_preferences_v1') ?? '{}',
      ) as Record<string, unknown>;
      expect(preferences.dockTab).toBe('audit');
      const sessions = JSON.parse(storage.get('pincraft:recent_sessions_v1') ?? '[]') as Array<{
        state: WorkspaceState;
      }>;
      expect(Object.keys(sessions[0].state)).not.toContain('dockTab');
      expect(exportPinoutJson(workspaceStore.state)).not.toContain('dockTab');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
