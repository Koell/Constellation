import { describe, expect, it } from "vitest";
import type { CatalogBody } from "./catalog";
import { flattenCatalog } from "./bodyTree";

function body(
  name: string,
  type: string,
  orbitals: CatalogBody[] = [],
): CatalogBody {
  return {
    name,
    display_name: name[0].toUpperCase() + name.slice(1),
    type,
    radius_km: 1,
    color: "#fff",
    texture: null,
    orbital_period_days: type === "star" ? null : 1,
    default_visible: true,
    orbitals,
  };
}

const fixture = body("sol", "star", [
  body("mercury", "planet"),
  body("earth", "planet", [body("luna", "moon")]),
  body("mars", "planet", [body("phobos", "moon"), body("deimos", "moon")]),
]);

describe("flattenCatalog", () => {
  it("lists every body exactly once, parents before children", () => {
    const flat = flattenCatalog(fixture);
    expect(flat.map((b) => b.name)).toEqual([
      "sol",
      "mercury",
      "earth",
      "luna",
      "mars",
      "phobos",
      "deimos",
    ]);
  });

  it("assigns depth by nesting level", () => {
    const flat = flattenCatalog(fixture);
    const byName = Object.fromEntries(flat.map((b) => [b.name, b.depth]));
    expect(byName).toEqual({
      sol: 0,
      mercury: 1,
      earth: 1,
      luna: 2,
      mars: 1,
      phobos: 2,
      deimos: 2,
    });
  });
});
