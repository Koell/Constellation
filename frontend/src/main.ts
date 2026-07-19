import * as THREE from "three";
import { formatBackendStatus, type HealthPayload } from "./backendStatus";
import { fetchCatalog } from "./catalog";
import { renderBodyTree } from "./bodyTree";

const container = document.getElementById("app")!;
const statusEl = document.getElementById("status")!;
const panelBody = document.getElementById("panel-body")!;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 24),
  new THREE.MeshStandardMaterial({ color: 0x3d7dd8, roughness: 0.7 }),
);
scene.add(sphere);

const sun = new THREE.PointLight(0xffffff, 30);
sun.position.set(5, 3, 5);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.08));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  sphere.rotation.y += 0.003;
  renderer.render(scene, camera);
});

fetch("/api/health")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<HealthPayload>;
  })
  .then((payload) => {
    statusEl.textContent = formatBackendStatus(payload);
  })
  .catch((err: unknown) => {
    statusEl.textContent = `backend unreachable (${String(err)})`;
  });

fetchCatalog()
  .then((root) => {
    panelBody.replaceChildren(renderBodyTree(root));
  })
  .catch((err: unknown) => {
    panelBody.textContent = `catalog unavailable (${String(err)})`;
  });
