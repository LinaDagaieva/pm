# Backend

FastAPI backend for the Kanban PM MVP. Serves the JSON API under `/api/*` and the static frontend at `/`. Packaged into a single Docker container managed with `uv`.

## Stack

- Python 3.12+, FastAPI, uvicorn
- `uv` for dependency management (`pyproject.toml`, non-package project)
- Tests: pytest + httpx (`TestClient`)

## Layout

- `app/main.py` - FastAPI app. Routes: `GET /api/health`; auth via `POST /api/login`, `POST /api/logout`, `GET /api/session`; board via `GET /api/board`, `PUT /api/board`. Mounts `StaticFiles` at `/` (after the API routes); directory from `STATIC_DIR` env, default `backend/static`. A lifespan handler calls `init_db()` on startup. `require_user` dependency guards the board routes.
- `app/models.py` - Pydantic `Card`/`Column`/`Board` (the `BoardData` shape; `Board` validates board payloads).
- `app/db.py` - stdlib `sqlite3` access. `init_db()` creates tables and seeds the demo user/board; `get_board`/`save_board` read/write the per-user board JSON blob. DB path from `DB_PATH` env (default `backend/data/kanban.db`); created if missing. Schema in `docs/DATABASE.md`.
- `app/seed.py` - `DEFAULT_BOARD`, the seed board mirroring the frontend demo.
- `app/ai.py` - OpenRouter client via the `openai` SDK (`OPENROUTER_API_KEY`, base URL `https://openrouter.ai/api/v1`, model `openai/gpt-oss-120b`). `ask()` powers `POST /api/ai/ping` (connectivity). `chat()` powers `POST /api/ai/chat`: attaches the board + history and returns structured `ChatResult { reply, board_update? }` via `chat.completions.parse`. `AiBoard` (cards as list) converts to/from the internal `Board`. See `docs/AI.md`.
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
