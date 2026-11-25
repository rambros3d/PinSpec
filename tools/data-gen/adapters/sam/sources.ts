/**
 * SAM source declarations. The raw files and license live in the shared
 * `sources.ts` module so CI pre-fetch and generation use one declaration;
 * this module exposes the cache paths used by the ATDF readers.
 */
import path from 'node:path';
import {
  DEV_PACKS_REF,
  LICENSE_MICROCHIP_ATDF,
  microchipAtdfSourceSpecs,
  SAM_ATDF_PATHS,
} from '../../sources';

export { DEV_PACKS_REF, LICENSE_MICROCHIP_ATDF, SAM_ATDF_PATHS, microchipAtdfSourceSpecs };

/** Canonical provenance id of the raw ATDF source. */
export const SAM_SOURCE_ID = 'microchip-atdf';

/** Absolute path of one curated ATDF file inside the gitignored cache. */
export function atdfCachePath(cacheDir: string, relativePath: string): string {
  return path.join(cacheDir, SAM_SOURCE_ID, relativePath);
}
