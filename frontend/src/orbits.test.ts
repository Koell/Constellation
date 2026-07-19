import { describe, expect, it, vi } from "vitest";
import type { OrbitLoop } from "./orbits";
import { OrbitCache } from "./orbits";

function loop(parent: string): OrbitLoop {
  return { parent, points: [[1, 0, 0], [0, 1, 0], [-1, 0, 0]] };
}

describe("OrbitCache", () => {
  it("fetches requested bodies and caches them", async () => {
    const fetcher = vi.fn(async (names: string[]) =>
      Object.fromEntries(names.map((n) => [n, loop("sol")])),
    );
    const cache = new OrbitCache(fetcher);
    const fresh = await cache.load(["earth", "mars"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(["earth", "mars"]);
    expect([...fresh.keys()]).toEqual(["earth", "mars"]);
    expect(cache.has("earth")).toBe(true);
    expect(cache.get("mars")?.parent).toBe("sol");
  });

  it("only fetches bodies not already cached", async () => {
    const fetcher = vi.fn(async (names: string[]) =>
      Object.fromEntries(names.map((n) => [n, loop("sol")])),
    );
    const cache = new OrbitCache(fetcher);
    await cache.load(["earth", "mars"]);
    const fresh = await cache.load(["mars", "jupiter"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(["jupiter"]); // mars already cached
    expect([...fresh.keys()]).toEqual(["jupiter"]);
  });

  it("does not fetch at all when everything is cached", async () => {
    const fetcher = vi.fn(async (names: string[]) =>
      Object.fromEntries(names.map((n) => [n, loop("sol")])),
    );
    const cache = new OrbitCache(fetcher);
    await cache.load(["earth"]);
    const fresh = await cache.load(["earth"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fresh.size).toBe(0);
  });
});
