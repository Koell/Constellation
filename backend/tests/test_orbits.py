import math

import orbitarium
from fastapi.testclient import TestClient

from ephemeris import ORBIT_EPOCH, orbit_loops
from main import PERIODS, app

client = TestClient(app)


def test_orbit_loop_has_requested_point_count_and_parent():
    loops = orbit_loops({"earth": PERIODS["earth"]}, points=32)
    earth = loops["earth"]
    assert earth["parent"] == "sol"
    assert len(earth["points"]) == 32
    assert all(len(p) == 3 for p in earth["points"])


def test_first_point_matches_orbitarium_at_epoch():
    loops = orbit_loops({"mars": PERIODS["mars"]}, points=16)
    direct = orbitarium.Orbitarium().get_positions(ORBIT_EPOCH)
    mars = direct["sol"]["orbitals"]["mars"]
    assert loops["mars"]["points"][0] == [mars["x"], mars["y"], mars["z"]]


def test_loop_spans_a_full_orbit_radius_roughly_constant():
    # Earth's orbit is near-circular: every loop point sits ~1 AU from the Sun.
    loops = orbit_loops({"earth": PERIODS["earth"]}, points=48)
    radii = [math.dist(p, [0, 0, 0]) for p in loops["earth"]["points"]]
    assert min(radii) > 1.4e8 and max(radii) < 1.6e8


def test_eccentric_orbit_shows_varying_distance():
    # Mercury (e~0.206): perihelion vs aphelion differ markedly.
    loops = orbit_loops({"mercury": PERIODS["mercury"]}, points=48)
    radii = [math.dist(p, [0, 0, 0]) for p in loops["mercury"]["points"]]
    assert max(radii) / min(radii) > 1.4


def test_moon_loop_is_parent_centric():
    loops = orbit_loops({"luna": PERIODS["luna"]}, points=24)
    assert loops["luna"]["parent"] == "earth"
    # Luna sits ~360,000 km from Earth, not ~1 AU from the Sun.
    radii = [math.dist(p, [0, 0, 0]) for p in loops["luna"]["points"]]
    assert max(radii) < 500_000


def test_endpoint_returns_requested_subset():
    response = client.get("/api/orbits", params={"bodies": "earth,jupiter"})
    assert response.status_code == 200
    payload = response.json()
    assert set(payload["bodies"]) == {"earth", "jupiter"}
    assert payload["bodies"]["jupiter"]["parent"] == "sol"


def test_endpoint_rejects_unknown_bodies():
    response = client.get("/api/orbits", params={"bodies": "earth,vulcan"})
    assert response.status_code == 400
    assert "vulcan" in response.json()["detail"]
