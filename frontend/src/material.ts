import type { CatalogBody } from "./catalog";

export interface MaterialSpec {
  /** "basic" = unlit (the Sun); "textured"/"colored" = lit surfaces. */
  kind: "basic" | "textured" | "colored";
  color: string;
  textureUrl: string | null;
}

/**
 * Decides how a body should be rendered from its catalog metadata alone.
 * Pure so it can be unit-tested without a WebGL context: a present texture
 * ref yields a textured material, a null ref falls back to the flat color,
 * and the star renders unlit. The texture path is resolved under the
 * frontend's public/ root.
 */
export function materialSpecFor(body: CatalogBody): MaterialSpec {
  const textureUrl = body.texture ? `/${body.texture}` : null;
  if (body.type === "star") {
    return { kind: "basic", color: body.color, textureUrl };
  }
  return {
    kind: textureUrl ? "textured" : "colored",
    color: body.color,
    textureUrl,
  };
}
