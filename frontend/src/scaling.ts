/**
 * Scaling between physical space (orbitarium: km, ecliptic-J2000, z = ecliptic
 * north) and scene space (Three.js units, y-up).
 *
 * Distances are true to scale; body radii are exaggerated and clamped so
 * everything stays visible (per PRD). Moon-orbit boosting arrives with the
 * moons slice.
 */

export const KM_PER_UNIT = 1_000_000;

/** Radius exaggeration for planets and moons. */
export const RADIUS_EXAGGERATION = 50;

/** The Sun gets a gentler factor so it doesn't swallow Mercury's orbit. */
export const STAR_RADIUS_EXAGGERATION = 10;

/** Smallest rendered radius, scene units. */
export const MIN_RADIUS_UNITS = 0.4;

export type Vec3 = [number, number, number];

export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

/**
 * Ecliptic-J2000 (right-handed, z up) → Three.js (right-handed, y up):
 * (x, y, z) → (x, z, -y). The ecliptic plane lands on the scene's xz-plane.
 */
export function eclipticKmToScene([x, y, z]: Vec3): Vec3 {
  return [kmToUnits(x), kmToUnits(z), kmToUnits(-y)];
}

export function bodyRadiusUnits(radiusKm: number, isStar = false): number {
  const factor = isStar ? STAR_RADIUS_EXAGGERATION : RADIUS_EXAGGERATION;
  return Math.max(kmToUnits(radiusKm * factor), MIN_RADIUS_UNITS);
}

/** How far a moon orbit must clear its parent's rendered surface. */
export const MOON_CLEARANCE = 2.0;

/**
 * Uniform boost for one planet's satellite system: scales all its moons'
 * orbital radii so the innermost orbit clears the parent's exaggerated
 * sphere by MOON_CLEARANCE. Uniform per parent → relative ordering of the
 * moons is preserved. Never shrinks (min 1).
 */
export function moonOrbitBoost(
  parentRenderedRadiusUnits: number,
  innermostOrbitKm: number,
  clearance = MOON_CLEARANCE,
): number {
  const innermostUnits = kmToUnits(innermostOrbitKm);
  if (innermostUnits <= 0) return 1;
  return Math.max(1, (parentRenderedRadiusUnits * clearance) / innermostUnits);
}

/** World position of a moon: parent's world position plus its boosted,
 * axis-remapped parent-local offset. */
export function moonWorldPosition(
  parentWorld: Vec3,
  localKm: Vec3,
  boost: number,
): Vec3 {
  const [x, y, z] = eclipticKmToScene(localKm);
  return [
    parentWorld[0] + x * boost,
    parentWorld[1] + y * boost,
    parentWorld[2] + z * boost,
  ];
}
