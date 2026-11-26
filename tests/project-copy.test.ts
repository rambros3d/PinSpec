import { describe, expect, it } from 'vitest';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { normalizeProjectName } from '../src/core/project-name';
import { projectFileName, withProjectName } from '../src/core/project-copy';
import { createEmptyWorkspace } from '../src/core/solver';
import type { WorkspaceState } from '../src/core/types';

describe('Save as project copy', () => {
  it('exports a renamed copy without mutating the stored state', () => {
    const original: WorkspaceState = {
      ...createEmptyWorkspace('STM32G431CBU6'),
      projectName: 'Original plan',
      labels: { '1': 'BOOT0 test point' },
    };
    const copy = withProjectName(original, 'Labeled prototype');
    expect(copy.projectName).toBe('Labeled prototype');
    expect(original.projectName).toBe('Original plan');
    expect(copy.labels).toEqual(original.labels);
    expect(copy.assignments).toEqual(original.assignments);

    const parsed = parsePinoutJson(exportPinoutJson(copy));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.projectName).toBe(normalizeProjectName('Labeled prototype'));
      expect(parsed.state.labels).toEqual(original.labels);
    }
  });

  it('builds a safe download name with a part-id fallback', () => {
    expect(projectFileName('Prototype / Rev 2', 'STM32G431CBU6')).toBe(
      'prototype-rev-2-pinout.json',
    );
    expect(projectFileName('  !!  ', 'STM32G431CBU6')).toBe('stm32g431cbu6-pinout.json');
  });
});
