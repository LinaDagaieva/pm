# Project Plan: Kanban PM MVP

Detailed, checklist-driven plan for the 10-part build. Each part has substeps, tests, and success criteria. Check off substeps as completed.

## Key decisions (defaults)

- Serving: Next.js static export (`output: "export"`) built into `frontend/out`, served by FastAPI as static files at `/`. Single process, no Next.js server. All data access goes through the FastAPI API.
- Database: SQLite. Users in a relational `users` table; each user's board persisted as a single JSON blob (matching the frontend `BoardData` shape) rather than normalized column/card tables. DB auto-created on first run if missing.
- Auth: server-set session cookie issued by FastAPI on successful login with hardcoded `user` / `password`. Logout clears the cookie.
- AI: OpenRouter (OpenAI-compatible API) via the `openai` SDK, model `openai/gpt-oss-120b` (override with `OPENROUTER_MODEL`). Structured Outputs (strict `json_schema` response_format) were live-verified as supported on this model/route in Part 8, so no JSON-mode fallback is needed. Details in `docs/AI.md`.
- Package management: `uv` for Python inside Docker. Python deps pinned via `pyproject.toml` + `uv.lock`.
- Approval gates: explicit user sign-off at Part 1 (this plan) and Part 5 (DB approach). Other parts run through, but each ends in a passing-tests checkpoint.
- Testing: write valuable tests (core logic, integration points, regressions). Aim for ~80% coverage only when sensible; do not add tests purely to hit a number. Falling short of 80% is fine.
- Standards (from AGENTS.md): latest idiomatic library versions; keep it simple, no over-engineering or unnecessary defensive code; concise/minimal docs; no emojis; root-cause before fixing.

## Implementation decisions (made during the build)

- Sessions: signed cookie via Starlette `SessionMiddleware`; secret from `SESSION_SECRET` (dev default if unset).
- DB location: `DB_PATH` env (default `backend/data/kanban.db` locally, `/app/data/kanban.db` in the container); gitignored. The container runs with `--rm` and no volume, so the SQLite DB is ephemeral - it resets when the container is removed (survives page reloads and in-container restarts, not container removal). Add a Docker volume mapping `DB_PATH` if cross-removal persistence is wanted.
- Frontend persistence: whole-board `PUT /api/board` debounced 400ms to coalesce rapid edits; debounce timer cleared on unmount (avoids a save firing after logout/unmount).
- Scripts: `.sh` for Mac/Linux and `.ps1` for Windows PowerShell; no `.cmd` variant (PowerShell covers Windows).
- E2E strategy: Playwright runs against the Next dev server with `/api/*` mocked via route handlers (stateful board mock for persistence/reload tests); real full-stack flows (login, board round-trip, AI ping) are verified via container curl checks. Chromium is launched with `--disable-gpu`/`--disable-dev-shm-usage` for headless/low-memory robustness.
- AI endpoints are auth-gated; on client/API errors they return 502 with the upstream message in `detail`.

## Repository layout (target)

```
backend/        FastAPI app, AI client, SQLite access, tests
frontend/       Next.js app (existing demo; statically exported)
scripts/        start/stop scripts for Mac, Linux, PC
docs/           planning + design docs (this file, DATABASE.md, AI.md)
Dockerfile      multi-stage: build frontend, assemble Python backend
.env            OPENROUTER_API_KEY (gitignored)
```

---

## Part 1: Plan

- [x] Enrich this document with detailed substeps, tests, and success criteria per part.
- [x] Record key technical decisions / defaults.
- [x] Create `frontend/AGENTS.md` describing the existing frontend code.
- [x] Get user review and approval of this plan. (Approved.)

Tests / success criteria: user explicitly approves the plan. `frontend/AGENTS.md` accurately reflects the current frontend (stack, data model, components, commands).

---

## Part 2: Scaffolding

Stand up Docker + FastAPI + scripts serving a hello-world static page and one API endpoint.

- [x] Create `backend/` Python project with `uv` (`pyproject.toml`, `uv.lock`), FastAPI + uvicorn.
- [x] FastAPI app: `GET /api/health` returns `{"status": "ok"}`; serve a placeholder static `index.html` at `/`.
- [x] `Dockerfile` (and `.dockerignore`) that installs deps with `uv` and runs uvicorn.
- [x] `scripts/start.*` and `scripts/stop.*` for Mac, Linux (`.sh`) and PC (`.ps1`): build and run/stop the container, map a port.
- [x] Update `backend/AGENTS.md` describing the backend.
- [x] Minimal backend test for `/api/health`.

Tests / success criteria: `docker build` succeeds; start script brings the container up; visiting `/` shows the placeholder page; `GET /api/health` returns 200 JSON; stop script tears it down cleanly. Backend test passes.

---

## Part 3: Add in Frontend

Statically build the existing Kanban demo and serve it at `/`.

- [x] Configure Next.js static export (`output: "export"`); resolve any export blockers (fonts, images). No blockers; `next/font` self-hosts at build time, no `next/image` usage.
- [x] Build step produces `frontend/out`; FastAPI serves it at `/`. Single client route, so the existing `StaticFiles(html=True)` mount is sufficient (no extra SPA fallback needed yet).
- [x] Dockerfile multi-stage: node build stage for the frontend, copy `out` into the backend image.
- [x] Keep existing frontend unit tests passing; ensure e2e still works against the dev server.
- [x] Add an integration check that the served `/` returns the Kanban HTML/assets (container curl: `/` returns the board markup and `_next` assets 200).

Tests / success criteria: container serves the real Kanban board at `/` with working drag/drop, rename, add/remove (in-memory). `npm run test:unit` and `npm run test:e2e` pass. Integration test confirms `/` serves built assets (200, expected markup).

---

## Part 4: Fake user sign-in

Gate `/` behind a login screen; support logout.

- [x] Backend: `POST /api/login` (validates `user`/`password`, sets session cookie via Starlette `SessionMiddleware`), `POST /api/logout` (clears cookie), `GET /api/session` (returns auth state).
- [x] Frontend: login screen (`Login.tsx`); `App.tsx` gate fetches `/api/session` and shows login or board; logout control in the board header.
- [x] Protect board data routes behind the session — done in Part 6: `require_user` dependency added and applied to the board routes (no board routes existed yet at Part 4).
- [x] Tests: backend unit tests for login/logout/session (valid, invalid, anonymous); frontend component test for the login gate; e2e for the full login -> board -> logout flow and invalid-credentials error (API mocked in Playwright; real flow verified against the container).

Tests / success criteria: wrong credentials rejected; correct credentials reach the board; logout returns to login; refresh preserves session via cookie. All new and existing tests pass.

---

## Part 5: Database modeling

Propose and document the schema; get sign-off.

- [x] Define schema: `users` table; per-user board stored as JSON (the `BoardData` shape: columns with `cardIds`, cards map).
- [x] Document the approach, schema, and example JSON in `docs/DATABASE.md` (tables, columns, how the board JSON is stored/validated, auto-create behavior).
- [x] Provide the seed/default board used for a new user.
- [x] Get user sign-off on `docs/DATABASE.md`. (Approved.)

Tests / success criteria: `docs/DATABASE.md` exists and is approved by the user. Schema is consistent with the frontend `BoardData` type.

---

## Part 6: Backend (board API)

Read/write the Kanban for a user; auto-create DB.

- [x] SQLite access layer (`app/db.py`, stdlib `sqlite3`); create DB + tables on startup (FastAPI lifespan) if missing; seed demo user + default board (`app/seed.py`).
- [x] `GET /api/board` returns the current user's board JSON; `PUT /api/board` replaces it (validated against the `Board` model).
- [x] Validation of incoming board JSON via Pydantic `Board` model; FastAPI returns 422 on invalid payloads. Board routes protected by the `require_user` dependency (Part 4 deferral, now done).
- [x] Backend unit tests: get/put round-trip, validation failure (422), DB auto-create on startup, auth required (401). 11 backend tests pass; round-trip also verified against the container.

Tests / success criteria: DB file created automatically when absent; get returns seeded board; put persists and survives restart; invalid payloads rejected; unauthenticated requests blocked. Backend test suite passes.

---

## Part 7: Frontend + Backend

Make the board persistent via the API.

- [x] Frontend loads board from `GET /api/board` on mount (`src/lib/board.ts`; `KanbanBoard` no longer seeds `initialData`).
- [x] Persist mutations (move, rename, add, delete) via `PUT /api/board`, whole-board save debounced 400ms to coalesce rapid edits; timer cleared on unmount.
- [x] Loading state while fetching; simple save-error banner on failed `PUT`.
- [x] Tests: component tests with mocked board lib (load + persist on add); e2e persistence across reload via a stateful board mock; real wiring verified against the container (bundle calls `/api/board`, authed GET 200).

Tests / success criteria: changes persist across reload and container restart; board reflects backend state on load. Unit, integration, and e2e tests pass.

---

## Part 8: AI connectivity

Verify OpenRouter calls work.

- [x] Backend OpenRouter client reading `OPENROUTER_API_KEY` from env; model `openai/gpt-oss-120b` (`app/ai.py`, openai SDK pointed at OpenRouter).
- [x] `POST /api/ai/ping` (auth-gated) sends "what is 2+2"; returns the model's answer, 502 with upstream detail on error.
- [x] Verify Structured Outputs support; recorded in `docs/AI.md`. Live-verified: `openai/gpt-oss-120b` via OpenRouter supports strict `json_schema` response_format. No fallback needed.
- [x] Test: connectivity tests with the AI mocked (answer, auth-required, error path). 14 backend tests pass.
- [x] Live 2+2 verified: `POST /api/ai/ping` returns `{"answer":"4"}` (200) with a working key.

Tests / success criteria: a real call returns a correct "4" answer locally; client handles missing key and API errors gracefully; structured-output capability documented. Tests pass (external call mocked in the suite).

---

## Part 9: AI over the board

Always call the AI with the board JSON + user question + history; return Structured Outputs.

- [x] `POST /api/ai/chat` (auth-gated): input = `{ message, history: [{role, content}] }`; server attaches the current board JSON as a system message.
- [x] Structured output via `client.chat.completions.parse` with `ChatResult { reply: str, board_update: AiBoard | null }`. AI-facing `AiBoard` uses cards as a list (strict json_schema disallows arbitrary-key maps); converted to/from the internal `Board` (cards map) server-side.
- [x] Apply `board_update` to persistence when present (save_board); response is `{ reply, board: BoardData | null }`. System prompt keeps columns fixed, ids stable, no emojis.
- [x] Tests: conversion round-trip; reply-only (board unchanged, current board attached); reply+update persisted; auth required (401); AI error -> 502. 19 backend tests pass.
- [x] Live-verified: question answered with no board change; "add a card" and "move a card" applied and persisted (GET reflects them); replies emoji-free.

Tests / success criteria: AI can answer questions about the board and, when it chooses, return a valid board update that is persisted. Schema validation enforced. Tests pass (model mocked for deterministic cases; one live smoke check documented).

---

## Part 10: AI chat sidebar UI

Beautiful sidebar widget with full chat that can update the board.

- [x] Sidebar chat widget (`ChatSidebar.tsx`): toggle button, message history, input, loading ("Thinking...") and error states, app color scheme; wired to `POST /api/ai/chat` via `src/lib/chat.ts`.
- [x] When the response includes a board update, refresh the board UI automatically (sidebar calls `onBoardUpdate={setBoard}` in `KanbanBoard`; no extra save since the AI endpoint already persisted).
- [x] Accessible (labelled input/buttons, `aria-label` on the panel), responsive fixed panel consistent with the design.
- [x] Tests: component tests (send/receive, auto-refresh via `onBoardUpdate`); e2e where an AI instruction adds a card that becomes visible on the board. Lint clean; bundle references `/api/ai/chat`.

Tests / success criteria: user can chat in the sidebar; AI-driven create/edit/move updates the board and the UI refreshes without manual reload. Unit, integration, and e2e tests pass.

---

## Definition of done (overall)

- App runs in a single Docker container locally via the start script.
- Login gate works; board persists in SQLite across page reloads and in-container restarts (DB is ephemeral under `--rm`; add a volume for persistence across container removal).
- AI chat sidebar can create/edit/move cards via Structured Outputs and the UI refreshes.
- Unit, integration, and e2e tests pass; docs (`AGENTS.md` files, `docs/DATABASE.md`, README) are current and minimal.
