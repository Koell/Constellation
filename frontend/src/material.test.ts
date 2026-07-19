import { describe, expect, it } from "vitest";
import type { CatalogBody } from "./catalog";
import { materialSpecFor } from "./material";

function body(overrides: Partial<CatalogBody>): CatalogBody {
  return {
    name: "x",
    display_name: "X",
    type: "planet",
    radius_km: 1,
    color: "#abcdef",
    texture: null,
    orbital_period_days: 1,
    default_visible: true,
    orbitals: [],
    ...overrides,
  };
}

describe("materialSpecFor", () => {
  it("uses a textured material when a texture ref is present", () => {
    const spec = materialSpecFor(body({ texture: "textures/earth.jpg" }));
    expect(spec.kind).toBe("textured");
    expect(spec.textureUrl).toBe("/textures/earth.jpg");
  });

  it("falls back to a colored material when texture is null", () => {
    const spec = materialSpecFor(body({ texture: null, color: "#8f8579" }));
    expect(spec.kind).toBe("colored");
    expect(spec.textureUrl).toBeNull();
    expect(spec.color).toBe("#8f8579");
  });

  it("renders the star unlit (basic), texture or not", () => {
    expect(materialSpecFor(body({ type: "star", texture: "textures/sun.jpg" })).kind).toBe(
      "basic",
    );
    expect(materialSpecFor(body({ type: "star", texture: null })).kind).toBe("basic");
  });
});
