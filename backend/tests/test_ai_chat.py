import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import app
from app.models import Card
from app.seed import DEFAULT_BOARD


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as test_client:
        yield test_client


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_board_ai_board_round_trip():
    ai_board = ai.board_to_ai_board(DEFAULT_BOARD)
    assert isinstance(ai_board.cards, list)
    back = ai.ai_board_to_board(ai_board)
    assert back.model_dump() == DEFAULT_BOARD.model_dump()


def test_chat_requires_auth(client):
    assert client.post("/api/ai/chat", json={"message": "hi"}).status_code == 401


def test_chat_reply_only_leaves_board_unchanged(client, monkeypatch):
    captured = {}

    def fake_chat(message, history, board):
        captured["board"] = board
        return ai.ChatResult(reply="Hello there", board_update=None)

    monkeypatch.setattr(ai, "chat", fake_chat)
    login(client)

    response = client.post("/api/ai/chat", json={"message": "hi"})
    assert response.status_code == 200
    assert response.json() == {"reply": "Hello there", "board": None}

    # The server attached the current (seeded) board to the AI call.
    assert len(captured["board"].cards) == 8
    # Board is untouched.
    assert len(client.get("/api/board").json()["cards"]) == 8


def test_chat_with_update_persists(client, monkeypatch):
    def fake_chat(message, history, board):
        ai_board = ai.board_to_ai_board(board)
        ai_board.cards.append(Card(id="card-new", title="AI card", details="x"))
        ai_board.columns[0].cardIds.append("card-new")
        return ai.ChatResult(reply="Added it", board_update=ai_board)

    monkeypatch.setattr(ai, "chat", fake_chat)
    login(client)

    response = client.post("/api/ai/chat", json={"message": "add a card"})
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Added it"
    assert body["board"]["cards"]["card-new"]["title"] == "AI card"

    # Persisted: a fresh GET reflects the new card.
    assert "card-new" in client.get("/api/board").json()["cards"]


def test_chat_handles_ai_error(client, monkeypatch):
    def boom(message, history, board):
        raise RuntimeError("model exploded")

    monkeypatch.setattr(ai, "chat", boom)
    login(client)
    assert client.post("/api/ai/chat", json={"message": "hi"}).status_code == 502
