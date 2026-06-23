# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kanban PM is a small project-management web app: a single Kanban board with drag-and-drop, a fake login, SQLite persistence, and an AI chat sidebar that can edit the board. Everything runs in one Docker container: the Next.js frontend is statically exported to `frontend/out`, then served by a Python FastAPI backend at `/`, with JSON API under `/api/*`.

## Commands

### Run the app (Docker, single container)

From the repo root, with a `.env` containing `OPENROUTER_API_KEY`:

- Windows: `.\scripts\start.ps1`
- Mac/Linux: `./scripts/start.sh`

Stop with `.\scripts\stop.ps1` / `./scripts/stop.sh`. App is at http://localhost:8000, login `user` / `password`.

### Backend tests

The backend is intended to run inside the container. With the image already built (`kanban-pm`):

```bash
docker run --rm -v "<abs-path>/backend:/app" -e UV_PROJECT_ENVIRONMENT=/opt/venv -w /app kanban-pm sh -c "uv run --dev pytest -q"
```

Or, with a local `uv` env available, from `backend/`: `uv run --dev pytest`.

### Frontend tests (from `frontend/`)

```bash
npm install
npm run lint           # eslint
npm run test:unit      # vitest run (src/**/*.{test,spec}.{ts,tsx})
npm run test:unit:watch
npm run test:e2e       # playwright (auto-starts `next dev` on 127.0.0.1:3000)
npm run test:all       # unit then e2e
npm run build          # static export to frontend/out
```

To run a single unit test: `npx vitest run src/lib/kanban.test.ts` (or any path glob).

## Architecture

Two-source repo, one Docker image, three layers:

```
backend/  FastAPI app, SQLite access, OpenRouter client, tests   (Python 3.12+, uv)
frontend/ Next.js 16 app, statically exported to frontend/out    (React 19, TS, Tailwind v4)
scripts/  start/stop wrappers for docker build + run
docs/     PLAN.md, DATABASE.md, AI.md  (design + decisions)
Dockerfile  multi-stage: builds frontend/out, then assembles the Python image
```

The Dockerfile builds `frontend/out` first (node:22-slim stage) and copies it into the Python image; FastAPI mounts the result as `StaticFiles` at `/`. The same image is what the start scripts run, so a frontend change requires a rebuild (`docker build`) to take effect.

### Backend (`backend/app/`)

- `main.py` - FastAPI app and route definitions. Order matters: API routes are registered before the `StaticFiles` mount at `/` so the API wins. Auth is a signed-cookie session via Starlette `SessionMiddleware` (secret from `SESSION_SECRET`, dev default if unset). `require_user` is a `Depends` that 401s anonymous requests and is applied to the board and AI routes. `lifespan` calls `init_db()` on startup.
- `models.py` - Pydantic `Card` / `Column` / `Board` matching the frontend `BoardData` shape. `Board` is what `PUT /api/board` validates against (FastAPI returns 422 on failure).
- `db.py` - stdlib `sqlite3` access. `init_db()` creates the schema and seeds the demo user + default board if absent. `get_board` / `save_board` read/write the per-user board JSON blob. DB path from `DB_PATH` env. The container runs with `--rm` and no volume, so the DB is ephemeral across container removals.
- `seed.py` - `DEFAULT_BOARD`, the 5-column / 8-card seed mirroring the frontend demo.
- `ai.py` - OpenRouter client (OpenAI SDK, base URL `https://openrouter.ai/api/v1`, model `openai/gpt-oss-120b`, override with `OPENROUTER_MODEL`). `ask()` powers `POST /api/ai/ping`; `chat()` powers `POST /api/ai/chat` and uses `client.chat.completions.parse` with a strict Pydantic schema (`ChatResult { reply, board_update? }`). The AI-facing `AiBoard` uses `cards` as a list because strict `json_schema` disallows arbitrary-key maps; `board_to_ai_board` / `ai_board_to_board` convert to/from the internal cards-map `Board`. Any client/API error is re-raised as a 502 in `main.py` with the upstream message in `detail`.

### Frontend (`frontend/src/`)

- `app/` - Next.js App Router. `layout.tsx` loads Space Grotesk (display) and Manrope (body) via `next/font`. `page.tsx` renders `<App />`. Color scheme is CSS variables in `globals.css` (`--accent-yellow #ecad0a`, `--primary-blue #209dd7`, `--secondary-purple #753991`, `--navy-dark #032147`, `--gray-text #888888`).
- `lib/kanban.ts` - data model and pure board logic. `BoardData = { columns: Column[]; cards: Record<string, Card> }`. `moveCard(columns, activeId, overId)` is a pure reducer for drag/drop and the core logic exercised by unit tests. `initialData` is a seed fixture used only by tests/reference; the running app loads from `/api/board`.
- `lib/board.ts` - `loadBoard()` / `saveBoard()` against the backend; `KanbanBoard` debounces the whole-board `PUT` by 400ms and clears the timer on unmount.
- `lib/auth.ts`, `lib/chat.ts` - `getSession`/`login`/`logout` and the `/api/ai/chat` POST wrapper.
- `components/KanbanBoard.tsx` - top-level client component. Owns the board, drag/rename/add/delete handlers (each persists via debounced `PUT`), and renders the header, 5-column grid, `DragOverlay`, and `ChatSidebar`. When the AI chat returns a `board`, the sidebar's `onBoardUpdate={setBoard}` refreshes the UI directly (the AI endpoint has already persisted).
- `components/ChatSidebar.tsx` - floating AI panel, posts to `/api/ai/chat`, calls `onBoardUpdate` on board updates.
- `components/KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanCardPreview.tsx`, `NewCardForm.tsx` - presentational; `KanbanColumn`/`KanbanCard` expose `data-testid="column-<id>"` / `data-testid="card-<id>"` for e2e selectors.

State flows top-down from `KanbanBoard`; mutations happen there via callbacks to children.

### Key data flow

1. `GET /api/board` returns the user's board JSON (auto-seeded on first request).
2. The frontend mutates locally and `PUT /api/board` (debounced 400ms) replaces the whole board.
3. `POST /api/ai/chat` attaches the current board as a system message, the model returns structured `ChatResult`, and on `board_update` the server converts and persists; the client refreshes the board from the response.

## Standards and conventions (from AGENTS.md)

- Latest idiomatic library versions; keep it simple - no over-engineering, no defensive programming, no extras.
- Concise docs, no emojis in code or commits.
- Root-cause before fixing: prove with evidence, then fix the root cause - never guess.
- Tests: write valuable tests on core logic, integration points, and regressions. Aim for ~80% coverage only when sensible; do not add tests purely to hit a number.

## Environment

- `OPENROUTER_API_KEY` (required for AI; the board works without it but `/api/ai/*` returns 502).
- `OPENROUTER_MODEL` (optional, default `openai/gpt-oss-120b`).
- `SESSION_SECRET` (optional, dev default in code).
- `DB_PATH` (optional, default `backend/data/kanban.db` locally, `/app/data/kanban.db` in container).
- `STATIC_DIR` (optional, default `backend/static` - in production the Dockerfile populates it from `frontend/out`).
- `PORT` (start scripts only, default `8000`).

## Working docs

- `docs/PLAN.md` - 10-part build plan with decisions and per-part checklists.
- `docs/DATABASE.md` - SQLite schema and the JSON-blob storage approach.
- `docs/AI.md` - OpenRouter integration, structured-output schema, live verification notes.
- `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md` - component overviews.
