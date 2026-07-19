import { describe, expect, it } from "vitest";
import {
  bodyRadiusUnits,
  eclipticKmToScene,
  KM_PER_UNIT,
  kmToUnits,
  MIN_RADIUS_UNITS,
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
