import { describe, expect, it, vi } from "vitest";
import type { TrajectoryPayload } from "./trajectoryStore";
import { TrajectoryStore } from "./trajectoryStore";

const HOUR = 3_600_000;

/** Fake backend: "earth" moves linearly (x = t, y = 2t), 5 samples per
 * window; "luna" is parent-local around earth. Linear motion makes
 * interpolation results exactly predictable. */
function fakeFetcher(startMs: number, endMs: number): Promise<TrajectoryPayload> {
  const times = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => startMs + (endMs - startMs) * f,
  );
  return Promise.resolve({
    bodies: {
      earth: {
        parent: "sol",
        times,
        positions: times.map((t) => [t, 2 * t, 0] as [number, number, number]),
      },
      luna: {
        parent: "earth",
        times,
        positions: times.map((t) => [-t, 0, t] as [number, number, number]),
      },
    },
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("TrajectoryStore", () => {
  it("returns exact values at sample timestamps", async () => {
    const store = new TrajectoryStore(fakeFetcher, {
      minSpanMs: 4 * HOUR,
      backSlack: 0,
    });
    await store.ensure(1000, 1); // window [1000, 1000 + 4h]; t is sample 0
    const t = 1000;
    const pos = store.getPositionAt("earth", t);
    expect(pos).toEqual([t, 2 * t, 0]);
  });

  it("interpolates linearly between samples", async () => {
    const store = new TrajectoryStore(fakeFetcher, { minSpanMs: 4 * HOUR });
    await store.ensure(0, 1);
    // any time inside the window: linear data → interpolation is exact
    const t = 1_234_567;
    expect(store.getPositionAt("earth", t)).toEqual([t, 2 * t, 0]);
    expect(store.getPositionAt("luna", t)).toEqual([-t, 0, t]);
  });

  it("returns null for unknown bodies and before any window loads", () => {
    const store = new TrajectoryStore(fakeFetcher);
    expect(store.getPositionAt("earth", 0)).toBeNull();
  });

  it("exposes the parent chain", async () => {
    const store = new TrajectoryStore(fakeFetcher);
    await store.ensure(0, 1);
    expect(store.getParent("luna")).toBe("earth");
    expect(store.getParent("earth")).toBe("sol");
    expect(store.getParent("vulcan")).toBeNull();
  });

  it("prefetches the next window once the current one is mostly consumed", async () => {
    const fetcher = vi.fn(fakeFetcher);
    const store = new TrajectoryStore(fetcher, {
      minSpanMs: 4 * HOUR,
      prefetchAt: 0.6,
      backSlack: 0,
    });
    await store.ensure(0, 1); // window [0, 4h]
    expect(fetcher).toHaveBeenCalledTimes(1);

    store.update(1 * HOUR, 1); // 25% consumed — no prefetch yet
    expect(fetcher).toHaveBeenCalledTimes(1);

    store.update(3 * HOUR, 1); // 75% consumed — prefetch fires
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(4 * HOUR, 8 * HOUR);

    store.update(3.5 * HOUR, 1); // already prefetching — no duplicate
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("swaps to the prefetched window seamlessly at the seam", async () => {
    const store = new TrajectoryStore(fakeFetcher, {
      minSpanMs: 4 * HOUR,
      backSlack: 0,
    });
    await store.ensure(0, 1);
    store.update(3 * HOUR, 1); // trigger prefetch of [4h, 8h]
    await flush();

    store.update(4.5 * HOUR, 1); // crossed the seam → swap
    const t = 4.5 * HOUR;
    expect(store.getPositionAt("earth", t)).toEqual([t, 2 * t, 0]);
  });

  it("refetches around the new time after a jump outside all windows", async () => {
    const fetcher = vi.fn(fakeFetcher);
    const store = new TrajectoryStore(fetcher, {
      minSpanMs: 4 * HOUR,
      backSlack: 0,
    });
    await store.ensure(0, 1);

    const jumpTarget = 1000 * HOUR;
    store.update(jumpTarget, 1);
    await flush();
    expect(fetcher).toHaveBeenLastCalledWith(jumpTarget, jumpTarget + 4 * HOUR);
    expect(store.getPositionAt("earth", jumpTarget)).toEqual([
      jumpTarget,
      2 * jumpTarget,
      0,
    ]);
  });

  it("clamps to window edges while a refetch is in flight", async () => {
    const store = new TrajectoryStore(fakeFetcher, {
      minSpanMs: 4 * HOUR,
      backSlack: 0,
    });
    await store.ensure(0, 1);
    // far beyond the window, refetch not yet resolved: holds the edge sample
    const edge = store.getPositionAt("earth", 100 * HOUR);
    expect(edge).toEqual([4 * HOUR, 8 * HOUR, 0]);
  });

  it("prefetches backward when playing in reverse", async () => {
    const fetcher = vi.fn(fakeFetcher);
    const store = new TrajectoryStore(fetcher, {
      minSpanMs: 4 * HOUR,
      prefetchAt: 0.6,
      backSlack: 0,
    });
    await store.ensure(8 * HOUR, 1); // window [8h, 12h]
    expect(fetcher).toHaveBeenCalledTimes(1);

    store.update(11 * HOUR, -1); // 25% consumed backward — nothing yet
    expect(fetcher).toHaveBeenCalledTimes(1);

    store.update(9 * HOUR, -1); // 75% consumed backward — prefetch previous
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(4 * HOUR, 8 * HOUR);
    await flush();

    store.update(7 * HOUR, -1); // crossed the seam backward → swap
    const t = 7 * HOUR;
    expect(store.getPositionAt("earth", t)).toEqual([t, 2 * t, 0]);
  });

  it("anchors jump windows behind the jump time in reverse", async () => {
    const fetcher = vi.fn(fakeFetcher);
    const store = new TrajectoryStore(fetcher, {
      minSpanMs: 4 * HOUR,
      backSlack: 0.25,
    });
    await store.ensure(0, -1);
    // window mostly precedes the anchor: [0 - 0.75*4h, 0 + 0.25*4h]
    expect(fetcher).toHaveBeenLastCalledWith(-3 * HOUR, 1 * HOUR);
  });

  it("scales the window span with speed, clamped to bounds", () => {
    const store = new TrajectoryStore(fakeFetcher, {
      realSecondsPerWindow: 60,
      minSpanMs: HOUR,
      maxSpanMs: 2000 * HOUR,
    });
    expect(store.spanFor(1)).toBe(HOUR); // 60s of real time at 1× → clamped up
    expect(store.spanFor(86_400)).toBe(60 * 86_400 * 1000); // 60 sim-days
    expect(store.spanFor(10_000_000)).toBe(2000 * HOUR); // clamped down
    expect(store.spanFor(-86_400)).toBe(60 * 86_400 * 1000); // reverse: same span
  });
});
