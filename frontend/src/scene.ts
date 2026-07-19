import * as THREE from "three";
import {
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";
import type { CatalogBody } from "./catalog";
import {
  bodyRadiusUnits,
  eclipticKmToScene,
  moonWorldPosition,
  type Vec3,
} from "./scaling";
import { materialSpecFor } from "./material";

export interface SolarSystem {
  group: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
  labels: Map<string, CSS2DObject>;
  parents: Map<string, string>;
  bodies: Map<string, CatalogBody>;
}

/** Camera-facing DOM label for a body, added as a child of its mesh so it
 * tracks position and inherits visibility. The element is clickable (focus). */
function makeLabel(body: CatalogBody, radiusUnits: number): CSS2DObject {
  const el = document.createElement("div");
  el.className = "label";
  el.textContent = body.display_name;
  el.dataset.body = body.name;
  const label = new CSS2DObject(el);
  label.position.set(0, radiusUnits * 1.4 + 0.5, 0); // just above the body
  label.center.set(0.5, 1);
  return label;
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
  const labels = new Map<string, CSS2DObject>();
  const parents = new Map<string, string>();
  const bodies = new Map<string, CatalogBody>();

  const sunRadius = bodyRadiusUnits(catalog.radius_km, true);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius, 64, 32),
    surfaceMaterial(catalog),
  );
  sun.name = catalog.name;
  const sunLabel = makeLabel(catalog, sunRadius);
  sun.add(sunLabel);
  group.add(sun);
  meshes.set(catalog.name, sun);
  labels.set(catalog.name, sunLabel);
  bodies.set(catalog.name, catalog);

  const addChildren = (parent: CatalogBody) => {
    for (const body of parent.orbitals) {
      const isMoon = body.type === "moon";
      const radius = bodyRadiusUnits(body.radius_km);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, isMoon ? 24 : 48, isMoon ? 12 : 24),
        surfaceMaterial(body),
      );
      mesh.name = body.name;
      mesh.visible = body.default_visible;
      const label = makeLabel(body, radius);
      label.visible = body.default_visible;
      mesh.add(label);
      group.add(mesh);
      meshes.set(body.name, mesh);
      labels.set(body.name, label);
      parents.set(body.name, parent.name);
      bodies.set(body.name, body);
      addChildren(body);
    }
  };
  addChildren(catalog);

  return { group, meshes, labels, parents, bodies };
}

/**
 * Closed orbit loop for a body from its parent-centric period samples.
 * Planet orbits use true heliocentric coordinates centered at the origin;
 * moon orbits are built in parent-local space with the moon-orbit boost, so
 * the caller can position the loop at the parent each frame.
 */
export function buildOrbitLine(
  points: Vec3[],
  color: string,
  isMoon: boolean,
  boost: number,
): THREE.LineLoop {
  const verts = points.map((p) => {
    const [x, y, z] = isMoon
      ? moonWorldPosition([0, 0, 0], p, boost)
      : eclipticKmToScene(p);
    return new THREE.Vector3(x, y, z);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(verts);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
  });
  return new THREE.LineLoop(geometry, material);
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
