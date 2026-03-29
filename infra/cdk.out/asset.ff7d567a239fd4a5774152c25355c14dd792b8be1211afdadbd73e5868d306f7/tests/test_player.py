import json
from src.handlers.player import handler
from src.shared.db import get_item, query_pk


def _make_event(method, path, body=None, path_params=None):
    return {
        "httpMethod": method,
        "path": path,
        "pathParameters": path_params or {},
        "body": json.dumps(body) if body else None,
        "headers": {},
    }


def test_create_player():
    event = _make_event("POST", "/player", body={
        "id": "player-123",
        "name": "Jake",
    })
    resp = handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["id"] == "player-123"
    assert body["name"] == "Jake"

    item = get_item("PLAYER#player-123", "PROFILE")
    assert item is not None
    assert item["name"] == "Jake"


def test_create_player_missing_name():
    event = _make_event("POST", "/player", body={"id": "p1"})
    resp = handler(event, None)
    assert resp["statusCode"] == 400


def test_get_player():
    # Create first
    create_event = _make_event("POST", "/player", body={
        "id": "player-456",
        "name": "Sarah",
    })
    handler(create_event, None)

    # Get
    get_event = _make_event("GET", "/player/player-456", path_params={"id": "player-456"})
    resp = handler(get_event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["name"] == "Sarah"
    assert "dinos" in body
    assert "items" in body


def test_get_nonexistent_player():
    event = _make_event("GET", "/player/nope", path_params={"id": "nope"})
    resp = handler(event, None)
    assert resp["statusCode"] == 404
