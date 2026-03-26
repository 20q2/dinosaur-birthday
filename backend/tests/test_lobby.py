import json
import time
import pytest
from unittest.mock import patch
from src.handlers.lobby import (
    create_lobby_handler,
    join_lobby_handler,
    answer_lobby_handler,
    award_xp,
)
from src.shared.db import get_item, put_item, query_pk


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_event(body=None):
    return {
        "httpMethod": "POST",
        "resource": "/lobby",
        "pathParameters": {},
        "body": json.dumps(body or {}),
    }


def _join_event(code, body=None):
    return {
        "httpMethod": "POST",
        "resource": f"/lobby/{code}/join",
        "pathParameters": {"code": code},
        "body": json.dumps(body or {}),
    }


def _answer_event(code, body=None):
    return {
        "httpMethod": "POST",
        "resource": f"/lobby/{code}/answer",
        "pathParameters": {"code": code},
        "body": json.dumps(body or {}),
    }


def _make_profile(player_id, name="Player"):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": "PROFILE",
        "name": name,
        "photo_url": "",
    })


def _make_partner_dino(player_id, species="trex", xp=0, level=1):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "name": species.title(),
        "colors": {"body": 100},
        "gender": "male",
        "nature": "Jolly",
        "hat": "",
        "xp": xp,
        "level": level,
        "is_partner": True,
        "tamed": True,
        "shiny": False,
    })


def _make_lobby(code, host_id, status="waiting", guest_id=None):
    """Insert a lobby item directly."""
    now = int(time.time())
    item = {
        "PK": f"LOBBY#{code}",
        "SK": "META",
        "host_id": host_id,
        "status": status,
        "trivia_question": {
            "question": "What period did the T-Rex live in?",
            "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"],
            "answer": 1,
        },
        "created_at": now,
        "ttl": now + 120,
    }
    if guest_id:
        item["guest_id"] = guest_id
    put_item(item)


# ── Test 1: Create lobby returns code with 3 symbols ─────────────────────────

def test_create_lobby_returns_code_with_3_symbols():
    _make_profile("host1")

    resp = create_lobby_handler(_create_event({"player_id": "host1"}), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert "code" in body
    assert "symbols" in body
    assert len(body["symbols"]) == 3

    # Code should be the 3 symbols joined with underscores
    assert body["code"] == "_".join(body["symbols"])


def test_create_lobby_stores_in_db():
    _make_profile("host2")

    resp = create_lobby_handler(_create_event({"player_id": "host2"}), None)
    body = json.loads(resp["body"])
    code = body["code"]

    lobby = get_item(f"LOBBY#{code}", "META")
    assert lobby is not None
    assert lobby["host_id"] == "host2"
    assert lobby["status"] == "waiting"
    assert "trivia_question" in lobby
    assert "ttl" in lobby


def test_create_lobby_requires_player_id():
    resp = create_lobby_handler(_create_event({}), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "player_id" in body["error"]


# ── Test 2: Join lobby sets guest and returns trivia ─────────────────────────

def test_join_lobby_sets_guest_returns_trivia():
    _make_profile("host3")
    _make_profile("guest3")
    _make_lobby("meat_bone_egg", "host3")

    with patch("src.handlers.lobby.broadcast"):
        resp = join_lobby_handler(
            _join_event("meat_bone_egg", {"player_id": "guest3"}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["code"] == "meat_bone_egg"
    assert "trivia" in body
    assert "question" in body["trivia"]
    assert "options" in body["trivia"]
    assert len(body["trivia"]["options"]) == 4

    # Lobby should now be active with guest set
    lobby = get_item("LOBBY#meat_bone_egg", "META")
    assert lobby["status"] == "active"
    assert lobby["guest_id"] == "guest3"


def test_join_lobby_rejects_nonexistent_lobby():
    resp = join_lobby_handler(
        _join_event("no_such_code", {"player_id": "guest_x"}),
        None,
    )
    assert resp["statusCode"] == 404


def test_join_lobby_rejects_host_joining_own_lobby():
    _make_profile("host4")
    _make_lobby("meat_leaf_egg", "host4")

    resp = join_lobby_handler(
        _join_event("meat_leaf_egg", {"player_id": "host4"}),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "own" in body["error"]


def test_join_lobby_rejects_already_active_lobby():
    _make_profile("host5")
    _make_profile("guest5")
    _make_lobby("meat_hat_paint", "host5", status="active", guest_id="someone")

    resp = join_lobby_handler(
        _join_event("meat_hat_paint", {"player_id": "guest5"}),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "not available" in body["error"]


# ── Test 3: Answer correctly awards 50 XP + hat to both ──────────────────────

def test_answer_correct_awards_50xp_and_hat():
    _make_profile("host6", "Alice")
    _make_profile("guest6", "Bob")
    _make_partner_dino("host6", "trex", xp=0, level=1)
    _make_partner_dino("guest6", "spinosaurus", xp=0, level=1)

    # Correct answer index is 1 (Cretaceous)
    _make_lobby("bone_egg_leaf", "host6", status="active", guest_id="guest6")

    with patch("src.handlers.lobby.broadcast"):
        resp = answer_lobby_handler(
            _answer_event("bone_egg_leaf", {"player_id": "host6", "answer": 1}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["correct"] is True
    assert body["xp_awarded"] == 50
    assert body["hat"] is not None  # hat was awarded

    # Check both dinos gained XP
    host_dino = get_item("PLAYER#host6", "DINO#trex")
    guest_dino = get_item("PLAYER#guest6", "DINO#spinosaurus")
    assert int(host_dino["xp"]) == 50
    assert int(guest_dino["xp"]) == 50

    # Check hat items were added to inventories
    host_items = query_pk("PLAYER#host6", "ITEM#")
    guest_items = query_pk("PLAYER#guest6", "ITEM#")
    assert len(host_items) >= 1
    assert any(i.get("type") == "hat" for i in host_items)
    assert len(guest_items) >= 1
    assert any(i.get("type") == "hat" for i in guest_items)


# ── Test 4: Answer incorrectly awards 30 XP, no hat ─────────────────────────

def test_answer_incorrect_awards_30xp_no_hat():
    _make_profile("host7", "Carol")
    _make_profile("guest7", "Dave")
    _make_partner_dino("host7", "triceratops", xp=0, level=1)
    _make_partner_dino("guest7", "ankylosaurus", xp=0, level=1)

    # Correct answer is index 1; we submit index 0 (wrong)
    _make_lobby("paint_bone_egg", "host7", status="active", guest_id="guest7")

    with patch("src.handlers.lobby.broadcast"):
        resp = answer_lobby_handler(
            _answer_event("paint_bone_egg", {"player_id": "host7", "answer": 0}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["correct"] is False
    assert body["xp_awarded"] == 30
    assert body["hat"] is None  # no hat for incorrect

    # Check both dinos gained XP
    host_dino = get_item("PLAYER#host7", "DINO#triceratops")
    guest_dino = get_item("PLAYER#guest7", "DINO#ankylosaurus")
    assert int(host_dino["xp"]) == 30
    assert int(guest_dino["xp"]) == 30

    # No hat items should exist
    host_items = query_pk("PLAYER#host7", "ITEM#")
    guest_items = query_pk("PLAYER#guest7", "ITEM#")
    assert not any(i.get("type") == "hat" for i in host_items)
    assert not any(i.get("type") == "hat" for i in guest_items)


# ── Test 5: Cooldown enforcement ─────────────────────────────────────────────

def test_cooldown_enforced_after_play():
    _make_profile("host8", "Eve")
    _make_profile("guest8", "Frank")
    _make_partner_dino("host8", "parasaurolophus", xp=0, level=1)
    _make_partner_dino("guest8", "dilophosaurus", xp=0, level=1)

    # First game
    _make_lobby("leaf_sunglasses_meat", "host8", status="active", guest_id="guest8")

    with patch("src.handlers.lobby.broadcast"):
        resp = answer_lobby_handler(
            _answer_event(
                "leaf_sunglasses_meat",
                {"player_id": "host8", "answer": 0},
            ),
            None,
        )
    assert resp["statusCode"] == 200

    # Try to create and join another lobby between the same pair
    with patch("src.handlers.lobby.broadcast"):
        resp2 = create_lobby_handler(
            _create_event({"player_id": "host8"}), None
        )
    second_code = json.loads(resp2["body"])["code"]

    # Join should fail due to cooldown
    with patch("src.handlers.lobby.broadcast"):
        join_resp = join_lobby_handler(
            _join_event(second_code, {"player_id": "guest8"}),
            None,
        )
    assert join_resp["statusCode"] == 400
    body = json.loads(join_resp["body"])
    assert "cooldown" in body["error"].lower() or "rest" in body["error"].lower()


def test_cooldown_not_enforced_for_different_pairs():
    """Two separate pairs should NOT be blocked by each other's cooldown."""
    _make_profile("hostA")
    _make_profile("guestA")
    _make_profile("hostB")
    _make_profile("guestB")
    _make_partner_dino("hostA", "trex", xp=0, level=1)
    _make_partner_dino("guestA", "spinosaurus", xp=0, level=1)
    _make_partner_dino("hostB", "triceratops", xp=0, level=1)
    _make_partner_dino("guestB", "ankylosaurus", xp=0, level=1)

    # Pair A plays
    _make_lobby("meat_bone_leaf", "hostA", status="active", guest_id="guestA")
    with patch("src.handlers.lobby.broadcast"):
        answer_lobby_handler(
            _answer_event("meat_bone_leaf", {"player_id": "hostA", "answer": 0}),
            None,
        )

    # Pair B creates and joins — should succeed without cooldown block
    with patch("src.handlers.lobby.broadcast"):
        resp_create = create_lobby_handler(
            _create_event({"player_id": "hostB"}), None
        )
    code_b = json.loads(resp_create["body"])["code"]

    with patch("src.handlers.lobby.broadcast"):
        resp_join = join_lobby_handler(
            _join_event(code_b, {"player_id": "guestB"}),
            None,
        )
    assert resp_join["statusCode"] == 200


# ── Test 6: XP level-up logic ────────────────────────────────────────────────

def test_xp_leveling_up():
    """Award enough XP to trigger a level-up."""
    _make_partner_dino("lvl_test", "trex", xp=90, level=1)

    result = award_xp("lvl_test", 50)
    # 90 + 50 = 140; level 1 requires 100 xp to level up, so: new_xp=40, new_level=2
    assert result is not None
    assert result["level"] == 2
    assert result["xp"] == 40

    saved = get_item("PLAYER#lvl_test", "DINO#trex")
    assert int(saved["level"]) == 2
    assert int(saved["xp"]) == 40


def test_xp_capped_at_level_5():
    """XP should not exceed 0 (max level cap) once at level 5."""
    _make_partner_dino("lvl_cap", "trex", xp=0, level=5)

    result = award_xp("lvl_cap", 100)
    assert result is not None
    assert result["level"] == 5
    assert result["xp"] == 0  # capped


def test_award_xp_no_partner_returns_none():
    """award_xp should return None if no partner dino exists."""
    _make_profile("no_partner_player")
    # No dinos created
    result = award_xp("no_partner_player", 50)
    assert result is None
