"""Constellation backend — FastAPI app wrapping the orbitarium ephemeris."""

from importlib.metadata import version

from fastapi import FastAPI

app = FastAPI(title="Constellation API")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "orbitarium_version": version("orbitarium"),
    }
