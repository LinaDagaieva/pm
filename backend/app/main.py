import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from app import ai
from app.db import get_board, init_db, save_board
from app.models import Board

# Hardcoded MVP credentials (the DB will support real users later).
USERNAME = "user"
PASSWORD = "password"

_secret = os.environ.get("SESSION_SECRET")
if not _secret:
    raise RuntimeError("SESSION_SECRET environment variable is required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Kanban PM", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=_secret)


def require_user(request: Request) -> str:
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.get("/api/health")
def health():
    return {"status": "ok"}


class Credentials(BaseModel):
    username: str
    password: str


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username == USERNAME and credentials.password == PASSWORD:
        request.session["user"] = credentials.username
        return {"user": credentials.username}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/session")
def session(request: Request):
    user = request.session.get("user")
    return {"authenticated": user is not None, "user": user}


@app.get("/api/board")
def read_board(user: str = Depends(require_user)) -> Board:
    return get_board(user)


@app.put("/api/board")
def write_board(board: Board, user: str = Depends(require_user)) -> Board:
    save_board(user, board)
    return board


@app.post("/api/ai/ping")
def ai_ping(_user: str = Depends(require_user)):
    try:
        answer = ai.ask("What is 2+2? Reply with only the number.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}")
    return {"answer": answer}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list, max_length=100)


@app.post("/api/ai/chat")
def ai_chat(request: ChatRequest, user: str = Depends(require_user)):
    board = get_board(user)
    try:
        result = ai.chat(
            request.message,
            [message.model_dump() for message in request.history],
            board,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}")

    if result.board_update is None:
        return {"reply": result.reply, "board": None}

    updated = ai.ai_board_to_board(result.board_update)
    save_board(user, updated)
    return {"reply": result.reply, "board": updated}


# Static site (placeholder now; the built frontend in Part 3). Mounted last so
# the API routes above take precedence.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
