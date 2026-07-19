import * as THREE from "three";
import type { CatalogBody } from "./catalog";
import { bodyRadiusUnits } from "./scaling";

export interface SolarSystem {
  group: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
  parents: Map<string, string>;
  bodies: Map<string, CatalogBody>;
}

/**
 * Builds meshes for every catalog body. Visibility starts at each body's
 * default_visible flag (all planets on, minor moons off). Positions are
 * driven per-frame from the trajectory store; meshes start at the origin.
 */
export function buildSolarSystem(catalog: CatalogBody): SolarSystem {
  const group = new THREE.Group();
  const meshes = new Map<string, THREE.Mesh>();
  const parents = new Map<string, string>();
  const bodies = new Map<string, CatalogBody>();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadiusUnits(catalog.radius_km, true), 48, 24),
    new THREE.MeshBasicMaterial({ color: catalog.color }),
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
          isMoon ? 16 : 32,
          isMoon ? 8 : 16,
        ),
        new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.8 }),
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
