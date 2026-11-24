/** Centralized, vendor-attributed warning collection for catalog generation. */
import type { BuildWarning, WarningCollector } from './types';

/** Creates a fresh collector that preserves insertion order. */
export function createWarningCollector(): WarningCollector {
  const warnings: BuildWarning[] = [];
  return {
    add(warning: BuildWarning): void {
      warnings.push(warning);
    },
    all(): BuildWarning[] {
      return warnings.slice();
    },
    countFor(vendor: BuildWarning['vendor']): number {
      return warnings.reduce((n, w) => (w.vendor === vendor ? n + 1 : n), 0);
    },
  };
}
