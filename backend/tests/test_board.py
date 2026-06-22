import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as test_client:
        yield test_client


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_board_requires_auth(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_db_file_created_on_startup(client):
    assert os.path.exists(os.environ["DB_PATH"])


def test_get_returns_seeded_board(client):
    login(client)
    response = client.get("/api/board")
    assert response.status_code == 200
    board = response.json()
    assert len(board["columns"]) == 5
    assert len(board["cards"]) == 8
    assert board["columns"][0]["title"] == "Backlog"


def test_put_round_trip(client):
    login(client)
    board = client.get("/api/board").json()
    board["columns"][0]["title"] = "Renamed"
    board["cards"]["card-1"]["title"] = "Updated card"

    put_response = client.put("/api/board", json=board)
    assert put_response.status_code == 200

    reloaded = client.get("/api/board").json()
    assert reloaded["columns"][0]["title"] == "Renamed"
    assert reloaded["cards"]["card-1"]["title"] == "Updated card"


def test_put_rejects_invalid_board(client):
    login(client)
    # Missing required fields (cardIds, cards).
    response = client.put("/api/board", json={"columns": [{"id": "c", "title": "t"}]})
    assert response.status_code == 422
