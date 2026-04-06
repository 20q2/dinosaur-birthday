import json
import pytest
from src.handlers.admin import handler
from src.shared.db import put_item, get_item, query_pk


def _make_event(method, path, body=None, query=None):
    event = {
        "httpMethod": method,
        "resource": path,
        "path": path,
        "body": json.dumps(body) if body else None,
        "queryStringParameters": query or {},
    }
    return event


def _create_player(player_id, name="TestPlayer"):
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "DINO#trex", "tamed": True, "name": "Rex", "xp": 50, "level": 1, "colors": {}, "gender": "M", "nature": "Brave", "hat": "", "is_partner": True, "shiny": False})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "ITEM#party_hat", "type": "hat", "name": "Party Hat", "details": {}})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "NOTE#1"})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "INSPIRATION"})
    put_item({"PK": "PLAZA", "SK": f"PARTNER#{player_id}", "species": "trex", "name": "Rex"})
    put_item({"PK": "COOLDOWN", "SK": f"COOLDOWN#{player_id}#other_player"})


def test_reset_player_removes_game_data():
    player_id = "reset-test-1"
    _create_player(player_id)

    resp = handler(_make_event("DELETE", "/admin/reset", query={"player_id": player_id}), None)
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert body["deleted"] >= 5

    # Profile should still exist
    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    assert profile is not None
    assert profile["name"] == "TestPlayer"

    # Game data should be gone
    assert get_item(f"PLAYER#{player_id}", "DINO#trex") is None
    assert get_item(f"PLAYER#{player_id}", "ITEM#party_hat") is None
    assert get_item(f"PLAYER#{player_id}", "NOTE#1") is None
    assert get_item(f"PLAYER#{player_id}", "INSPIRATION") is None
    assert get_item("PLAZA", f"PARTNER#{player_id}") is None


def test_reset_player_requires_player_id():
    resp = handler(_make_event("DELETE", "/admin/reset", query={}), None)
    assert resp["statusCode"] == 400


def test_reset_player_nonexistent_player():
    resp = handler(_make_event("DELETE", "/admin/reset", query={"player_id": "no-such-player"}), None)
    body = json.loads(resp["body"])
    assert resp["statusCode"] == 200
    assert body["deleted"] == 0


def test_reset_all_removes_everything_except_profiles():
    _create_player("all-test-1", "Alice")
    _create_player("all-test-2", "Bob")
    put_item({"PK": "FEED", "SK": "2026-01-01T00:00:00#abc"})
    put_item({"PK": "BOSS", "SK": "STATE", "hp": 100, "max_hp": 100, "status": "active"})

    resp = handler(_make_event("DELETE", "/admin/reset-all"), None)
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert body["deleted"] >= 10

    # Profiles should still exist
    assert get_item("PLAYER#all-test-1", "PROFILE") is not None
    assert get_item("PLAYER#all-test-2", "PROFILE") is not None

    # Game data should be gone
    assert get_item("PLAYER#all-test-1", "DINO#trex") is None
    assert get_item("PLAYER#all-test-2", "DINO#trex") is None
    assert get_item("BOSS", "STATE") is None
    assert get_item("FEED", "2026-01-01T00:00:00#abc") is None
