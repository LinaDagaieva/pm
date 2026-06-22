# Backend

FastAPI backend for the Kanban PM MVP. Serves the JSON API under `/api/*` and the static frontend at `/`. Packaged into a single Docker container managed with `uv`.

## Stack

- Python 3.12+, FastAPI, uvicorn
- `uv` for dependency management (`pyproject.toml`, non-package project)
- Tests: pytest + httpx (`TestClient`)

## Layout

- `app/main.py` - FastAPI app. Routes: `GET /api/health`; auth via `POST /api/login`, `POST /api/logout`, `GET /api/session`. Mounts `StaticFiles` at `/` (after the API routes) to serve the static site; directory from `STATIC_DIR` env, default `backend/static`.
- Auth: hardcoded `user`/`password`; session stored in a signed cookie via Starlette `SessionMiddleware` (secret from `SESSION_SECRET`, dev default). `GET /api/session` returns `{authenticated, user}`.
- `static/` - placeholder hello-world page (Part 2). Replaced by the built frontend export in Part 3.
- `tests/` - pytest suite.

## Run

Built and run via Docker using the repo-root `Dockerfile` and `scripts/start.*` / `scripts/stop.*`. The container listens on `8000`.

Tests (inside the container or a uv env):

```bash
uv run --dev pytest
```

## Notes for later parts

- Auth (Part 4), SQLite board storage (Part 5/6), and OpenRouter AI calls (Part 8+) are added here.
- The `/` mount currently serves a placeholder; SPA fallback for client routes is added when the real frontend lands.
