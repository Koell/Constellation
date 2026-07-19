from datetime import datetime, timezone

import orbitarium
from fastapi.testclient import TestClient

from ephemeris import (
    GRID_COUNTS,
    SAMPLES_PER_ORBIT,
    parse_utc,
    plan_count,
    sample_times,
    sample_window,
)
from main import PERIODS, app

client = TestClient(app)

T0 = "2026-01-01T00:00:00Z"
T1 = "2026-01-02T00:00:00Z"
DAY_SECONDS = 86400.0


def test_parse_utc_accepts_z_suffix_and_naive_values():
    aware = parse_utc(T0)
    naive = parse_utc("2026-01-01T00:00:00")
    assert aware == naive == datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_sample_times_includes_both_window_edges():
    times = sample_times(parse_utc(T0), parse_utc(T1), count=5)
    assert len(times) == 5
    assert times[0] == parse_utc(T0)
    assert times[-1] == parse_utc(T1)


def test_plan_count_scales_with_orbital_period():
    # Neptune barely moves in a day: minimal 2-point grid.
    assert plan_count(DAY_SECONDS, 60189.0) == 2
    # Aegaeon (0.81 d) needs ~40 intervals for a 1-day window: snaps up to 65.
    assert plan_count(DAY_SECONDS, 0.8078910632640225) == 65
    # Luna (27.3 d) needs ~1.2 intervals: snaps to the 3-point grid.
    assert plan_count(DAY_SECONDS, 27.321661) == 3


def test_plan_count_respects_floor_and_ceiling():
    assert plan_count(DAY_SECONDS, 1e9) == GRID_COUNTS[0]  # floor: 2 points
    assert plan_count(DAY_SECONDS * 365, 0.3) == GRID_COUNTS[-1]  # ceiling: 65
    assert plan_count(0.0, 1.0) == 1  # degenerate window: single sample


def test_plan_counts_are_nesting_grids():
    for period in (0.3, 1.0, 27.3, 365.25, 60189.0):
        assert plan_count(DAY_SECONDS, period) in GRID_COUNTS


def test_samples_equal_direct_orbitarium_output():
    window = sample_window(parse_utc(T0), parse_utc(T1), PERIODS)

    direct = orbitarium.Orbitarium().get_positions(T0)
    earth = direct["sol"]["orbitals"]["earth"]
    luna = earth["orbitals"]["luna"]

    assert window["bodies"]["earth"]["parent"] == "sol"
    assert window["bodies"]["earth"]["positions"][0] == [
        earth["x"], earth["y"], earth["z"],
    ]
    assert window["bodies"]["luna"]["parent"] == "earth"
    assert window["bodies"]["luna"]["positions"][0] == [
        luna["x"], luna["y"], luna["z"],
    ]


def test_fast_moons_sample_denser_than_planets():
    window = sample_window(parse_utc(T0), parse_utc(T1), PERIODS)
    bodies = window["bodies"]
    assert len(bodies) == 76
    assert len(bodies["neptune"]["times"]) == 2
    assert len(bodies["aegaeon"]["times"]) == 65
    for entry in bodies.values():
        assert len(entry["positions"]) == len(entry["times"])
        # every body's grid covers the full window
        assert entry["times"][0] == int(parse_utc(T0).timestamp() * 1000)
        assert entry["times"][-1] == int(parse_utc(T1).timestamp() * 1000)


def test_sparse_grids_nest_inside_dense_grids():
    window = sample_window(parse_utc(T0), parse_utc(T1), PERIODS)
    dense = window["bodies"]["aegaeon"]["times"]
    for entry in window["bodies"].values():
        assert set(entry["times"]) <= set(dense)


def test_degenerate_window_returns_single_sample():
    window = sample_window(parse_utc(T0), parse_utc(T0), PERIODS)
    for entry in window["bodies"].values():
        assert entry["times"] == [int(parse_utc(T0).timestamp() * 1000)]
        assert len(entry["positions"]) == 1


def test_endpoint_contract():
    response = client.get("/api/trajectories", params={"start": T0, "end": T1})
    assert response.status_code == 200
    payload = response.json()
    mars = payload["bodies"]["mars"]
    assert mars["parent"] == "sol"
    assert len(mars["positions"]) == len(mars["times"]) >= 2


def test_endpoint_rejects_invalid_timestamps_and_reversed_windows():
    bad = client.get("/api/trajectories", params={"start": "yesterday", "end": T1})
    assert bad.status_code == 400
    reversed_window = client.get(
        "/api/trajectories", params={"start": T1, "end": T0}
    )
    assert reversed_window.status_code == 400
    assert "precedes" in reversed_window.json()["detail"]


def test_samples_per_orbit_meets_target_density():
    # Contract behind smooth interpolation: intervals per orbit >= target
    # (unless capped by the ceiling grid).
    window_s = DAY_SECONDS
    for period in (2.0, 10.0, 100.0):
        count = plan_count(window_s, period)
        if count < GRID_COUNTS[-1]:
            intervals = count - 1
            orbits = window_s / (period * 86400.0)
            assert intervals >= orbits * SAMPLES_PER_ORBIT
