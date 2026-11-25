import { describe, expect, it, vi } from 'vitest';
import { decodeWorkspaceState } from '../src/core/url-state';
import type { ChipData, WorkspaceState } from '../src/core/types';
import { stubCatalogChips } from './helpers/catalog-stub';

/** Fresh store instances keep each test's history and recent sessions isolated. */
async function freshWorkspace() {
  vi.resetModules();
  const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
  const { catalogStore } = await import('../src/state/catalog.svelte.ts');
  return { workspaceStore, catalogStore };
}

const ch32: ChipData = {
  id: 'CH32V003TEST',
  vendor: 'ch32',
  muxModel: 'remap-group',
  family: 'CH32V003',
  core: 'QingKe V2A',
  flashKb: 16,
  ramKb: 2,
  package: { name: 'TSSOP20', kind: 'perimeter', pinCount: 4, sides: [2, 0, 2, 0] },
  pins: [
    {
      pos: '1',
      name: 'PD5',
      type: 'io',
      signals: [{ peripheral: 'USART1', signal: 'TX', af: null, remapId: 0 }],
    },
    {
      pos: '2',
      name: 'PD6',
      type: 'io',
      signals: [{ peripheral: 'USART1', signal: 'RX', af: null, remapId: 0 }],
    },
    {
      pos: '3',
      name: 'PD0',
      type: 'io',
      signals: [{ peripheral: 'USART1', signal: 'TX', af: null, funcLabel: 'RM1', remapId: 1 }],
    },
    {
      pos: '4',
      name: 'PD1',
      type: 'io',
      signals: [{ peripheral: 'USART1', signal: 'RX', af: null, funcLabel: 'RM1', remapId: 1 }],
    },
  ],
  peripherals: {
    USART1: {
      kind: 'usart',
      signals: ['TX', 'RX'],
      remaps: [
        { id: 0, name: 'Default (RM0)', signals: { TX: 'PD5', RX: 'PD6' } },
        { id: 1, name: 'Remap 1 (RM1)', signals: { TX: 'PD0', RX: 'PD1' } },
      ],
    },
  },
};

const rp: ChipData = {
  id: 'RP2040TEST',
  vendor: 'rp',
  muxModel: 'funcsel-pio',
  family: 'RP2040',
  core: 'Dual Cortex-M0+',
  flashKb: 0,
  ramKb: 264,
  package: { name: 'QFN-56', kind: 'perimeter', pinCount: 2, sides: [1, 0, 1, 0] },
  pio: { instances: ['PIO0'], stateMachinesPerInstance: 4, gpioBaseOptions: [0] },
  pins: [
    {
      pos: '2',
      name: 'GPIO0',
      type: 'io',
      signals: [
        { peripheral: 'SPI0', signal: 'SCK', af: 1, funcLabel: 'F1' },
        { peripheral: 'PIO0', signal: 'PIO', af: 6, funcLabel: 'F6' },
      ],
    },
  ],
  peripherals: {
    SPI0: { kind: 'spi', signals: ['SCK'] },
    PIO0: { kind: 'pio', signals: ['PIO'] },
  },
};

describe('workspace store multi-vendor state', () => {
  it('commits, persists, undoes and redoes an active remap selection', async () => {
    const { workspaceStore, catalogStore } = await freshWorkspace();
    stubCatalogChips(catalogStore, ch32);
    await workspaceStore.openMcu(ch32.id);

    workspaceStore.assignPin('1', { peripheral: 'USART1', signal: 'TX', af: null });
    workspaceStore.assignPin('2', { peripheral: 'USART1', signal: 'RX', af: null });
    expect(workspaceStore.state.activeRemaps).toBeUndefined();

    workspaceStore.setActiveRemap('USART1', 1);
    expect(workspaceStore.state.activeRemaps).toEqual({ USART1: 1 });
    expect(workspaceStore.state.assignments['3']?.signal).toBe('TX');
    expect(workspaceStore.state.assignments['4']?.signal).toBe('RX');
    expect(workspaceStore.state.assignments['1']).toBeUndefined();
    expect(workspaceStore.recentSessions[0].state.activeRemaps).toEqual({ USART1: 1 });

    workspaceStore.undo();
    expect(workspaceStore.state.activeRemaps).toBeUndefined();
    expect(workspaceStore.state.assignments['1']?.signal).toBe('TX');
    expect(workspaceStore.recentSessions[0].state.activeRemaps).toBeUndefined();

    workspaceStore.redo();
    expect(workspaceStore.state.activeRemaps).toEqual({ USART1: 1 });
    expect(workspaceStore.state.assignments['3']?.signal).toBe('TX');

    workspaceStore.clearActiveRemap('USART1');
    expect(workspaceStore.state.activeRemaps).toBeUndefined();
  });

  it('round-trips PIO bindings through a share link and recent sessions', async () => {
    const { workspaceStore, catalogStore } = await freshWorkspace();
    stubCatalogChips(catalogStore, rp);
    await workspaceStore.openMcu(rp.id);
    workspaceStore.assignPin('2', { peripheral: 'SPI0', signal: 'SCK', af: 1 });

    workspaceStore.setPioAssignment('2', { instance: 'PIO0', sm: 0, role: 'TX' });
    expect(workspaceStore.state.pioAssignments).toEqual({ '2': { instance: 'PIO0', sm: 0, role: 'TX' } });
    expect(workspaceStore.recentSessions[0].state.pioAssignments).toEqual(
      workspaceStore.state.pioAssignments,
    );

    const url = workspaceStore.buildShareUrl();
    const encoded = url.split('#/s/')[1];
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.state.pioAssignments).toEqual(workspaceStore.state.pioAssignments);
      workspaceStore.setPendingHandoff(decoded.state);
      await workspaceStore.openMcu(rp.id);
      expect(workspaceStore.state.pioAssignments).toEqual(decoded.state.pioAssignments);
    }

    workspaceStore.setPioAssignment('2', null);
    expect(workspaceStore.state.pioAssignments).toBeUndefined();
    workspaceStore.clearAll();
    expect(workspaceStore.state.assignments).toEqual({});
  });

  it('hydrates remaps and PIO bindings from a recent session', async () => {
    const { workspaceStore, catalogStore } = await freshWorkspace();
    stubCatalogChips(catalogStore, ch32);
    const restored: WorkspaceState = {
      mcuId: ch32.id,
      assignments: { '3': { peripheral: 'USART1', signal: 'TX', af: null, remapId: 1 } },
      labels: {},
      locked: {},
      peripheralModes: {},
      activeRemaps: { USART1: 1 },
      pioAssignments: { '3': { instance: 'PIO2', sm: 1, role: 'CLK' } },
    };
    workspaceStore.recentSessions = [
      {
        mcuId: ch32.id,
        packageName: ch32.package.name,
        pinCount: ch32.package.pinCount,
        assignedCount: 1,
        updatedAt: Date.now(),
        state: restored,
      },
    ];

    await workspaceStore.openMcu(ch32.id);
    expect(workspaceStore.state.activeRemaps).toEqual({ USART1: 1 });
    expect(workspaceStore.state.pioAssignments).toEqual(restored.pioAssignments);
    expect(workspaceStore.state.assignments['3']).toEqual(restored.assignments['3']);
  });
});
