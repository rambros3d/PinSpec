import type { PackageRotation } from './types';

/** The four supported clockwise orientations in cycle order. */
export const PACKAGE_ROTATIONS = [0, 90, 180, 270] as const;

/** Package edges, named by the side where an unrotated pin is shown. */
export type PackageSide = 'left' | 'bottom' | 'right' | 'top';

/** Edges in clockwise screen order, used to advance a side by quarter turns. */
const CLOCKWISE_SIDES: readonly PackageSide[] = ['top', 'right', 'bottom', 'left'];

/** Advance the package one clockwise quarter turn, wrapping 270 back to 0. */
export function cycleRotationClockwise(rotation: PackageRotation): PackageRotation {
  return (((rotation / 90 + 1) % PACKAGE_ROTATIONS.length) * 90) as PackageRotation;
}

/** True when a quarter turn swaps the declared package extents. */
export function isQuarterTurn(rotation: PackageRotation): boolean {
  return rotation === 90 || rotation === 270;
}

/** Resolve the displayed edge of a pin after rotating its package clockwise. */
export function displayedSide(side: PackageSide, rotation: PackageRotation): PackageSide {
  const index = CLOCKWISE_SIDES.indexOf(side);
  if (index < 0) return side;
  return CLOCKWISE_SIDES[(index + rotation / 90) % CLOCKWISE_SIDES.length] ?? side;
}

/** Screen-space label angle for a displayed edge: horizontal on left and right, vertical on top and bottom. */
export function resolveTextAngle(side: PackageSide): 0 | -90 {
  return side === 'top' || side === 'bottom' ? -90 : 0;
}

/**
 * Local label angle to apply inside a geometry group rotated by `rotation`.
 * The geometry rotation plus this local angle equals the resolved screen angle,
 * so labels never render upside down.
 */
export function localLabelAngle(side: PackageSide, rotation: PackageRotation): number {
  return resolveTextAngle(displayedSide(side, rotation)) - rotation;
}
