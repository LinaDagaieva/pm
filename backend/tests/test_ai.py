from fastapi.testclient import TestClient

from app import ai
from app.main import app


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_ai_ping_requires_auth():
    client = TestClient(app)
    assert client.post("/api/ai/ping").status_code == 401


def test_ai_ping_returns_answer(monkeypatch):
    monkeypatch.setattr(ai, "ask", lambda question: "4")
    client = TestClient(app)
    login(client)
    response = client.post("/api/ai/ping")
    assert response.status_code == 200
    assert response.json() == {"answer": "4"}


def test_ai_ping_handles_failure(monkeypatch):
    def boom(question):
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    monkeypatch.setattr(ai, "ask", boom)
    client = TestClient(app)
    login(client)
    assert client.post("/api/ai/ping").status_code == 502
