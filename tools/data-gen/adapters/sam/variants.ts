/** Part scope and ordercode metadata derived from ATDF `<variant>` elements. */
import type { ChipPinoutMetadata, ChipVariantMetadata } from '../../../../src/core/types';
import { SAM_ATDF_PATHS } from '../../sources';
import type { AtdfDocument, AtdfPinout, AtdfVariant } from './types';

/** One curated SAM family and the number of files declared for it. */
export interface SamFamilyScope {
  series: string;
  family: string;
  count: number;
}

/** Curated family counts; they are a scope definition, not transcribed chip facts. */
export const SAM_FAMILY_SCOPE: readonly SamFamilyScope[] = [
  { series: 'SAMD21', family: 'SAM D21', count: 14 },
  { series: 'SAMD51', family: 'SAM D51', count: 9 },
  { series: 'SAME51', family: 'SAM E51', count: 7 },
  { series: 'SAMV71', family: 'SAMV71', count: 9 },
];

/** Total number of curated ATDF files. */
export const SAM_PART_COUNT = SAM_ATDF_PATHS.length;

/** Part stems in declaration order. */
export const SAM_PART_STEMS: readonly string[] = SAM_ATDF_PATHS.map((file) =>
  file.slice(file.lastIndexOf('/') + 1, -'.atdf'.length),
);

/** Family label for one ATDF stem, derived from the curated path scope. */
export function familyForStem(stem: string): string {
  const scope = SAM_FAMILY_SCOPE.find((item) => stem.includes(item.series));
  return scope?.family ?? 'SAM';
}

/** Series identifier for one ATDF stem. */
export function seriesForStem(stem: string): string {
  return SAM_FAMILY_SCOPE.find((item) => stem.includes(item.series))?.series ?? 'SAM';
}

/** CPU core label from the ATDF `architecture` attribute. */
export function coreForArchitecture(architecture: string | undefined): string {
  switch (architecture) {
    case 'CORTEX-M0PLUS':
      return 'Cortex-M0+';
    case 'CORTEX-M4':
      return 'Cortex-M4';
    case 'CORTEX-M7':
      return 'Cortex-M7';
    case 'CORTEX-A5':
      return 'Cortex-A5';
    default:
      return architecture ?? 'unknown';
  }
}

/** Copies ATDF ordercodes into catalog metadata without adding shards. */
export function variantMetadata(variants: AtdfVariant[]): ChipVariantMetadata[] {
  return variants.map((variant) => ({
    ordercode: variant.ordercode,
    package: variant.package,
    pinout: variant.pinout,
    ...(variant.tempmin ? { tempMin: variant.tempmin } : {}),
    ...(variant.tempmax ? { tempMax: variant.tempmax } : {}),
    ...(variant.vccmin ? { vccMin: variant.vccmin } : {}),
    ...(variant.vccmax ? { vccMax: variant.vccmax } : {}),
    ...(variant.speedmax ? { speedMax: variant.speedmax } : {}),
  }));
}

/** Pinout metadata for every pinout declared by one part. */
export function pinoutMetadata(
  pinouts: AtdfPinout[],
  packageForPinout: (name: string) => string | undefined,
): ChipPinoutMetadata[] {
  return pinouts.map((pinout) => ({
    name: pinout.name,
    package: packageForPinout(pinout.name) ?? 'unknown',
    pinCount: pinout.pins.length,
  }));
}

/** Pinout selected for the shard: the first variant's pinout wins. */
export function primaryPinout(doc: AtdfDocument): AtdfPinout | undefined {
  const name = doc.variants[0]?.pinout;
  return doc.pinouts.find((pinout) => pinout.name === name) ?? doc.pinouts[0];
}

/** Package name of the primary pinout as declared by its variant. */
export function primaryPackage(doc: AtdfDocument): string {
  return doc.variants.find((variant) => variant.pinout === primaryPinout(doc)?.name)?.package ??
    doc.variants[0]?.package ??
    'unknown';
}
