import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

# Hardcoded MVP credentials (the DB will support real users later).
USERNAME = "user"
PASSWORD = "password"

app = FastAPI(title="Kanban PM")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me"),
)


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


# Static site (placeholder now; the built frontend in Part 3). Mounted last so
# the API routes above take precedence.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
