import type { Vec3 } from "./scaling";

export interface OrbitLoop {
  parent: string;
  points: Vec3[];
}

export type OrbitFetcher = (names: string[]) => Promise<Record<string, OrbitLoop>>;

/**
 * Session cache of orbit loops. Each body's loop is fetched at most once; a
 * `load` for a mix of cached and new bodies only requests the new ones.
 */
export class OrbitCache {
  private readonly cache = new Map<string, OrbitLoop>();

  constructor(private readonly fetcher: OrbitFetcher) {}

  /** Ensure loops for `names` are cached; returns only the newly-loaded ones. */
  async load(names: string[]): Promise<Map<string, OrbitLoop>> {
    const missing = names.filter((n) => !this.cache.has(n));
    const fresh = new Map<string, OrbitLoop>();
    if (missing.length === 0) return fresh;
    const loops = await this.fetcher(missing);
    for (const [name, loop] of Object.entries(loops)) {
      this.cache.set(name, loop);
      fresh.set(name, loop);
    }
    return fresh;
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  get(name: string): OrbitLoop | undefined {
    return this.cache.get(name);
  }
}
