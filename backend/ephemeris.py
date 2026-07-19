"""Trajectory sampling on top of orbitarium.

Samples parent-centric state over a time window with a per-body adaptive
sample count: fast moons get dense coverage, slow planets get sparse points.
Counts are always 2^k + 1, so every body's evenly spaced times nest inside
the densest body's grid — orbitarium is evaluated once per unique time
(at most 65 evaluations per request) regardless of body count.

Positions pass through exactly as orbitarium emits them: km, ecliptic-J2000
axes, planets heliocentric and moons planet-centric. Times are Unix epoch
milliseconds (UTC) for direct consumption by the JS frontend.
"""

from datetime import datetime, timedelta, timezone

import orbitarium

_orbitarium = orbitarium.Orbitarium()

# Fixed reference epoch for orbit-line geometry. Orbits precess negligibly
# over a viewing session, so a single epoch yields stable closed loops.
ORBIT_EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)

# Valid per-body sample counts: 2^k + 1 grids nest (each is a subset of the
# next), plus the minimal 2-point window. 65 is the density ceiling.
GRID_COUNTS = (2, 3, 5, 9, 17, 33, 65)

# Target sampling density: at least this many intervals per full orbit.
SAMPLES_PER_ORBIT = 32


def parse_utc(value: str) -> datetime:
    """Parse an ISO-8601 timestamp; naive values are interpreted as UTC."""
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def plan_count(window_seconds: float, period_days: float) -> int:
    """Sample count for one body: enough intervals for SAMPLES_PER_ORBIT per
    orbit across the window, snapped up to the nearest nesting grid, capped."""
    if window_seconds <= 0:
        return 1
    desired_intervals = window_seconds / (period_days * 86400.0) * SAMPLES_PER_ORBIT
    for count in GRID_COUNTS:
        if count - 1 >= desired_intervals:
            return count
    return GRID_COUNTS[-1]


def sample_times(start: datetime, end: datetime, count: int) -> list[datetime]:
    """Evenly spaced times covering [start, end], both endpoints included."""
    if count == 1 or start == end:
        return [start]
    span = (end - start) / (count - 1)
    return [start + span * i for i in range(count)]


def _flatten(tree: dict) -> dict:
    """{body: (parent, [x, y, z])} for every orbiting body in a positions tree."""
    flat: dict = {}

    def walk(node: dict, parent: str) -> None:
        for name, state in node["orbitals"].items():
            flat[name] = (parent, [state["x"], state["y"], state["z"]])
            walk(state, name)

    walk(tree["sol"], "sol")
    return flat


def sample_window(start: datetime, end: datetime, periods: dict) -> dict:
    """Adaptive parent-centric samples per body over [start, end].

    periods maps body name -> orbital period in days for every orbiting body.
    Returns {"bodies": {name: {"parent": str, "times": [epoch_ms, ...],
    "positions": [[x, y, z], ...]}}} with per-body time grids.
    """
    if end < start:
        raise ValueError("window end precedes start")

    window_seconds = (end - start).total_seconds()
    counts = {name: plan_count(window_seconds, period) for name, period in periods.items()}
    dense = max(counts.values())
    dense_times = sample_times(start, end, dense)
    dense_ms = [int(t.timestamp() * 1000) for t in dense_times]
    flat_by_time = [_flatten(_orbitarium.get_positions(t)) for t in dense_times]

    bodies: dict = {}
    for name, count in counts.items():
        if count == 1 or dense == 1:
            indices = [0]
        else:
            stride = (dense - 1) // (count - 1)
            indices = list(range(0, dense, stride))
        bodies[name] = {
            "parent": flat_by_time[0][name][0],
            "times": [dense_ms[i] for i in indices],
            "positions": [flat_by_time[i][name][1] for i in indices],
        }

    return {"bodies": bodies}


def orbit_loops(
    periods: dict,
    epoch: datetime = ORBIT_EPOCH,
    points: int = 64,
) -> dict:
    """Closed parent-centric orbit loops, one full period per body.

    periods maps body name -> orbital period in days. Returns {name:
    {"parent": str, "points": [[x, y, z], ...]}} with `points` samples spanning
    [epoch, epoch + period) (the loop closes back to the first point, so the
    endpoint is intentionally excluded).
    """
    loops: dict = {}
    for name, period in periods.items():
        step = timedelta(days=period) / points
        parent = None
        pts: list = []
        for i in range(points):
            flat = _flatten(_orbitarium.get_positions(epoch + step * i))
            parent, xyz = flat[name]
            pts.append(xyz)
        loops[name] = {"parent": parent, "points": pts}
    return loops
