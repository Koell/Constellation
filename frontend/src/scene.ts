import * as THREE from "three";
import type { CatalogBody } from "./catalog";
import { bodyRadiusUnits, eclipticKmToScene, type Vec3 } from "./scaling";

export interface TrajectoryWindow {
  times: number[];
  bodies: Record<string, { parent: string; positions: Vec3[] }>;
}

export interface SolarSystem {
  group: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
}

/**
 * Builds the snapshot scene: the Sun at the origin plus every default-visible
 * direct child (planets, Pluto) at its heliocentric position from the first
 * sample of the window. Moons arrive with a later slice.
 */
export function buildSolarSystem(
  catalog: CatalogBody,
  window: TrajectoryWindow,
): SolarSystem {
  const group = new THREE.Group();
  const meshes = new Map<string, THREE.Mesh>();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadiusUnits(catalog.radius_km, true), 48, 24),
    new THREE.MeshBasicMaterial({ color: catalog.color }),
  );
  sun.name = catalog.name;
  group.add(sun);
  meshes.set(catalog.name, sun);

  for (const body of catalog.orbitals) {
    if (!body.default_visible) continue;
    const samples = window.bodies[body.name];
    if (!samples) continue;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(bodyRadiusUnits(body.radius_km), 32, 16),
      new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.8 }),
    );
    mesh.name = body.name;
    mesh.position.set(...eclipticKmToScene(samples.positions[0]));
    group.add(mesh);
    meshes.set(body.name, mesh);
  }

  return { group, meshes };
}
