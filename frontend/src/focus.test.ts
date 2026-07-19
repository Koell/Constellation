import { describe, expect, it } from "vitest";
import type { Vec3 } from "./scaling";
import { deriveTarget, framingDistance, ORIGIN, SmoothTarget } from "./focus";

describe("deriveTarget", () => {
  const positions: Record<string, Vec3> = {
    earth: [100, 5, -20],
    io: [700, 0, 3],
  };
  const lookup = (name: string): Vec3 | null => positions[name] ?? null;

  it("returns the origin when nothing is focused", () => {
    expect(deriveTarget(null, lookup)).toEqual(ORIGIN);
  });

  it("returns the focused body's world position", () => {
    expect(deriveTarget("earth", lookup)).toEqual([100, 5, -20]);
  });

  it("falls back to the origin when the focused body has no position", () => {
    expect(deriveTarget("pluto", lookup)).toEqual(ORIGIN);
  });
});

describe("framingDistance", () => {
  it("scales with body radius for large bodies", () => {
    expect(framingDistance(28)).toBe(140); // Sun-ish: 28 * 5
  });

  it("clamps tiny bodies to a usable minimum distance", () => {
    expect(framingDistance(0.4)).toBe(12);
    expect(framingDistance(0.4, 20)).toBe(20);
  });
});

describe("SmoothTarget", () => {
  it("snapTo sets the current point immediately", () => {
    const t = new SmoothTarget();
    t.snapTo([1, 2, 3]);
    expect(t.current()).toEqual([1, 2, 3]);
  });

  it("update moves toward the desired target and converges", () => {
    const t = new SmoothTarget([0, 0, 0], 0.2);
    t.setDesired([100, 0, 0]);
    const first = t.update(1000 / 60);
    expect(first[0]).toBeGreaterThan(0);
    expect(first[0]).toBeLessThan(100);
    for (let i = 0; i < 400; i++) t.update(1000 / 60);
    const c = t.current();
    expect(c[0]).toBeCloseTo(100, 3);
  });

  it("does not move on a zero-length frame", () => {
    const t = new SmoothTarget([0, 0, 0]);
    t.setDesired([50, 50, 50]);
    expect(t.update(0)).toEqual([0, 0, 0]);
  });

  it("is frame-rate independent (same wall-time → same progress)", () => {
    const big = new SmoothTarget([0, 0, 0], 0.15);
    const small = new SmoothTarget([0, 0, 0], 0.15);
    big.setDesired([100, 0, 0]);
    small.setDesired([100, 0, 0]);
    big.update(100); // one 100ms frame
    for (let i = 0; i < 6; i++) small.update(100 / 6); // six ~16.7ms frames
    expect(big.current()[0]).toBeCloseTo(small.current()[0], 4);
  });

  it("tracks a moving desired target with a small trailing gap", () => {
    const t = new SmoothTarget([0, 0, 0], 0.3);
    // warm up toward a moving target
    for (let step = 0; step < 200; step++) {
      t.setDesired([step, 0, 0]);
      t.update(1000 / 60);
    }
    // once warmed up, the follow gap is small and bounded
    expect(Math.abs(t.current()[0] - 199)).toBeLessThan(5);
  });
});
