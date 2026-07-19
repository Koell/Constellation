import { describe, expect, it } from "vitest";
import {
  bodyRadiusUnits,
  eclipticKmToScene,
  KM_PER_UNIT,
  kmToUnits,
  MIN_RADIUS_UNITS,
  MOON_CLEARANCE,
  moonOrbitBoost,
  moonWorldPosition,
  RADIUS_EXAGGERATION,
  STAR_RADIUS_EXAGGERATION,
} from "./scaling";

describe("kmToUnits", () => {
  it("divides by the global scale factor", () => {
    expect(kmToUnits(KM_PER_UNIT)).toBe(1);
    expect(kmToUnits(149_597_870)).toBeCloseTo(149.59787, 5);
  });
});

describe("eclipticKmToScene", () => {
  it("maps ecliptic z (north) onto scene y (up)", () => {
    expect(eclipticKmToScene([0, 0, KM_PER_UNIT])).toEqual([0, 1, -0]);
  });

  it("maps ecliptic y onto scene -z, preserving handedness", () => {
    expect(eclipticKmToScene([0, KM_PER_UNIT, 0])).toEqual([0, 0, -1]);
    expect(eclipticKmToScene([KM_PER_UNIT, 0, 0])).toEqual([1, 0, -0]);
  });

  it("keeps true relative distances", () => {
    const [x] = eclipticKmToScene([4_500_000_000, 0, 0]);
    const [x2] = eclipticKmToScene([150_000_000, 0, 0]);
    expect(x / x2).toBeCloseTo(30, 5);
  });
});

describe("bodyRadiusUnits", () => {
  it("exaggerates planet radii by the global factor", () => {
    const jupiter = bodyRadiusUnits(69_911);
    expect(jupiter).toBeCloseTo((69_911 * RADIUS_EXAGGERATION) / KM_PER_UNIT, 6);
    expect(jupiter).toBeGreaterThan(MIN_RADIUS_UNITS);
  });

  it("clamps small bodies to the minimum visible radius", () => {
    expect(bodyRadiusUnits(0.33)).toBe(MIN_RADIUS_UNITS);
    expect(bodyRadiusUnits(2439.7)).toBe(MIN_RADIUS_UNITS); // Mercury hits the clamp
  });

  it("uses the gentler star factor for the Sun", () => {
    expect(bodyRadiusUnits(695_700, true)).toBeCloseTo(
      (695_700 * STAR_RADIUS_EXAGGERATION) / KM_PER_UNIT,
      6,
    );
  });

  it("clamp boundary: radius exactly at the minimum stays put", () => {
    const boundaryKm = (MIN_RADIUS_UNITS * KM_PER_UNIT) / RADIUS_EXAGGERATION;
    expect(bodyRadiusUnits(boundaryKm)).toBe(MIN_RADIUS_UNITS);
  });
});

describe("moonOrbitBoost", () => {
  // Jupiter: rendered radius 3.5 units; Metis orbits at 128,000 km (0.128 units).
  const jupiterUnits = bodyRadiusUnits(69_911);
  const metisOrbitKm = 128_000;

  it("boosts the innermost orbit to clear the parent's rendered sphere", () => {
    const boost = moonOrbitBoost(jupiterUnits, metisOrbitKm);
    const boostedMetis = kmToUnits(metisOrbitKm) * boost;
    expect(boostedMetis).toBeCloseTo(jupiterUnits * MOON_CLEARANCE, 6);
    expect(boostedMetis).toBeGreaterThan(jupiterUnits);
  });

  it("preserves relative ordering of a planet's moons (uniform scaling)", () => {
    const boost = moonOrbitBoost(jupiterUnits, metisOrbitKm);
    const orbitsKm = [128_000, 421_700, 671_000, 1_070_400, 1_882_700];
    const boosted = orbitsKm.map((r) => kmToUnits(r) * boost);
    for (let i = 1; i < boosted.length; i++) {
      expect(boosted[i]).toBeGreaterThan(boosted[i - 1]);
    }
    // ratios unchanged by a uniform boost
    expect(boosted[1] / boosted[0]).toBeCloseTo(421_700 / 128_000, 6);
  });

  it("never shrinks an orbit that already clears the parent", () => {
    // Luna at 384,400 km around Earth (rendered 0.4 units clamped):
    // boost needed is ~2.08 for clearance 2; a huge orbit needs none.
    expect(moonOrbitBoost(0.4, 10_000_000)).toBe(1);
  });
});

describe("moonWorldPosition", () => {
  it("composes parent world position with the boosted local offset", () => {
    const parent: [number, number, number] = [100, 5, -20];
    // local +z (ecliptic north) maps to scene +y
    const world = moonWorldPosition(parent, [0, 0, 2_000_000], 3);
    expect(world).toEqual([100, 5 + 6, -20]);
  });
});
