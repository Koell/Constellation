"""Constellation backend — FastAPI app wrapping the orbitarium ephemeris."""

from importlib.metadata import version

from fastapi import FastAPI, HTTPException, Query

from catalog import load_catalog
from ephemeris import parse_utc, sample_window

app = FastAPI(title="Constellation API")

# Validates bodies.json against orbitarium's catalog; a mismatch aborts startup.
CATALOG = load_catalog()


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
def trajectories(
    start: str,
    end: str,
    steps: int = Query(default=2, ge=2, le=64),
) -> dict:
    try:
        start_dt = parse_utc(start)
        end_dt = parse_utc(end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"invalid timestamp: {exc}") from exc
    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="window end precedes start")
    return sample_window(start_dt, end_dt, steps)
