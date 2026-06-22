# Database Design

Storage for the Kanban PM MVP. SQLite, created automatically if missing.

## Approach

- One SQLite database file, path from `DB_PATH` (default `backend/data/kanban.db` locally, `/app/data/kanban.db` in the container).
- Two tables: `users` (relational, ready for multiple users) and `boards` (one row per user).
- Each user's board is stored as a single JSON blob matching the frontend `BoardData` shape, not normalized into column/card tables.
- Access via the Python stdlib `sqlite3` (no ORM). The board JSON is validated with Pydantic models on write.
- On startup: create the DB file and tables if absent, then seed the demo user and a default board if absent.

### Why a JSON blob (not normalized tables)

- The board is always read and written as a whole unit (load on open, save on change, AI rewrites the whole board).
- The JSON maps 1:1 to the frontend `BoardData` type, so no translation layer.
- For the MVP (one board per user, no cross-board queries) normalized tables add complexity with no benefit.
- Trade-off: no per-card SQL queries or partial updates. Not needed for this MVP; revisit if requirements grow.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data       TEXT NOT NULL,                       -- JSON, BoardData shape
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Notes:
- `boards.user_id` is `UNIQUE`, enforcing one board per user (the MVP constraint) while leaving room for many users.
- Passwords are not stored: MVP login is hardcoded (`user`/`password`) in the backend. A `password_hash` column on `users` is the natural future extension when real accounts arrive.
- Timestamps are stored as text via SQLite `datetime('now')` (UTC).

## Board JSON shape

`boards.data` holds the same structure the frontend already uses (`frontend/src/lib/kanban.ts`):

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] },
    { "id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "..." },
    "card-2": { "id": "card-2", "title": "Gather customer signals", "details": "..." },
    "card-3": { "id": "card-3", "title": "Prototype analytics view", "details": "..." }
  }
}
```

Validation models (Part 6):

```
Card   = { id: str, title: str, details: str }
Column = { id: str, title: str, cardIds: list[str] }
Board  = { columns: list[Column], cards: dict[str, Card] }
```

## Seed data

On first startup the DB is seeded with:
- User: `user` (the hardcoded MVP login).
- A default board: the five fixed columns (Backlog, Discovery, In Progress, Review, Done) with the eight demo cards currently shown in the frontend, so a fresh install opens to a populated board rather than an empty one.

## Out of scope for the schema

- No sessions table: sessions live in signed cookies (Part 4), not the DB.
- No AI/chat history table for the MVP: conversation history is passed from the client per request (Part 9). Add a table later only if persistence is required.
