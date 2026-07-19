import math

import orbitarium
import pytest
from fastapi.testclient import TestClient

from catalog import (
    build_catalog,
    load_metadata,
    orbitarium_body_names,
    validate_metadata,
)
from main import app

client = TestClient(app)

TREE = orbitarium.Orbitarium().celestial_data
METADATA = load_metadata()


def test_metadata_matches_orbitarium_catalog_exactly():
    validate_metadata(METADATA, TREE)  # raises on drift
    assert len(METADATA) == 77  # 76 orbiting bodies + the Sun


def test_metadata_entries_carry_required_fields():
    # load_metadata validates field presence and types; a sanity probe on one entry
    earth = METADATA["earth"]
    assert earth["display_name"] == "Earth"
    assert earth["default_visible"] is True
    assert earth["texture"] is not None


def test_validation_fails_loudly_on_missing_body():
    broken = dict(METADATA)
    del broken["io"]
    with pytest.raises(ValueError, match="io"):
        validate_metadata(broken, TREE)


def test_validation_fails_loudly_on_extra_body():
    extended = dict(METADATA)
    extended["vulcan"] = METADATA["mercury"]
    with pytest.raises(ValueError, match="vulcan"):
        validate_metadata(extended, TREE)


@pytest.mark.parametrize(
    ("body", "period_days"),
    [
        ("earth", 365.256),
        ("luna", 27.32),
        ("io", 1.769),
        ("titan", 15.945),
        ("charon", 6.387),
        ("neptune", 60189.0),
    ],
)
def test_orbital_periods_are_plausible(body, period_days):
    assert math.isclose(
        METADATA[body]["orbital_period_days"], period_days, rel_tol=0.01
    )


@pytest.mark.parametrize(
    ("body", "radius_km"),
    [("sol", 695700.0), ("earth", 6371.0), ("ganymede", 2634.1)],
)
def test_radii_are_plausible(body, radius_km):
    assert METADATA[body]["radius_km"] == pytest.approx(radius_km, rel=0.01)


def test_catalog_endpoint_returns_nested_tree_with_metadata():
    response = client.get("/api/catalog")
    assert response.status_code == 200
    root = response.json()

    assert root["name"] == "sol"
    assert root["display_name"] == "Sun"
    assert root["radius_km"] == 695700.0

    earth = next(b for b in root["orbitals"] if b["name"] == "earth")
    luna = next(b for b in earth["orbitals"] if b["name"] == "luna")
    assert luna["display_name"] == "Luna"
    assert luna["orbitals"] == []

    def count(node):
        return 1 + sum(count(child) for child in node["orbitals"])

    assert count(root) == 77


def test_catalog_tree_mirrors_orbitarium_nesting():
    catalog = build_catalog(METADATA, TREE)
    assert orbitarium_body_names(TREE) == {
        name
        for name in METADATA
    }
    saturn = next(b for b in catalog["orbitals"] if b["name"] == "saturn")
    assert {m["name"] for m in saturn["orbitals"]} >= {"titan", "mimas", "aegaeon"}
