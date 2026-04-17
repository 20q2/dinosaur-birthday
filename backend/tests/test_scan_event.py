import json
from unittest.mock import patch
from src.handlers.scan_event import handler
from src.shared.db import put_item, get_item, query_pk


def _event(event_type, body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"type": event_type},
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
        "gender": "male",
        "nature": "Jolly",
        "hat": "",
        "xp": xp,
        "level": level,
        "is_partner": True,
        "tamed": True,
        "shiny": False,
    })


# ── test_claim_event_awards_xp_and_item ───────────────────────────────────────

def test_claim_event_awards_xp_and_item():
    _make_profile("ev1", "Alice")
    _make_partner_dino("ev1", "trex", xp=0, level=1)

    with patch("src.handlers.scan_event.broadcast"):
        resp = handler(_event("event1", {"player_id": "ev1"}), None)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["claimed"] is True
    assert body["xp_awarded"] == 25
    assert body["event_label"] == "Party Chef"
    assert body["dino"] is not None
    assert body["dino"]["species"] == "trex"
    assert body["dino"]["xp"] == 25

    # Event1 (Party Chef) awards the Chef Hat if player doesn't already have one
    assert body["item"]["type"] == "hat"
    assert body["item"]["hat_id"] == "chef_hat"

    # Partner dino should have received XP
    dino = get_item("PLAYER#ev1", "DINO#trex")
    assert int(dino["xp"]) == 25

    # Reward item should be in inventory
    items = query_pk("PLAYER#ev1", "ITEM#")
    assert len(items) == 1
    assert items[0]["type"] == "hat"
    assert items[0]["details"]["hat_id"] == "chef_hat"

    # Event claim should be recorded
    claim = get_item("EVENT#ev1", "event1")
    assert claim is not None


# ── test_event_once_per_player ────────────────────────────────────────────────

def test_event_once_per_player():
    _make_profile("ev2", "Bob")
    _make_partner_dino("ev2", "spinosaurus", xp=0, level=1)

    with patch("src.handlers.scan_event.broadcast"):
        resp1 = handler(_event("event2", {"player_id": "ev2"}), None)
    assert resp1["statusCode"] == 200
    body1 = json.loads(resp1["body"])
    assert body1["claimed"] is True

    # Second claim should return already_claimed
    with patch("src.handlers.scan_event.broadcast"):
        resp2 = handler(_event("event2", {"player_id": "ev2"}), None)
    assert resp2["statusCode"] == 200
    body2 = json.loads(resp2["body"])
    assert body2["already_claimed"] is True

    # XP should not have been awarded a second time
    dino = get_item("PLAYER#ev2", "DINO#spinosaurus")
    assert int(dino["xp"]) == 25  # only once


# ── test_event_feed_message ───────────────────────────────────────────────────

def test_event_feed_message():
    _make_profile("ev3", "Carol")
    _make_partner_dino("ev3", "triceratops", xp=0, level=1)

    feed_entries = []

    def mock_broadcast(channel, event_name, data):
        if channel == "feed":
            feed_entries.append(data)

    with patch("src.handlers.scan_event.broadcast", side_effect=mock_broadcast):
        resp = handler(_event("event1", {"player_id": "ev3"}), None)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["claimed"] is True

    # Feed message should mention bringing food
    assert len(feed_entries) == 1
    assert "brought food" in feed_entries[0]["message"]
    assert "Carol" in feed_entries[0]["message"]


# ── test_event1_gives_random_if_already_has_chef_hat ─────────────────────────

def test_event1_gives_random_if_already_has_chef_hat():
    """If player already owns a Chef Hat, event1 gives a random reward instead."""
    _make_profile("ev7", "Grace")
    _make_partner_dino("ev7", "trex", xp=0, level=1)

    # Pre-give the player a Chef Hat
    put_item({
        "PK": "PLAYER#ev7",
        "SK": "ITEM#existing-chef-hat",
        "type": "hat",
        "name": "Chef Hat",
        "details": {"hat_id": "chef_hat", "rarity": "common"},
    })

    with patch("src.handlers.scan_event.broadcast"):
        resp = handler(_event("event1", {"player_id": "ev7"}), None)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["claimed"] is True

    # Should NOT be a chef hat — should be a random reward
    item = body["item"]
    assert item["type"] in ("hat", "paint")
    if item["type"] == "hat":
        assert item["hat_id"] != "chef_hat"


# ── test_invalid_event_type ───────────────────────────────────────────────────

def test_invalid_event_type():
    _make_profile("ev4", "Dave")

    resp = handler(_event("not_a_real_event", {"player_id": "ev4"}), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "Unknown event type" in body["error"]


# ── test_event_requires_player_id ─────────────────────────────────────────────

def test_event_requires_player_id():
    resp = handler(_event("event1", {}), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "player_id" in body["error"]


# ── test_event_without_partner_dino ───────────────────────────────────────────

def test_event_without_partner_dino():
    """Event cannot be claimed without a partner dino — tells player to come back."""
    _make_profile("ev5", "Eve")
    # No dino

    resp = handler(_event("event3", {"player_id": "ev5"}), None)

    assert resp["statusCode"] == 403
    body = json.loads(resp["body"])
    assert "dinosaur partner" in body["error"]

    # Event should NOT be claimed — player can come back later
    claim = get_item("EVENT#ev5", "event3")
    assert claim is None
    items = query_pk("PLAYER#ev5", "ITEM#")
    assert len(items) == 0


# ── test_different_event_types_independent ────────────────────────────────────

def test_different_event_types_are_independent():
    """Same player can claim different event types separately."""
    _make_profile("ev6", "Frank")
    _make_partner_dino("ev6", "ankylosaurus", xp=0, level=1)

    with patch("src.handlers.scan_event.broadcast"):
        r1 = handler(_event("event1", {"player_id": "ev6"}), None)
        r2 = handler(_event("event2", {"player_id": "ev6"}), None)

    assert json.loads(r1["body"])["claimed"] is True
    assert json.loads(r2["body"])["claimed"] is True

    # Two items in inventory
    items = query_pk("PLAYER#ev6", "ITEM#")
    assert len(items) == 2

    # Dino gained 50 XP total (25 + 25)
    dino = get_item("PLAYER#ev6", "DINO#ankylosaurus")
    assert int(dino["xp"]) == 50
