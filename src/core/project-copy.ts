/**
 * Pure helpers for Save as copies of recent projects. The saved session is
 * never mutated; the copy is a plain version-2 workspace state that the
 * existing exporter and importer accept.
 */

import type { WorkspaceState } from './types';

/** Return a copy of the pin plan with a different display name. */
export function withProjectName(state: WorkspaceState, projectName: string): WorkspaceState {
  return { ...state, projectName };
}

/** Build a safe download stem from a display name, falling back to the part id. */
export function projectFileName(projectName: string, mcuId: string): string {
  const stem = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || mcuId.toLowerCase()}-pinout.json`;
}
