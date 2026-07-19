import type { Vec3 } from "./scaling";

export const ORIGIN: Vec3 = [0, 0, 0];

/**
 * Pivot target for the camera: the focused body's world position, or the
 * Sun (origin) when nothing is focused or the body's position is unknown.
 * Pure — the world-position lookup is injected, so it's unit-testable.
 */
export function deriveTarget(
  focused: string | null,
  worldPositionOf: (name: string) => Vec3 | null,
): Vec3 {
  if (!focused) return ORIGIN;
  return worldPositionOf(focused) ?? ORIGIN;
}

/** Camera distance that frames a body of the given rendered radius. */
export function framingDistance(bodyRadiusUnits: number, minDistance = 12): number {
  return Math.max(bodyRadiusUnits * 5, minDistance);
}

/**
 * A point that eases toward a (possibly moving) desired target. Used for
 * both the fly-to transition when focus changes and the continuous follow
 * once focused — the gap shrinks to near-zero, so a moving body is tracked
 * tightly while a focus change animates smoothly. Frame-rate independent:
 * `smoothing` is the fraction of the gap closed per 1/60 s.
 */
export class SmoothTarget {
  private cur: Vec3;
  private desired: Vec3;

  constructor(
    initial: Vec3 = ORIGIN,
    private readonly smoothing = 0.12,
  ) {
    this.cur = [initial[0], initial[1], initial[2]];
    this.desired = [initial[0], initial[1], initial[2]];
  }

  setDesired(v: Vec3): void {
    this.desired = [v[0], v[1], v[2]];
  }

  snapTo(v: Vec3): void {
    this.cur = [v[0], v[1], v[2]];
    this.desired = [v[0], v[1], v[2]];
  }

  current(): Vec3 {
    return [this.cur[0], this.cur[1], this.cur[2]];
  }

  /** Advance the ease by a real-time delta (ms) and return the new point. */
  update(realDeltaMs: number): Vec3 {
    const steps = realDeltaMs > 0 ? realDeltaMs / (1000 / 60) : 0;
    const alpha = 1 - Math.pow(1 - this.smoothing, steps);
    this.cur = [
      this.cur[0] + (this.desired[0] - this.cur[0]) * alpha,
      this.cur[1] + (this.desired[1] - this.cur[1]) * alpha,
      this.cur[2] + (this.desired[2] - this.cur[2]) * alpha,
    ];
    return this.current();
  }
}
