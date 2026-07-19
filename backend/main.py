"""Constellation backend — FastAPI app wrapping the orbitarium ephemeris."""

from importlib.metadata import version

from fastapi import FastAPI

from catalog import load_catalog

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
