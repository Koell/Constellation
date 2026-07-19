"""Constellation backend — FastAPI app wrapping the orbitarium ephemeris."""

from importlib.metadata import version

from fastapi import FastAPI, HTTPException

from catalog import load_catalog, load_metadata
from ephemeris import orbit_loops, parse_utc, sample_window

app = FastAPI(title="Constellation API")

# Validates bodies.json against orbitarium's catalog; a mismatch aborts startup.
CATALOG = load_catalog()

# Orbital periods (days) per orbiting body, driving adaptive sample counts.
PERIODS = {
    name: entry["orbital_period_days"]
    for name, entry in load_metadata().items()
    if entry["orbital_period_days"] is not None
}


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "orbitarium_version": version("orbitarium"),
    }


@app.get("/api/catalog")
def catalog() -> dict:
    return CATALOG


@app.get("/api/trajectories")
def trajectories(start: str, end: str) -> dict:
    try:
        start_dt = parse_utc(start)
        end_dt = parse_utc(end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"invalid timestamp: {exc}") from exc
    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="window end precedes start")
    return sample_window(start_dt, end_dt, PERIODS)


@app.get("/api/orbits")
def orbits(bodies: str | None = None) -> dict:
    """Closed orbit loops. `bodies` is an optional comma-separated subset;
    omitted returns every orbiting body (slower)."""
    if bodies is None:
        selected = PERIODS
    else:
        names = [n for n in bodies.split(",") if n]
        unknown = [n for n in names if n not in PERIODS]
        if unknown:
            raise HTTPException(status_code=400, detail=f"unknown bodies: {unknown}")
        selected = {n: PERIODS[n] for n in names}
    return {"bodies": orbit_loops(selected)}
