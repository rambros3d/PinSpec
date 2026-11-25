/**
 * Nordic source declarations. The shared `sources.ts` module owns the actual
 * spec objects so CI pre-fetch and generation resolve one declaration.
 */
import path from 'node:path';
import {
  KICAD_NORDIC_FILES,
  LICENSE_KICAD,
  LICENSE_NRF_PACS,
  LICENSE_ZEPHYR,
  NRF_PACS_SVD_FILES,
  ZEPHYR_NORDIC_FILES,
  nordicSourceSpecs,
} from '../../sources';

export {
  KICAD_NORDIC_FILES,
  LICENSE_KICAD,
  LICENSE_NRF_PACS,
  LICENSE_ZEPHYR,
  NRF_PACS_SVD_FILES,
  ZEPHYR_NORDIC_FILES,
  nordicSourceSpecs,
};

/** Canonical provenance id of the SVD source. */
export const NORDIC_SOURCE_ID = 'nrf-pacs';

/** Absolute path of one Nordic raw file in the gitignored cache. */
export function nordicCachePath(cacheDir: string, sourceId: string, relativePath: string): string {
  const dir = sourceId === 'nrf-pacs' ? 'nrf-pacs' : sourceId === 'zephyr' ? 'zephyr' : 'kicad-nordic';
  return path.join(cacheDir, dir, relativePath);
}
