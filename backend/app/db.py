import os
import sqlite3
from pathlib import Path

from app.models import Board
from app.seed import DEFAULT_BOARD

# Cached serialization of the default board to avoid recomputing on every call.
_DEFAULT_BOARD_JSON = DEFAULT_BOARD.model_dump_json()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

DEMO_USER = "user"


def _db_path() -> Path:
    return Path(
        os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "kanban.db")
    )


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_user(conn: sqlite3.Connection, username: str) -> None:
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if row:
        return
    cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
    conn.execute(
        "INSERT INTO boards (user_id, data) VALUES (?, ?)",
        (cursor.lastrowid, _DEFAULT_BOARD_JSON),
    )


def init_db() -> None:
    """Create the database and tables if missing, and seed the demo user."""
    with _connect() as conn:
        conn.executescript(SCHEMA)
        _ensure_user(conn, DEMO_USER)
        conn.commit()


def get_board(username: str) -> Board:
    with _connect() as conn:
        _ensure_user(conn, username)
        conn.commit()
        row = conn.execute(
            "SELECT b.data FROM boards b "
            "JOIN users u ON u.id = b.user_id WHERE u.username = ?",
            (username,),
        ).fetchone()
    return Board.model_validate_json(row["data"])


def save_board(username: str, board: Board) -> None:
    with _connect() as conn:
        _ensure_user(conn, username)
        conn.execute(
            "UPDATE boards SET data = ?, updated_at = datetime('now') "
            "WHERE user_id = (SELECT id FROM users WHERE username = ?)",
            (board.model_dump_json(), username),
        )
        conn.commit()
