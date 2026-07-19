import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { formatBackendStatus, type HealthPayload } from "./backendStatus";
import { fetchCatalog, type CatalogBody } from "./catalog";
import { flattenCatalog, renderBodyTree } from "./bodyTree";
import { buildSolarSystem, buildStarfield } from "./scene";
import {
  bodyRadiusUnits,
  eclipticKmToScene,
  moonOrbitBoost,
  moonWorldPosition,
  type Vec3,
} from "./scaling";
import { SimClock } from "./simClock";
import { TrajectoryStore, type TrajectoryPayload } from "./trajectoryStore";
import { getJson } from "./http";

const container = document.getElementById("app")!;
const statusEl = document.getElementById("status")!;
const panelBody = document.getElementById("panel-body")!;
const directionBtn = document.getElementById("direction") as HTMLButtonElement;
const playPauseBtn = document.getElementById("play-pause") as HTMLButtonElement;
const speedSelect = document.getElementById("speed") as HTMLSelectElement;
const scrubInput = document.getElementById("scrub") as HTMLInputElement;
const dateJumpInput = document.getElementById("date-jump") as HTMLInputElement;
const nowBtn = document.getElementById("now-btn") as HTMLButtonElement;
const simDateEl = document.getElementById("sim-date")!;
const creditsBtn = document.getElementById("credits-btn") as HTMLButtonElement;
const credits = document.getElementById("credits")!;
const creditsClose = document.getElementById("credits-close") as HTMLButtonElement;

creditsBtn.addEventListener("click", () => credits.classList.add("open"));
creditsClose.addEventListener("click", () => credits.classList.remove("open"));
credits.addEventListener("click", (e) => {
  if (e.target === credits) credits.classList.remove("open");
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100_000,
);
camera.position.set(0, 150, 380);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Sunlight from the origin, no distance falloff (decay 0) so far planets
// stay lit; low ambient keeps night sides faintly visible.
const sunlight = new THREE.PointLight(0xffffff, 3, 0, 0);
sunlight.position.set(0, 0, 0);
scene.add(sunlight);
scene.add(new THREE.AmbientLight(0xffffff, 0.12));

const starfield = buildStarfield();
starfield.visible = false; // off by default — distracting; toggle in the panel
scene.add(starfield);

const toggleStars = document.getElementById("toggle-stars") as HTMLInputElement;
toggleStars.checked = false;
toggleStars.addEventListener("change", () => {
  starfield.visible = toggleStars.checked;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- simulation time -------------------------------------------------------

const clock = new SimClock(Date.now(), Number(speedSelect.value));
let direction = 1;

const store = new TrajectoryStore((startMs, endMs) => {
  const start = encodeURIComponent(new Date(startMs).toISOString());
  const end = encodeURIComponent(new Date(endMs).toISOString());
  return getJson<TrajectoryPayload>(`/api/trajectories?start=${start}&end=${end}`);
});

function applySpeed() {
  clock.speed = direction * Number(speedSelect.value);
  directionBtn.textContent = direction > 0 ? "▶▶" : "◀◀";
}

directionBtn.addEventListener("click", () => {
  direction = -direction;
  applySpeed();
});

playPauseBtn.addEventListener("click", () => {
  clock.toggle();
  playPauseBtn.textContent = clock.isPlaying() ? "⏸" : "▶";
});

speedSelect.addEventListener("change", applySpeed);

/** Scrubber: ±1 year at full deflection, relative to where the drag began. */
const SCRUB_SPAN_MS = 365.25 * 86_400_000;
let scrubBase: number | null = null;
scrubInput.addEventListener("input", () => {
  if (scrubBase === null) scrubBase = clock.now();
  clock.jump(scrubBase + (scrubInput.valueAsNumber / 1000) * SCRUB_SPAN_MS);
});
scrubInput.addEventListener("change", () => {
  scrubBase = null;
  scrubInput.value = "0";
});

dateJumpInput.addEventListener("change", () => {
  // datetime-local is timezone-less; the app displays UTC, so read it as UTC.
  if (!Number.isNaN(dateJumpInput.valueAsNumber)) {
    clock.jump(dateJumpInput.valueAsNumber);
  }
});

nowBtn.addEventListener("click", () => {
  clock.jump(Date.now());
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// --- boot ------------------------------------------------------------------

/** Per-planet moon-orbit boost, from the innermost moon's current distance. */
function computeBoosts(
  catalog: CatalogBody,
  positionAt: (name: string, t: number) => Vec3 | null,
  simMs: number,
): Map<string, number> {
  const boosts = new Map<string, number>();
  for (const planet of catalog.orbitals) {
    let innermostKm = Infinity;
    for (const moon of planet.orbitals) {
      const p = positionAt(moon.name, simMs);
      if (p) innermostKm = Math.min(innermostKm, Math.hypot(p[0], p[1], p[2]));
    }
    if (innermostKm < Infinity) {
      boosts.set(
        planet.name,
        moonOrbitBoost(bodyRadiusUnits(planet.radius_km), innermostKm),
      );
    }
  }
  return boosts;
}

async function boot() {
  const [catalog] = await Promise.all([
    fetchCatalog(),
    store.ensure(clock.now(), clock.speed),
  ]);

  const system = buildSolarSystem(catalog);
  scene.add(system.group);

  panelBody.replaceChildren(
    renderBodyTree(catalog, {
      isVisible: (name) => system.meshes.get(name)?.visible ?? false,
      onToggle: (names, visible) => {
        for (const name of names) {
          const mesh = system.meshes.get(name);
          if (mesh) mesh.visible = visible;
        }
      },
    }),
  );

  const boosts = computeBoosts(
    catalog,
    (name, t) => store.getPositionAt(name, t),
    clock.now(),
  );

  // Parents before children, so moon composition reads settled positions.
  const updateOrder = flattenCatalog(catalog)
    .filter((b) => b.name !== "sol")
    .map((b) => b.name);

  let lastReal: number | null = null;
  renderer.setAnimationLoop((t) => {
    const delta = lastReal === null ? 0 : t - lastReal;
    lastReal = t;

    clock.tick(delta);
    const simMs = clock.now();
    store.update(simMs, clock.speed);

    for (const name of updateOrder) {
      const mesh = system.meshes.get(name)!;
      const parent = system.parents.get(name)!;
      if (!mesh.visible) continue;
      const local = store.getPositionAt(name, simMs);
      if (!local) continue;
      if (parent === "sol") {
        mesh.position.set(...eclipticKmToScene(local));
      } else {
        const parentMesh = system.meshes.get(parent)!;
        mesh.position.set(
          ...moonWorldPosition(
            parentMesh.position.toArray() as Vec3,
            local,
            boosts.get(parent) ?? 1,
          ),
        );
      }
    }

    starfield.position.copy(camera.position);
    simDateEl.textContent = `${dateFormat.format(simMs)} UTC`;
    controls.update();
    renderer.render(scene, camera);
  });
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
