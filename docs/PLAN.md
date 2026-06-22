# Project Plan: Kanban PM MVP

Detailed, checklist-driven plan for the 10-part build. Each part has substeps, tests, and success criteria. Check off substeps as completed.

## Key decisions (defaults)

- Serving: Next.js static export (`output: "export"`) built into `frontend/out`, served by FastAPI as static files at `/`. Single process, no Next.js server. All data access goes through the FastAPI API.
- Database: SQLite. Users in a relational `users` table; each user's board persisted as a single JSON blob (matching the frontend `BoardData` shape) rather than normalized column/card tables. DB auto-created on first run if missing.
- Auth: server-set session cookie issued by FastAPI on successful login with hardcoded `user` / `password`. Logout clears the cookie.
- AI: OpenRouter, model `openai/gpt-oss-120b`. Part 8 verifies Structured Outputs (JSON schema) support; if unsupported on that route, fall back to JSON mode plus server-side schema validation (decision recorded in docs at that time).
- Package management: `uv` for Python inside Docker. Python deps pinned via `pyproject.toml` + `uv.lock`.
- Approval gates: explicit user sign-off at Part 1 (this plan) and Part 5 (DB approach). Other parts run through, but each ends in a passing-tests checkpoint.
- Testing: write valuable tests (core logic, integration points, regressions). Aim for ~80% coverage only when sensible; do not add tests purely to hit a number. Falling short of 80% is fine.
- Standards (from AGENTS.md): latest idiomatic library versions; keep it simple, no over-engineering or unnecessary defensive code; concise/minimal docs; no emojis; root-cause before fixing.

## Repository layout (target)

```
backend/        FastAPI app, AI client, SQLite access, tests
frontend/       Next.js app (existing demo; statically exported)
scripts/        start/stop scripts for Mac, Linux, PC
docs/           planning + design docs (this file, DB design)
Dockerfile      multi-stage: build frontend, assemble Python backend
.env            OPENROUTER_API_KEY (already present)
```

---

## Part 1: Plan

- [x] Enrich this document with detailed substeps, tests, and success criteria per part.
- [x] Record key technical decisions / defaults.
- [x] Create `frontend/AGENTS.md` describing the existing frontend code.
- [ ] Get user review and approval of this plan.

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
- [ ] Protect board data routes behind the session — deferred to Part 6 (no board routes exist yet); `require_user` dependency added there.
- [x] Tests: backend unit tests for login/logout/session (valid, invalid, anonymous); frontend component test for the login gate; e2e for the full login -> board -> logout flow and invalid-credentials error (API mocked in Playwright; real flow verified against the container).

Tests / success criteria: wrong credentials rejected; correct credentials reach the board; logout returns to login; refresh preserves session via cookie. All new and existing tests pass.

---

## Part 5: Database modeling

Propose and document the schema; get sign-off.

- [ ] Define schema: `users` table; per-user board stored as JSON (the `BoardData` shape: columns with `cardIds`, cards map).
- [ ] Document the approach, schema, and example JSON in `docs/DATABASE.md` (tables, columns, how the board JSON is stored/validated, auto-create behavior).
- [ ] Provide the seed/default board used for a new user.
- [ ] Get user sign-off on `docs/DATABASE.md`.

Tests / success criteria: `docs/DATABASE.md` exists and is approved by the user. Schema is consistent with the frontend `BoardData` type.

---

## Part 6: Backend (board API)

Read/write the Kanban for a user; auto-create DB.

- [ ] SQLite access layer; create DB + tables on startup if missing; seed default board for the demo user.
- [ ] `GET /api/board` returns the current user's board JSON; `PUT /api/board` replaces it (validated against the board shape).
- [ ] Validation of incoming board JSON; consistent error responses.
- [ ] Backend unit tests: get/put round-trip, validation failures, auto-create-on-missing-DB, auth required.

Tests / success criteria: DB file created automatically when absent; get returns seeded board; put persists and survives restart; invalid payloads rejected; unauthenticated requests blocked. Backend test suite passes.

---

## Part 7: Frontend + Backend

Make the board persistent via the API.

- [ ] Frontend loads board from `GET /api/board` on mount (replace in-memory `initialData` seed).
- [ ] Persist mutations (move, rename, add, delete) via `PUT /api/board` (whole-board save, debounced as needed).
- [ ] Loading/empty states; handle save errors simply.
- [ ] Tests: frontend integration tests with mocked API; full e2e (login -> mutate board -> reload -> changes persisted).

Tests / success criteria: changes persist across reload and container restart; board reflects backend state on load. Unit, integration, and e2e tests pass.

---

## Part 8: AI connectivity

Verify OpenRouter calls work.

- [ ] Backend OpenRouter client reading `OPENROUTER_API_KEY` from env; model `openai/gpt-oss-120b`.
- [ ] `POST /api/ai/ping` (or test) that sends "what is 2+2" and returns the model's answer.
- [ ] Verify whether the model/route supports Structured Outputs (JSON schema); record the finding and the fallback decision in docs.
- [ ] Test: connectivity test asserting a sensible response to "2+2" (mocked in CI, live check documented).

Tests / success criteria: a real call returns a correct "4" answer locally; client handles missing key and API errors gracefully; structured-output capability documented. Tests pass (external call mocked in the suite).

---

## Part 9: AI over the board

Always call the AI with the board JSON + user question + history; return Structured Outputs.

- [ ] `POST /api/ai/chat`: input = user message + conversation history; server attaches current board JSON.
- [ ] Define the structured output schema: `{ reply: string, board_update?: BoardData }` (or a diff form, decided here).
- [ ] Apply `board_update` to persistence when present; return reply (and updated board) to the client.
- [ ] Tests: structured response parsed/validated; reply-only vs reply+update paths; invalid model output handled; board update persisted.

Tests / success criteria: AI can answer questions about the board and, when it chooses, return a valid board update that is persisted. Schema validation enforced. Tests pass (model mocked for deterministic cases; one live smoke check documented).

---

## Part 10: AI chat sidebar UI

Beautiful sidebar widget with full chat that can update the board.

- [ ] Sidebar chat widget (color scheme, send/receive, history, loading state) wired to `POST /api/ai/chat`.
- [ ] When the response includes a board update, refresh the board UI automatically.
- [ ] Accessible, responsive layout consistent with the existing design.
- [ ] Tests: component tests for chat send/receive and auto-refresh on update; e2e where an AI instruction visibly changes the board.

Tests / success criteria: user can chat in the sidebar; AI-driven create/edit/move updates the board and the UI refreshes without manual reload. Unit, integration, and e2e tests pass.

---

## Definition of done (overall)

- App runs in a single Docker container locally via the start script.
- Login gate works; board persists in SQLite across restarts.
- AI chat sidebar can create/edit/move cards via Structured Outputs and the UI refreshes.
- Unit, integration, and e2e tests pass; docs (`AGENTS.md` files, `docs/DATABASE.md`, README) are current and minimal.
