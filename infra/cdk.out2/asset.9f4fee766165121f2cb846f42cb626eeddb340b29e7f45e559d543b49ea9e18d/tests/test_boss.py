import json
import pytest
from src.handlers.boss import tap_handler
from src.handlers.admin import buildup_handler, start_handler, announce_handler, dashboard_handler, stop_handler
from src.shared.db import get_item, put_item, query_pk


# ── helpers ─────────────────────────────────────────────────────────────────

def _tap_event(player_id):
    return {
        "httpMethod": "POST",
        "resource": "/boss/tap",
        "body": json.dumps({"player_id": player_id}),
    }


def _make_player(player_id, name="Tester"):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": "PROFILE",
        "name": name,
        "photo_url": "",
    })


def _make_dino(player_id, species, level=1, tamed=True, is_partner=False):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "name": species,
        "level": level,
        "tamed": tamed,
        "is_partner": is_partner,
        "hat": "",
        "xp": 0,
        "colors": {},
        "gender": "male",
        "nature": "Jolly",
        "shiny": False,
    })


def _make_boss(hp=1000, max_hp=1000, status="active"):
    put_item({
        "PK": "BOSS",
        "SK": "STATE",
        "hp": hp,
        "max_hp": max_hp,
        "status": status,
    })


# ── test 1: boss tap deals correct damage ───────────────────────────────────

def test_boss_tap_deals_correct_damage():
    """Damage = 5 + sum of all tamed dino levels."""
    _make_player("b1")
    _make_dino("b1", "trex", level=3, tamed=True)
    _make_dino("b1", "triceratops", level=2, tamed=True)
    _make_boss(hp=1000)

    resp = tap_handler(_tap_event("b1"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    # Expected damage: 5 + 3 + 2 = 10
    assert body["damage"] == 10
    assert body["hp"] == 990
    assert body["defeated"] is False


# ── test 2: boss defeat when HP reaches 0 ───────────────────────────────────

def test_boss_defeat_when_hp_reaches_zero():
    """Boss is marked defeated when HP drops to 0."""
    _make_player("b2")
    _make_dino("b2", "trex", level=1, tamed=True)
    _make_boss(hp=6, max_hp=1000, status="active")  # 5 + 1 = 6 damage exactly

    resp = tap_handler(_tap_event("b2"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    assert body["hp"] == 0
    assert body["defeated"] is True

    # Verify DB state
    boss = get_item("BOSS", "STATE")
    assert boss["status"] == "defeated"


# ── test 3: boss tap rejected when no active fight ───────────────────────────

def test_boss_tap_rejected_when_no_active_fight():
    """Tap returns error when boss does not exist."""
    _make_player("b3")
    # No boss state created

    resp = tap_handler(_tap_event("b3"), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert "No boss fight" in body["error"]


def test_boss_tap_rejected_when_fight_not_active():
    """Tap returns error when boss status is not 'active'."""
    _make_player("b4")
    _make_boss(hp=500, status="waiting")

    resp = tap_handler(_tap_event("b4"), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "not active" in body["error"]


# ── test 4: damage calculation includes ALL dino levels ─────────────────────

def test_damage_includes_all_dino_levels():
    """Sum all tamed dinos; untamed dinos do not contribute."""
    _make_player("b5")
    _make_dino("b5", "trex", level=5, tamed=True)
    _make_dino("b5", "spinosaurus", level=3, tamed=True)
    _make_dino("b5", "ankylosaurus", level=10, tamed=False)  # untamed — not counted
    _make_boss(hp=2000)

    resp = tap_handler(_tap_event("b5"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    # Expected: 5 + 5 + 3 = 13 (untamed level 10 dino excluded)
    assert body["damage"] == 13
    assert body["hp"] == 1987


# ── test 5: HP does not go below 0 ──────────────────────────────────────────

def test_boss_hp_does_not_go_below_zero():
    """HP is clamped to 0 even if damage exceeds remaining HP."""
    _make_player("b6")
    _make_dino("b6", "trex", level=100, tamed=True)
    _make_boss(hp=3, max_hp=1000, status="active")  # tiny HP

    resp = tap_handler(_tap_event("b6"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    assert body["hp"] == 0
    assert body["defeated"] is True


# ── test 6: admin boss buildup broadcasts phase ──────────────────────────────

def test_admin_buildup_valid_phases():
    """Buildup handler accepts phases 1, 2, 3."""
    for phase in [1, 2, 3]:
        resp = buildup_handler(
            {
                "httpMethod": "POST",
                "resource": "/admin/boss/buildup",
                "body": json.dumps({"phase": phase}),
            },
            None,
        )
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["phase"] == phase
        assert body["type"] in ("shadows", "tremors", "roar")


def test_admin_buildup_invalid_phase():
    """Buildup handler rejects phases outside 1-3."""
    resp = buildup_handler(
        {
            "httpMethod": "POST",
            "resource": "/admin/boss/buildup",
            "body": json.dumps({"phase": 5}),
        },
        None,
    )
    assert resp["statusCode"] == 400


# ── test 7: admin boss start creates correct HP ─────────────────────────────

def test_admin_boss_start_creates_boss_state():
    """Boss start endpoint creates BOSS#STATE with correct HP."""
    resp = start_handler(
        {
            "httpMethod": "POST",
            "resource": "/admin/boss/start",
            "body": "{}",
        },
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "active"
    assert body["hp"] > 0
    assert body["max_hp"] == body["hp"]

    # Verify DB
    boss = get_item("BOSS", "STATE")
    assert boss is not None
    assert boss["status"] == "active"


# ── test 8: admin announce posts to feed ────────────────────────────────────

def test_admin_announce_creates_feed_entry():
    """Announce endpoint creates a feed entry."""
    resp = announce_handler(
        {
            "httpMethod": "POST",
            "resource": "/admin/announce",
            "body": json.dumps({"message": "Party time!"}),
        },
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["message"] == "Party time!"

    # Check feed
    entries = query_pk("FEED")
    messages = [e.get("message") for e in entries]
    assert "Party time!" in messages


def test_admin_announce_requires_message():
    """Announce endpoint rejects empty message."""
    resp = announce_handler(
        {
            "httpMethod": "POST",
            "resource": "/admin/announce",
            "body": json.dumps({}),
        },
        None,
    )
    assert resp["statusCode"] == 400


# ── test 9: player with no dinos deals base damage only ─────────────────────

def test_player_with_no_dinos_deals_base_damage():
    """Player with no tamed dinos deals only base 5 damage."""
    _make_player("b7")
    # No dinos
    _make_boss(hp=100)

    resp = tap_handler(_tap_event("b7"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    assert body["damage"] == 5
    assert body["hp"] == 95


# ── test 10: boss defeat awards hat to all players ──────────────────────────────

def test_boss_defeat_awards_hat_to_all_players():
    """All players' tamed dinos receive Kaiju Slayer hat on defeat, not just killer."""
    # Two players, only defeat1 delivers killing blow
    _make_player("defeat1")
    _make_dino("defeat1", "trex", level=1, tamed=True, is_partner=True)
    _make_player("defeat2")
    _make_dino("defeat2", "triceratops", level=1, tamed=True, is_partner=True)

    # HP exactly matches defeat1's damage: 5 + 1 = 6
    _make_boss(hp=6, max_hp=1000, status="active")

    resp = tap_handler(_tap_event("defeat1"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["defeated"] is True

    # Both players should have the hat
    dino1 = get_item("PLAYER#defeat1", "DINO#trex")
    dino2 = get_item("PLAYER#defeat2", "DINO#triceratops")
    assert dino1["hat"] == "kaiju_slayer"
    assert dino2["hat"] == "kaiju_slayer"


# ── test 11: admin boss stop resets to idle ────────────────────────────────────

def _stop_event():
    return {
        "httpMethod": "POST",
        "resource": "/admin/boss/stop",
        "body": "{}",
    }


def test_admin_boss_stop_resets_to_idle():
    """Stop handler overwrites BOSS#STATE with idle status."""
    put_item({
        "PK": "BOSS",
        "SK": "STATE",
        "status": "active",
        "hp": 500,
        "max_hp": 1000,
        "buildup_phase": 3,
    })

    resp = stop_handler(_stop_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "idle"

    boss = get_item("BOSS", "STATE")
    assert boss["status"] == "idle"
    assert int(boss["hp"]) == 0
    assert int(boss["buildup_phase"]) == 0


def test_admin_boss_stop_is_idempotent_when_already_idle():
    """Stop handler succeeds even when no active boss exists."""
    # No BOSS#STATE in DB at all
    resp = stop_handler(_stop_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "idle"
