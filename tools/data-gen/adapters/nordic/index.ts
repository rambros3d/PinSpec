/**
 * Nordic vendor adapter. Physical pins come from KiCad symbols, peripheral
 * inventory from SVD and Zephyr device trees, and routing labels from Zephyr
 * pinctrl. No electrical fact is invented where the sources are silent.
 */
import type { AdapterResult, VendorAdapter } from '../../types';
import { createNordicGates } from './gates';
import { generateNordicParts } from './parts';
import { NORDIC_SOURCE_ID, nordicSourceSpecs } from './sources';

/** Generates every pilot with complete machine-readable evidence. */
export function generateNordic(
  ctx: Parameters<typeof generateNordicParts>[0],
): AdapterResult {
  const { chips, index } = generateNordicParts(ctx);
  return {
    vendor: 'nordic',
    chips,
    index,
    families: Array.from(new Set(index.map((entry) => entry.family))).sort(),
    totalVariants: 3,
    matchedVariants: chips.size,
  };
}

/** Registered Nordic adapter and its strict gate list. */
export const nordicAdapter: VendorAdapter = {
  vendor: 'nordic',
  sourceSpecs: nordicSourceSpecs(),
  primarySourceId: NORDIC_SOURCE_ID,
  strict: true,
  generate: generateNordic,
  gates: createNordicGates(),
};

export { createNordicGates } from './gates';
