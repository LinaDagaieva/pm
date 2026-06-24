# Code Review Report

**Date:** 2026-06-24
**Reviewer:** Claude Code
**Scope:** Full repository — backend, frontend, infrastructure, and configuration

---

## Executive Summary

The codebase is well-structured for an MVP. Architecture decisions are sound (cookie-based auth, debounced saves, structured AI output). Most issues are medium-to-low severity; there are a small number of critical issues requiring immediate attention.

**Critical issues (do today):**
1. `uv.lock` is gitignored, blocking Docker builds from a fresh clone
2. The `OPENROUTER_API_KEY` in `.env` should be treated as compromised and rotated
3. `credentials: "include"` is missing from all frontend `fetch` calls — auth is broken for board/chat APIs
4. `createId()` uses a weak collision-prone algorithm instead of `crypto.randomUUID()`

**High-priority issues (do this week):**
5. Dev fallback session secret is world-readable in source
6. New OpenAI client created per-request (connection pool waste)
7. No `timeout` on OpenAI API calls
8. `getBoard()` errors in `useEffect` are unhandled promise rejections
9. `getSession()` conflates network errors with "not authenticated"

---

## Critical Issues

### 1. Auth broken — missing `credentials: "include"` in all fetch calls

**Files:** `frontend/src/lib/board.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/chat.ts`

The backend uses cookie-based session authentication. Every `fetch()` call to `/api/*` must include `credentials: "include"` or cookies will not be sent.

```typescript
// CURRENT — cookies NOT sent
const res = await fetch("/api/board");

// FIXED
const res = await fetch("/api/board", { credentials: "include" });
```

**Impact:** Login works (it reads the response, not the cookie), but all subsequent board load/save and chat requests are unauthenticated and return 401.

**Fix:** Add `{ credentials: "include" }` to every `fetch()` call in `board.ts`, `auth.ts`, and `chat.ts`.

---

### 2. `uv.lock` is gitignored, breaking Docker builds

**Files:** `.gitignore` (line 100: `#uv.lock`), `Dockerfile`

The Dockerfile runs `uv sync --frozen --no-dev`, which requires `uv.lock` to exist. Since `uv.lock` is commented out in `.gitignore`, a fresh clone has no `uv.lock` and the build fails immediately.

**Fix:** Either:
- **Option A (recommended):** Uncomment `uv.lock` in `.gitignore` and commit it to the repo for reproducible builds.
- **Option B:** Remove `--frozen` from `uv sync` in the Dockerfile and add a `uv lock` step before `uv sync`.

---

### 3. Session secret fallback is world-readable

**File:** `backend/app/main.py` (line 28)

```python
SessionMiddleware(secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me"))
```

If `SESSION_SECRET` is not set in production, sessions are trivially hijackable. The fallback default is in source code.

**Fix:** Remove the fallback, or raise an error at startup if the env var is not set:
```python
secret = os.environ.get("SESSION_SECRET")
if not secret:
    raise RuntimeError("SESSION_SECRET environment variable is required")
SessionMiddleware(secret_key=secret)
```

---

### 4. `createId()` has collision risk and uses weak randomness

**File:** `frontend/src/lib/kanban.ts`

```typescript
export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);  // Only 6 chars
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};
```

Two cards created in the same millisecond will have identical `timePart`. The random portion has ~2 billion possibilities (36^6), which is guessable. `Math.random()` is not cryptographically secure.

**Fix:** Use the built-in `crypto.randomUUID()`:
```typescript
export const createId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID()}`;
```

---

## High Priority Issues

### 5. OpenAI client created per-request

**File:** `backend/app/ai.py` (lines 48-51)

```python
def _client():
    return OpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url="https://openrouter.ai/api/v1",
    )
```

A new OpenAI client is instantiated on every `ask()` or `chat()` call. Each instantiation creates a new HTTP connection pool. This should be a module-level singleton.

**Fix:**
```python
_client = OpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api/v1",
)

def ask(...) -> str:
    completion = _client.chat.completions.create(...)
```

---

### 6. No timeout on OpenAI API calls

**File:** `backend/app/ai.py` (lines 56-60, 74-78)

Both `ask()` and `chat()` pass no `timeout` to `client.chat.completions.create()`. Requests can hang indefinitely if OpenRouter is slow or unreachable.

**Fix:** Add a timeout (e.g., 60 seconds):
```python
completion = _client.chat.completions.create(
    model=MODEL,
    messages=messages,
    timeout=60.0,
)
```

---

### 7. `getBoard()` promise rejection unhandled in useEffect

**File:** `frontend/src/components/KanbanBoard.tsx` (line ~100)

```typescript
useEffect(() => {
  getBoard().then(setBoard);  // Unhandled rejection if getBoard throws
}, []);
```

If `getBoard()` fails (network error), the unhandled rejection can cause silent failures in development mode.

**Fix:**
```typescript
useEffect(() => {
  getBoard()
    .then(setBoard)
    .catch((err) => console.error("Failed to load board:", err));
}, []);
```

---

### 8. `getSession()` conflates network errors with unauthenticated state

**File:** `frontend/src/lib/auth.ts`

```typescript
export async function getSession(): Promise<Session> {
  const res = await fetch("/api/session");
  if (!res.ok) {
    return { authenticated: false, user: null };  // Network errors silently treated as "not authed"
  }
  return res.json();
}
```

A server error (500) or network failure returns `{ authenticated: false }` with no indication anything went wrong. The user may see a login prompt when the server is actually down.

**Fix:** Distinguish error cases:
```typescript
export async function getSession(): Promise<Session> {
  try {
    const res = await fetch("/api/session", { credentials: "include" });
    if (!res.ok) return { authenticated: false, user: null, error: "server_error" };
    return res.json();
  } catch {
    return { authenticated: false, user: null, error: "network_error" };
  }
}
```

---

### 9. AI model name may not exist

**File:** `backend/app/ai.py` (line 9)

```python
MODEL = "openai/gpt-oss-120b"
```

`openai/gpt-oss-120b` is not a standard OpenRouter model. If this model is not available, all AI requests return 422/404.

**Fix:** Verify the model exists on OpenRouter or use a known model like `openai/gpt-4o`. Document the model choice in `docs/AI.md`.

---

## Medium Priority Issues

### 10. `DEFAULT_BOARD.model_dump_json()` recomputed on every `_ensure_user()` call

**File:** `backend/app/db.py` (line 50)

Every `get_board()` and `save_board()` call invokes `_ensure_user()`, which serializes the default board to JSON. This is wasted CPU on the hot path.

**Fix:** Compute once at module level:
```python
_DEFAULT_BOARD_JSON = DEFAULT_BOARD.model_dump_json()
```

---

### 11. `ChatMessage.role` accepts any string

**File:** `backend/app/main.py` (line 89)

```python
class ChatMessage(BaseModel):
    role: str  # Should be Literal["user", "assistant", "system"]
```

**Fix:**
```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
```

---

### 12. `ChatRequest` has no history size limit

**File:** `backend/app/main.py`

A client could send an arbitrarily large `history` array to inflate processing time or token usage.

**Fix:** Add a max size validator:
```python
class ChatRequest(BaseModel):
    history: list[ChatMessage] = Field(default_factory=list, max_length=100)
```

---

### 13. `docker stop` in stop.ps1 not guarded

**File:** `scripts/stop.ps1`

```powershell
docker stop kanban-pm  # Fails with red error if container doesn't exist
```

With `$ErrorActionPreference = "Stop"`, this aborts the script.

**Fix:** Add error suppression:
```powershell
docker stop kanban-pm 2>$null || $true
```

---

### 14. `backend/data/` not in `.dockerignore`

**File:** `.dockerignore`

A local `backend/data/kanban.db` could be sent to the build context and shipped into the container image.

**Fix:** Add `backend/data/` to `.dockerignore`.

---

### 15. `uv` image not pinned in Dockerfile

**File:** `Dockerfile`

```dockerfile
COPY --from=ghcr.io/astral-sh/uv:latest ...
```

The floating `latest` tag means rebuilding tomorrow could get a different `uv` version.

**Fix:** Pin to a version tag:
```dockerfile
COPY --from=ghcr.io/astral-sh/uv:0.5.18 ...
```

---

### 16. `logout()` ignores errors

**File:** `frontend/src/lib/auth.ts`

```typescript
export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });  // Errors silently ignored
}
```

If logout fails, the user remains logged in but the UI shows logged out.

**Fix:** Handle errors or at least log them.

---

### 17. `user` variable unused in `ai_ping`

**File:** `backend/app/main.py` (line 81)

```python
async def ai_ping(user: str = Depends(require_user)) -> dict[str, str]:
    return {"status": "ok"}
```

`user` is never used. Either remove it or document that it's for future use.

---

### 18. Board integrity not validated

**File:** `backend/app/main.py`

The `Board` model accepts any valid JSON but does not validate that `column.cardIds` references actually exist in `cards`. A malformed board (referencing a non-existent card) would be persisted.

**Fix:** Add a Pydantic validator to `Board`:
```python
@model_validator(mode="after")
def validate_card_references(self):
    for col in self.columns:
        for cid in col.cardIds:
            if cid not in self.cards:
                raise ValueError(f"Column {col.id} references non-existent card {cid}")
    return self
```

---

### 19. Unused explicit dependency

**File:** `backend/pyproject.toml` (line 9)

```toml
itsdangerous>=2.2
```

`itsdangerous` is not directly imported anywhere; it's a transitive dependency of `SessionMiddleware`. It can be safely removed.

---

### 20. Empty title allowed for columns

**File:** `frontend/src/components/KanbanColumn.tsx`

The rename input has no validation — a column can be renamed to an empty string.

**Fix:** Add validation to prevent empty titles.

---

## Low Priority Issues

### 21. `isColumnId` redundant check

**File:** `frontend/src/lib/kanban.ts`

```typescript
const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};
```

The explicit `isColumnId` check before `find` is redundant — `columns.find(...)` returns `undefined` in both cases.

---

### 22. `moveCard` creates unnecessary copies when nothing changes

**File:** `frontend/src/lib/kanban.ts`

When moving a card to its current position, the function still creates new array and object references. This causes unnecessary re-renders.

**Fix:** Return `undefined` or the original reference when no change occurs, and guard in the caller.

---

### 23. Error not cleared on input change in ChatSidebar

**File:** `frontend/src/components/ChatSidebar.tsx`

An error from a previous request persists until the next successful request.

**Fix:** Clear error on input change or message submit.

---

### 24. `sendChat()` doesn't parse JSON error responses

**File:** `frontend/src/lib/chat.ts`

The error handler falls back to `"Something went wrong."` without trying to parse the response body for a more specific error.

---

### 25. No health check after `docker run`

**Files:** `scripts/start.ps1`, `scripts/start.sh`

The script reports "running at http://localhost:8000" without verifying the container started successfully.

**Fix:** Poll `http://localhost:8000/api/health` (or a new `/api/health` endpoint) with a retry loop before reporting success.

---

### 26. `backend/AGENTS.md` referenced but not found

**File:** `README.md` (line 51)

The README references `backend/AGENTS.md` which does not exist.

---

## Testing Gaps

### 27. Missing test coverage

**File:** `frontend/src/lib/kanban.test.ts`

- No tests for `createId` (would catch collision risk)
- No tests for `moveCard` edge cases:
  - Moving card to the same position
  - Moving card to non-existent card/column ID
  - Empty columns array
- No tests for error paths in `board.ts`, `auth.ts`, `chat.ts`

**File:** `backend/tests/`

- No tests for concurrent board updates
- No tests for invalid card references in board JSON
- No tests for what happens when AI returns malformed `board_update`

---

## Security Concerns

### 28. API key should be rotated

**File:** `.env`

The `OPENROUTER_API_KEY` in `.env` appears to be a live key. Regardless of whether it is actually live, it should be treated as potentially compromised and rotated via the OpenRouter dashboard.

**Note:** Do NOT commit new API keys to the repo.

---

### 29. No CSRF protection on login/logout

**File:** `frontend/src/lib/auth.ts`

Login/logout operations don't indicate CSRF token handling. Mitigated by `SameSite` cookies if properly configured by Starlette.

---

### 30. AI response rendered directly

**File:** `frontend/src/components/ChatSidebar.tsx`

```typescript
{message.content}
```

AI response content is rendered directly. If the AI is manipulated via prompt injection, malicious content executes in the user's browser. Consider sanitizing output or adding a CSP.

---

## Action Items

### Must fix (Critical)

| # | Action | File(s) |
|---|--------|---------|
| 1 | Add `credentials: "include"` to all `fetch()` calls | `board.ts`, `auth.ts`, `chat.ts` |
| 2 | Commit `uv.lock` to repo (or remove `--frozen` from Dockerfile) | `.gitignore`, `Dockerfile` |
| 3 | Remove dev fallback for `SESSION_SECRET`, require env var at startup | `main.py` |
| 4 | Replace `createId()` with `crypto.randomUUID()` | `kanban.ts` |

### Should fix (High Priority)

| # | Action | File(s) |
|---|--------|---------|
| 5 | Make OpenAI client a module-level singleton | `ai.py` |
| 6 | Add `timeout=60.0` to all OpenAI API calls | `ai.py` |
| 7 | Add `.catch()` handler to `getBoard()` in useEffect | `KanbanBoard.tsx` |
| 8 | Distinguish network errors from auth failures in `getSession()` | `auth.ts` |
| 9 | Verify/change `openai/gpt-oss-120b` model to one that exists on OpenRouter | `ai.py`, `AI.md` |

### Consider fixing (Medium Priority)

| # | Action | File(s) |
|---|--------|---------|
| 10 | Cache `DEFAULT_BOARD.model_dump_json()` at module level | `db.py` |
| 11 | Change `ChatMessage.role` to `Literal["user", "assistant", "system"]` | `main.py` |
| 12 | Add `max_length` validator to `ChatRequest.history` | `main.py` |
| 13 | Guard `docker stop` in stop.ps1 with `2>$null \|\| $true` | `stop.ps1` |
| 14 | Add `backend/data/` to `.dockerignore` | `.dockerignore` |
| 15 | Pin `uv` image to version tag in Dockerfile | `Dockerfile` |
| 16 | Handle errors in `logout()` | `auth.ts` |
| 17 | Remove unused `user` param in `ai_ping` | `main.py` |
| 18 | Add board integrity validator (cardId references must exist) | `main.py` / `models.py` |
| 19 | Remove unused `itsdangerous` from explicit deps | `pyproject.toml` |
| 20 | Validate column rename prevents empty titles | `KanbanColumn.tsx` |

### Nice to have (Low Priority)

| # | Action | File(s) |
|---|--------|---------|
| 21 | Simplify `findColumnId` to remove redundant `isColumnId` check | `kanban.ts` |
| 22 | Optimize `moveCard` to skip copies when no change | `kanban.ts` |
| 23 | Clear error on input change in ChatSidebar | `ChatSidebar.tsx` |
| 24 | Parse JSON error responses in `sendChat()` | `chat.ts` |
| 25 | Add health check polling to start scripts | `start.ps1`, `start.sh` |
| 26 | Create missing `backend/AGENTS.md` | `backend/AGENTS.md` |

### Testing

| # | Action | File(s) |
|---|--------|---------|
| 27 | Add unit tests for `createId` and `moveCard` edge cases | `kanban.test.ts` |
| 28 | Add integration tests for invalid board state handling | `backend/tests/` |
| 29 | Add tests for concurrent board updates | `backend/tests/` |

---

*Report generated by Claude Code comprehensive code review.*
