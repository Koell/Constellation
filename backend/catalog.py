"""Body catalog: curated metadata merged onto orbitarium's body tree.

bodies.json is the single source of all non-ephemeris body facts (display
name, radius, color, texture, orbital period, default visibility). It must
correspond one-to-one with the bodies orbitarium exposes; any drift between
the two is a startup error, not a silent gap.
"""

import json
from pathlib import Path

import orbitarium

METADATA_PATH = Path(__file__).parent / "data" / "bodies.json"

REQUIRED_FIELDS = {
    "display_name": str,
    "type": str,
    "radius_km": (int, float),
    "color": str,
    "texture": (str, type(None)),
    "orbital_period_days": (int, float, type(None)),
    "default_visible": bool,
}


def load_metadata(path: Path = METADATA_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        metadata = json.load(f)
    for name, entry in metadata.items():
        missing = REQUIRED_FIELDS.keys() - entry.keys()
        if missing:
            raise ValueError(f"bodies.json entry '{name}' is missing fields: {sorted(missing)}")
        for field, types in REQUIRED_FIELDS.items():
            if not isinstance(entry[field], types):
                raise ValueError(
                    f"bodies.json entry '{name}' field '{field}' has invalid type "
                    f"{type(entry[field]).__name__}"
                )
    return metadata


def orbitarium_body_names(tree: dict) -> set:
    names = set()

    def walk(node: dict, name: str) -> None:
        names.add(name)
        for child in node.get("orbitals", []):
            walk(child, child["name"])

    walk(tree["sol"], "sol")
    return names


def validate_metadata(metadata: dict, tree: dict) -> None:
    expected = orbitarium_body_names(tree)
    actual = set(metadata)
    missing = expected - actual
    extra = actual - expected
    if missing or extra:
        raise ValueError(
            "bodies.json does not match orbitarium's catalog: "
            f"missing={sorted(missing)} extra={sorted(extra)}"
        )


def build_catalog(metadata: dict, tree: dict) -> dict:
    """Nested body tree mirroring orbitarium's structure, metadata merged in."""

    def build(node: dict, name: str) -> dict:
        return {
            "name": name,
            **metadata[name],
            "orbitals": [build(child, child["name"]) for child in node.get("orbitals", [])],
        }

    return build(tree["sol"], "sol")


def load_catalog() -> dict:
    """Load, validate, and build the full catalog. Raises on any drift."""
    tree = orbitarium.Orbitarium().celestial_data
    metadata = load_metadata()
    validate_metadata(metadata, tree)
    return build_catalog(metadata, tree)
