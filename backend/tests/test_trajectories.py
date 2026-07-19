from datetime import datetime, timezone

import orbitarium
from fastapi.testclient import TestClient

from ephemeris import parse_utc, sample_times, sample_window
from main import app

client = TestClient(app)

T0 = "2026-01-01T00:00:00Z"
T1 = "2026-01-02T00:00:00Z"


def test_parse_utc_accepts_z_suffix_and_naive_values():
    aware = parse_utc(T0)
    naive = parse_utc("2026-01-01T00:00:00")
    assert aware == naive == datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_sample_times_includes_both_window_edges():
    times = sample_times(parse_utc(T0), parse_utc(T1), steps=5)
    assert len(times) == 5
    assert times[0] == parse_utc(T0)
    assert times[-1] == parse_utc(T1)


def test_samples_equal_direct_orbitarium_output():
    window = sample_window(parse_utc(T0), parse_utc(T1), steps=2)

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


def test_window_covers_all_orbiting_bodies_with_one_position_per_time():
    window = sample_window(parse_utc(T0), parse_utc(T1), steps=3)
    assert len(window["bodies"]) == 76
    assert len(window["times"]) == 3
    for entry in window["bodies"].values():
        assert len(entry["positions"]) == 3


def test_degenerate_window_returns_single_sample():
    window = sample_window(parse_utc(T0), parse_utc(T0), steps=2)
    assert len(window["times"]) == 1
    assert window["times"][0] == int(parse_utc(T0).timestamp() * 1000)


def test_endpoint_contract():
    response = client.get(
        "/api/trajectories", params={"start": T0, "end": T1, "steps": 4}
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["times"]) == 4
    assert payload["bodies"]["mars"]["parent"] == "sol"
    assert len(payload["bodies"]["mars"]["positions"]) == 4


def test_endpoint_rejects_invalid_timestamps_and_reversed_windows():
    bad = client.get("/api/trajectories", params={"start": "yesterday", "end": T1})
    assert bad.status_code == 400
    reversed_window = client.get(
        "/api/trajectories", params={"start": T1, "end": T0}
    )
    assert reversed_window.status_code == 400
    assert "precedes" in reversed_window.json()["detail"]


def test_endpoint_rejects_out_of_range_steps():
    assert (
        client.get(
            "/api/trajectories", params={"start": T0, "end": T1, "steps": 1}
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/trajectories", params={"start": T0, "end": T1, "steps": 65}
        ).status_code
        == 422
    )
