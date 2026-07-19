# Constellation

A browser-based, animated 3D orrery of the solar system. A FastAPI backend wraps the
[orbitarium](https://pypi.org/project/orbitarium/) ephemeris library as the single source
of position truth; a Vite + TypeScript + Three.js frontend renders the scene.

Planning docs live in `.ai/prds/` (PRD) and `.ai/issues/` (implementation slices).

## Layout

```
backend/    FastAPI app (Python, uses the repo-root .venv)
frontend/   Vite + TypeScript + Three.js app
```

## Prerequisites

- Python ≥ 3.11 with the repo-root virtualenv at `.venv` (deps: `backend/requirements.txt`)
- Node.js ≥ 20.19 (tested with 24.x)

Install dependencies:

```powershell
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend; npm install
```

## Running (two dev processes)

Backend (port 8000):

```powershell
.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --port 8000 --reload
```

Frontend (port 5173, proxies `/api` to the backend):

```powershell
cd frontend
npm run dev
```

Then open http://localhost:5173 — the status line at the bottom left reports the
backend's orbitarium version when the proxy path is healthy.

## Tests

```powershell
.venv\Scripts\python.exe -m pytest backend        # backend (pytest)
cd frontend; npm test                             # frontend (vitest)
```
