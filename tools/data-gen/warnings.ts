/** Centralized, vendor-attributed warning collection for catalog generation. */
import type { VendorId } from '../../src/core/types';
import type { BuildWarning, WarningCollector } from './types';

/** Canonical upstream source id used when an adapter does not name one. */
export const DEFAULT_WARNING_SOURCE: Record<VendorId, string> = {
  stm32: 'stm32-data-generated',
  ch32: 'ch32-device-data',
  rp: 'kicad',
  esp32: 'esp-gpio-tool',
};

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

/**
 * Gives every deferred part a stable `id` and an upstream `source` before the
 * warning document is emitted, so `build-warnings.json` always satisfies the
 * `{ id, vendor, source, reason }` contract.
 */
export function normalizeWarnings(warnings: BuildWarning[]): BuildWarning[] {
  return warnings.map((warning, index) => ({
    ...warning,
    id: warning.id ?? warning.refName ?? warning.file ?? `${warning.vendor}-${index + 1}`,
    source: warning.source ?? DEFAULT_WARNING_SOURCE[warning.vendor],
  }));
}
