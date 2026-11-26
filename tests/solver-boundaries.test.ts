import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as solver from '../src/core/solver';

const ROOT = process.cwd();
const read = (name: string): string =>
  fs.readFileSync(path.join(ROOT, 'src', 'core', name), 'utf8');

const MODULES = [
  'solver.ts',
  'solver-modes.ts',
  'solver-common.ts',
  'solver-remap.ts',
  'solver-allocation.ts',
  'solver-diagnostics.ts',
] as const;

describe('solver module boundaries', () => {
  it('places each phase in its own module', () => {
    expect(read('solver-modes.ts')).toContain('export const PERIPHERAL_MODE_TEMPLATES');
    expect(read('solver-common.ts')).toContain('export function computePinScarcityScore');
    expect(read('solver-remap.ts')).toContain('export function findOneHopFixForSignal');
    expect(read('solver-allocation.ts')).toContain('export function searchBacktracking<T>');
    expect(read('solver-diagnostics.ts')).toContain('export function evaluateWorkspace');
    expect(read('solver.ts')).not.toContain('function evaluateWorkspace');
  });

  it('keeps the dependency graph acyclic', () => {
    const imports = (name: string): string[] =>
      Array.from(read(name).matchAll(/from '\.\/(solver[^']+)'/g)).map((match) => match[1]);
    expect(imports('solver-modes.ts')).toEqual([]);
    expect(imports('solver-common.ts')).toEqual(['solver-modes']);
    expect(imports('solver-remap.ts')).toEqual(['solver-common']);
    expect(imports('solver-allocation.ts')).toEqual(
      expect.arrayContaining(['solver-modes', 'solver-common', 'solver-remap']),
    );
    expect(imports('solver-diagnostics.ts')).toEqual(
      expect.arrayContaining(['solver-modes', 'solver-common', 'solver-remap']),
    );
    for (const name of MODULES.slice(1)) {
      expect(imports(name), name).not.toContain('solver');
      expect(imports(name), name).not.toContain('solver-allocation');
    }
  });

  it('keeps every module free of Svelte and DOM imports', () => {
    for (const name of MODULES) {
      const source = read(name);
      expect(source, name).not.toMatch(/from 'svelte/);
      expect(source, name).not.toContain('document.');
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('re-exports the original public surface through the barrel', () => {
    const expected = [
      'PERIPHERAL_MODE_TEMPLATES',
      'createEmptyWorkspace',
      'getModesForPeripheral',
      'resolveCanonicalSignal',
      'pinSupportsSignal',
      'MATRIX_ALTERNATE_LIMIT',
      'computePinScarcityScore',
      'findAlternatePins',
      'remapPinAssignment',
      'applyRemapGroup',
      'remapGroupFix',
      'findOneHopFixForSignal',
      'applyOneHopFix',
      'searchBacktracking',
      'allocatePeripheralMode',
      'togglePeripheralSignal',
      'reallocatePeripheralPlacement',
      'validateMatrixPlan',
      'reallocateMatrixPlacement',
      'reallocatePlacementOrdered',
      'deriveExtiLineId',
      'evaluateWorkspace',
    ];
    for (const name of expected) {
      expect(solver, name).toHaveProperty(name);
    }
  });
});
