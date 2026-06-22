from fastapi.testclient import TestClient

from app.main import app


def test_session_anonymous_by_default():
    client = TestClient(app)
    assert client.get("/api/session").json() == {
        "authenticated": False,
        "user": None,
    }


def test_login_success_sets_session():
    client = TestClient(app)
    response = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json() == {"user": "user"}
    assert client.get("/api/session").json() == {
        "authenticated": True,
        "user": "user",
    }


def test_login_invalid_credentials():
    client = TestClient(app)
    response = client.post(
        "/api/login", json={"username": "user", "password": "wrong"}
    )
    assert response.status_code == 401
    assert client.get("/api/session").json()["authenticated"] is False


def test_logout_clears_session():
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    assert client.get("/api/session").json()["authenticated"] is True
    client.post("/api/logout")
    assert client.get("/api/session").json()["authenticated"] is False
