import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { formatBackendStatus, type HealthPayload } from "./backendStatus";
import { fetchCatalog } from "./catalog";
import { renderBodyTree } from "./bodyTree";
import { buildSolarSystem, type TrajectoryWindow } from "./scene";
import { getJson } from "./http";

const container = document.getElementById("app")!;
const statusEl = document.getElementById("status")!;
const panelBody = document.getElementById("panel-body")!;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100_000,
);
camera.position.set(0, 2200, 4200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const sunlight = new THREE.PointLight(0xffffff, 4, 0, 0);
sunlight.position.set(0, 0, 0);
scene.add(sunlight);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

async function fetchSnapshot(when: Date): Promise<TrajectoryWindow> {
  const iso = encodeURIComponent(when.toISOString());
  return getJson<TrajectoryWindow>(`/api/trajectories?start=${iso}&end=${iso}`);
}

async function boot() {
  const [catalog, snapshot] = await Promise.all([
    fetchCatalog(),
    fetchSnapshot(new Date()),
  ]);
  panelBody.replaceChildren(renderBodyTree(catalog));

  const system = buildSolarSystem(catalog, snapshot);
  scene.add(system.group);

  const earth = system.meshes.get("earth");
  if (earth) {
    console.log(
      `earth scene position (units): ${earth.position.toArray().map((v) => v.toFixed(2))}`,
    );
  }
}

boot().catch((err: unknown) => {
  panelBody.textContent = `failed to load solar system (${String(err)})`;
});

getJson<HealthPayload>("/api/health")
  .then((payload) => {
    statusEl.textContent = formatBackendStatus(payload);
  })
  .catch((err: unknown) => {
    statusEl.textContent = `backend unreachable (${String(err)})`;
  });
