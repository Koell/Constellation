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
