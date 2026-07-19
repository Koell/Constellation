import type { Vec3 } from "./scaling";

export interface BodySamples {
  parent: string;
  times: number[];
  positions: Vec3[];
}

export interface TrajectoryPayload {
  bodies: Record<string, BodySamples>;
}

export type Fetcher = (startMs: number, endMs: number) => Promise<TrajectoryPayload>;

interface LoadedWindow {
  startMs: number;
  endMs: number;
  bodies: Record<string, BodySamples>;
}

export interface StoreOptions {
  /** Window span ≈ this many real seconds of playback at the current speed. */
  realSecondsPerWindow?: number;
  minSpanMs?: number;
  maxSpanMs?: number;
  /** Fraction of the window consumed before the next one is prefetched. */
  prefetchAt?: number;
  /** Fraction of a jump-target window placed before the jump time (backward slack). */
  backSlack?: number;
}

/**
 * Owns trajectory windows: fetching, prefetch, and interpolation. The scene
 * only ever calls getPositionAt(body, simTime) — parent-local km, ecliptic
 * axes, interpolated between backend samples. update() is called per frame
 * and is cheap unless a fetch is due.
 */
export class TrajectoryStore {
  private current: LoadedWindow | null = null;
  private next: LoadedWindow | null = null;
  private inflight: Promise<void> | null = null;
  private readonly realSecondsPerWindow: number;
  private readonly minSpanMs: number;
  private readonly maxSpanMs: number;
  private readonly prefetchAt: number;
  private readonly backSlack: number;

  constructor(
    private readonly fetcher: Fetcher,
    options: StoreOptions = {},
  ) {
    this.realSecondsPerWindow = options.realSecondsPerWindow ?? 60;
    this.minSpanMs = options.minSpanMs ?? 3_600_000; // 1 hour
    this.maxSpanMs = options.maxSpanMs ?? 2 * 365.25 * 86_400_000; // ~2 years
    this.prefetchAt = options.prefetchAt ?? 0.6;
    this.backSlack = options.backSlack ?? 0.15;
  }

  /** Window span for a given speed multiplier (sim-seconds per real-second). */
  spanFor(speed: number): number {
    const span = Math.abs(speed) * this.realSecondsPerWindow * 1000;
    return Math.min(Math.max(span, this.minSpanMs), this.maxSpanMs);
  }

  /** Await the initial window around simMs. */
  async ensure(simMs: number, speed: number): Promise<void> {
    const span = this.spanFor(speed);
    await this.load(this.anchoredStart(simMs, span, speed), span, (w) => {
      this.current = w;
    });
  }

  /** Window start so most of the span lies in the playback direction. */
  private anchoredStart(simMs: number, span: number, speed: number): number {
    return speed < 0
      ? simMs - span * (1 - this.backSlack)
      : simMs - span * this.backSlack;
  }

  /**
   * Per-frame maintenance: swap to the prefetched window when sim-time
   * crosses the seam, prefetch when the current window is mostly consumed,
   * refetch when sim-time jumps outside everything loaded.
   */
  update(simMs: number, speed: number): void {
    const span = this.spanFor(speed);
    const cur = this.current;

    if (!cur) {
      if (!this.inflight) {
        void this.load(this.anchoredStart(simMs, span, speed), span, (w) => {
          this.current = w;
        });
      }
      return;
    }

    if (simMs >= cur.startMs && simMs <= cur.endMs) {
      // Fraction consumed in the direction of playback.
      const len = cur.endMs - cur.startMs;
      const consumed =
        speed < 0 ? (cur.endMs - simMs) / len : (simMs - cur.startMs) / len;
      if (!this.next && !this.inflight && consumed > this.prefetchAt) {
        const nextStart = speed < 0 ? cur.startMs - span : cur.endMs;
        void this.load(nextStart, span, (w) => {
          this.next = w;
        });
      }
      return;
    }

    if (this.next && simMs >= this.next.startMs && simMs <= this.next.endMs) {
      this.current = this.next;
      this.next = null;
      return;
    }

    if (!this.inflight) {
      this.next = null;
      void this.load(this.anchoredStart(simMs, span, speed), span, (w) => {
        this.current = w;
      });
    }
  }

  /**
   * Interpolated parent-local position (km) at simMs, or null before the
   * first window arrives. Outside the loaded window the position clamps to
   * the window edge, so motion holds rather than vanishing during a fetch.
   */
  getPositionAt(body: string, simMs: number): Vec3 | null {
    const samples = this.lookup(body, simMs);
    if (!samples) return null;
    const { times, positions } = samples;

    if (simMs <= times[0]) return positions[0];
    if (simMs >= times[times.length - 1]) return positions[positions.length - 1];

    let lo = 0;
    let hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= simMs) lo = mid;
      else hi = mid;
    }
    const f = (simMs - times[lo]) / (times[hi] - times[lo]);
    const a = positions[lo];
    const b = positions[hi];
    return [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ];
  }

  getParent(body: string): string | null {
    return (
      this.current?.bodies[body]?.parent ??
      this.next?.bodies[body]?.parent ??
      null
    );
  }

  private lookup(body: string, simMs: number): BodySamples | null {
    // Prefer whichever loaded window contains simMs; fall back to current.
    for (const w of [this.current, this.next]) {
      if (w && simMs >= w.startMs && simMs <= w.endMs && w.bodies[body]) {
        return w.bodies[body];
      }
    }
    return this.current?.bodies[body] ?? null;
  }

  private async load(
    startMs: number,
    span: number,
    apply: (w: LoadedWindow) => void,
  ): Promise<void> {
    const endMs = startMs + span;
    const promise = this.fetcher(startMs, endMs)
      .then((payload) => {
        apply({ startMs, endMs, bodies: payload.bodies });
      })
      .finally(() => {
        if (this.inflight === promise) this.inflight = null;
      });
    this.inflight = promise;
    await promise;
  }
}
