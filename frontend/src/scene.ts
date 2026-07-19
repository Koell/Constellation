import * as THREE from "three";
import type { CatalogBody } from "./catalog";
import { bodyRadiusUnits } from "./scaling";
import { materialSpecFor } from "./material";

export interface SolarSystem {
  group: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
  parents: Map<string, string>;
  bodies: Map<string, CatalogBody>;
}

const textureLoader = new THREE.TextureLoader();

function surfaceMaterial(body: CatalogBody): THREE.Material {
  const spec = materialSpecFor(body);
  // Start from the body's flat color so it's never black; the texture (if
  // any) replaces it only once it has actually decoded — an unloaded map
  // samples black, and the file might be missing.
  const mat =
    spec.kind === "basic"
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.color) })
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.color),
          roughness: 0.85,
          metalness: 0,
        });
  if (spec.textureUrl && spec.kind !== "colored") {
    applyTextureWhenReady(mat, spec.textureUrl);
  }
  return mat;
}

function applyTextureWhenReady(
  mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
  url: string,
): void {
  textureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.color.set(0xffffff); // show the texture at true brightness
      mat.needsUpdate = true;
    },
    undefined,
    () => {
      /* load failed: keep the flat color already set */
    },
  );
}

/**
 * Builds meshes for every catalog body. Visibility starts at each body's
 * default_visible flag. Textured bodies use their surface map; the rest fall
 * back to their catalog color. Positions are driven per-frame.
 */
export function buildSolarSystem(catalog: CatalogBody): SolarSystem {
  const group = new THREE.Group();
  const meshes = new Map<string, THREE.Mesh>();
  const parents = new Map<string, string>();
  const bodies = new Map<string, CatalogBody>();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadiusUnits(catalog.radius_km, true), 64, 32),
    surfaceMaterial(catalog),
  );
  sun.name = catalog.name;
  group.add(sun);
  meshes.set(catalog.name, sun);
  bodies.set(catalog.name, catalog);

  const addChildren = (parent: CatalogBody) => {
    for (const body of parent.orbitals) {
      const isMoon = body.type === "moon";
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(
          bodyRadiusUnits(body.radius_km),
          isMoon ? 24 : 48,
          isMoon ? 12 : 24,
        ),
        surfaceMaterial(body),
      );
      mesh.name = body.name;
      mesh.visible = body.default_visible;
      group.add(mesh);
      meshes.set(body.name, mesh);
      parents.set(body.name, parent.name);
      bodies.set(body.name, body);
      addChildren(body);
    }
  };
  addChildren(catalog);

  return { group, meshes, parents, bodies };
}

/** Procedural starfield: points on a large sphere that follows the camera,
 * so stars have no parallax. No external asset required. */
export function buildStarfield(count = 4000, radius = 60_000): THREE.Points {
  const positions = new Float32Array(count * 3);
  // Deterministic scatter (no Math.random): golden-angle spiral on a sphere.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x9aa4bf,
    // Fixed pixel size (no attenuation) keeps stars a faint 1-2px background
    // that can't be mistaken for the min-sized body discs.
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.8,
  });
  return new THREE.Points(geometry, material);
}
