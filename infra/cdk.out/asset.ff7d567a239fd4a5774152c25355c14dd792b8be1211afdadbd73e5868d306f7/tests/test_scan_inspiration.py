import json
from unittest.mock import patch
from src.handlers.scan_inspiration import handler
from src.shared.db import put_item, get_item, query_pk


def _event(body):
    return {
        "httpMethod": "POST",
        "pathParameters": {},
        "body": json.dumps(body),
    }


def _make_profile(player_id, name="Tester"):
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name})


def _make_partner_dino(player_id, species="trex", xp=0, level=1):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "name": species.title(),
        "colors": {"body": 100},
        "gender": "female",
        "nature": "Calm",
        "hat": "",
        "xp": xp,
        "level": level,
        "is_partner": True,
        "tamed": True,
        "shiny": False,
    })


# ── test_claim_inspiration_awards_50xp_and_blessing ──────────────────────────

def test_claim_inspiration_awards_50xp_and_blessing():
    _make_profile("insp1", "Grace")
    _make_partner_dino("insp1", "parasaurolophus", xp=0, level=1)

    with patch("src.handlers.scan_inspiration.broadcast"):
        resp = handler(_event({"player_id": "insp1"}), None)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["claimed"] is True
    assert body["xp_awarded"] == 50
    assert body["dino"]["species"] == "parasaurolophus"
    assert body["dino"]["xp"] == 50
    assert body["item"]["hat_id"] == "birthday_blessing"
    assert body["item"]["rarity"] == "legendary"

    # Dino XP updated
    dino = get_item("PLAYER#insp1", "DINO#parasaurolophus")
    assert int(dino["xp"]) == 50

    # Hat in inventory
    items = query_pk("PLAYER#insp1", "ITEM#")
    assert len(items) == 1
    assert items[0]["details"]["hat_id"] == "birthday_blessing"

    # INSPIRATION record written
    record = get_item("PLAYER#insp1", "INSPIRATION")
    assert record is not None


# ── test_inspiration_once_per_player ─────────────────────────────────────────

def test_inspiration_once_per_player():
    _make_profile("insp2", "Henry")
    _make_partner_dino("insp2", "dilophosaurus", xp=0, level=1)

    with patch("src.handlers.scan_inspiration.broadcast"):
        resp1 = handler(_event({"player_id": "insp2"}), None)
    assert json.loads(resp1["body"])["claimed"] is True

    # Second scan
    with patch("src.handlers.scan_inspiration.broadcast"):
        resp2 = handler(_event({"player_id": "insp2"}), None)
    body2 = json.loads(resp2["body"])
    assert resp2["statusCode"] == 200
    assert body2["already_received"] is True
    assert body2["item"]["hat_id"] == "birthday_blessing"

    # XP should NOT have been awarded twice
    dino = get_item("PLAYER#insp2", "DINO#dilophosaurus")
    assert int(dino["xp"]) == 50


# ── test_inspiration_posts_to_feed ───────────────────────────────────────────

def test_inspiration_posts_to_feed():
    _make_profile("insp3", "Irene")
    _make_partner_dino("insp3", "trex", xp=0, level=1)

    feed_entries = []

    def mock_broadcast(channel, event_name, data):
        if channel == "feed":
            feed_entries.append(data)

    with patch("src.handlers.scan_inspiration.broadcast", side_effect=mock_broadcast):
        handler(_event({"player_id": "insp3"}), None)

    assert len(feed_entries) == 1
    assert "Irene" in feed_entries[0]["message"]
    assert "Inspiration" in feed_entries[0]["message"]
    assert "Alex" in feed_entries[0]["message"]


# ── test_inspiration_requires_player_id ──────────────────────────────────────

def test_inspiration_requires_player_id():
    resp = handler(_event({}), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "player_id" in body["error"]


# ── test_inspiration_player_not_found ────────────────────────────────────────

def test_inspiration_player_not_found():
    resp = handler(_event({"player_id": "ghost_player"}), None)
    assert resp["statusCode"] == 404


# ── test_inspiration_without_partner_dino ────────────────────────────────────

def test_inspiration_without_partner_dino():
    """Inspiration can be claimed without a partner dino; dino result is None."""
    _make_profile("insp4", "Jake")

    with patch("src.handlers.scan_inspiration.broadcast"):
        resp = handler(_event({"player_id": "insp4"}), None)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["claimed"] is True
    assert body["dino"] is None
    # Hat is still awarded
    items = query_pk("PLAYER#insp4", "ITEM#")
    assert len(items) == 1
    assert items[0]["details"]["hat_id"] == "birthday_blessing"
