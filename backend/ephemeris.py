"""Trajectory sampling on top of orbitarium.

Samples parent-centric state over a time window. Positions pass through
exactly as orbitarium emits them: km, ecliptic-J2000 axes, planets
heliocentric and moons planet-centric. Times are reported as Unix epoch
milliseconds (UTC) for direct consumption by the JS frontend.
"""

from datetime import datetime, timezone

import orbitarium

_orbitarium = orbitarium.Orbitarium()


def parse_utc(value: str) -> datetime:
    """Parse an ISO-8601 timestamp; naive values are interpreted as UTC."""
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def sample_times(start: datetime, end: datetime, steps: int) -> list[datetime]:
    """Evenly spaced times covering [start, end], both endpoints included."""
    if start == end:
        return [start]
    span = (end - start) / (steps - 1)
    return [start + span * i for i in range(steps)]


def sample_window(start: datetime, end: datetime, steps: int) -> dict:
    """Parent-centric position samples per body at evenly spaced times.

    Returns {"times": [epoch_ms, ...], "bodies": {name: {"parent": str,
    "positions": [[x, y, z], ...]}}} with one position per time.
    """
    if end < start:
        raise ValueError("window end precedes start")

    times = sample_times(start, end, steps)
    bodies: dict = {}

    for when in times:
        tree = _orbitarium.get_positions(when)

        def walk(node: dict, parent: str) -> None:
            for name, state in node["orbitals"].items():
                entry = bodies.setdefault(name, {"parent": parent, "positions": []})
                entry["positions"].append([state["x"], state["y"], state["z"]])
                walk(state, name)

        walk(tree["sol"], "sol")

    return {
        "times": [int(t.timestamp() * 1000) for t in times],
        "bodies": bodies,
    }
