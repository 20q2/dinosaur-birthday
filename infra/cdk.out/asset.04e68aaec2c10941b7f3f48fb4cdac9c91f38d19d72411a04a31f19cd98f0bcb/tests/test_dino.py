import json
import pytest
from src.handlers.dino import customize_handler, partner_handler
from src.shared.db import get_item, put_item, query_pk


# ── helpers ─────────────────────────────────────────────────────────────────

def _customize_event(species, body):
    return {
        "httpMethod": "PUT",
        "resource": f"/dino/{species}/customize",
        "pathParameters": {"species": species},
        "body": json.dumps(body),
    }


def _partner_event(species, body):
    return {
        "httpMethod": "PUT",
        "resource": f"/dino/{species}/partner",
        "pathParameters": {"species": species},
        "body": json.dumps(body),
    }


def _make_dino(player_id, species, tamed=True, is_partner=False, name="", hat=""):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "name": name,
        "colors": {"body": 120, "belly": 60, "stripes": 200},
        "gender": "female",
        "nature": "Jolly",
        "hat": hat,
        "xp": 50,
        "level": 1,
        "is_partner": is_partner,
        "tamed": tamed,
        "shiny": False,
    })


def _make_profile(player_id, player_name="Tester"):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": "PROFILE",
        "name": player_name,
        "photo_url": "",
    })


# ── customize: rename ────────────────────────────────────────────────────────

def test_customize_rename_dino():
    _make_profile("p1")
    _make_dino("p1", "trex", tamed=True, name="Old Name")

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p1", "name": "Chomp"}),
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["name"] == "Chomp"

    saved = get_item("PLAYER#p1", "DINO#trex")
    assert saved["name"] == "Chomp"


# ── customize: equip hat ─────────────────────────────────────────────────────

def test_customize_equip_hat():
    _make_profile("p2")
    _make_dino("p2", "ankylosaurus", tamed=True, hat="")

    resp = customize_handler(
        _customize_event("ankylosaurus", {"player_id": "p2", "hat": "party_hat"}),
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["hat"] == "party_hat"

    saved = get_item("PLAYER#p2", "DINO#ankylosaurus")
    assert saved["hat"] == "party_hat"


# ── customize: reject unknown species ────────────────────────────────────────

def test_customize_reject_unknown_species():
    _make_profile("p3")

    resp = customize_handler(
        _customize_event("dragon", {"player_id": "p3", "name": "Puff"}),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "Unknown species" in body["error"]


# ── customize: reject unknown hat ────────────────────────────────────────────

def test_customize_reject_unknown_hat():
    _make_profile("p4")
    _make_dino("p4", "trex", tamed=True)

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p4", "hat": "baseball_cap"}),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "Unknown hat" in body["error"]


# ── customize: reject if player doesn't own the dino ─────────────────────────

def test_customize_reject_unowned_dino():
    _make_profile("p5")
    # intentionally do NOT create a dino for p5

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p5", "name": "Ghost"}),
        None,
    )
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert "don't own" in body["error"]


# ── partner: sets is_partner and creates plaza entry ─────────────────────────

def test_set_partner_creates_plaza_entry():
    _make_profile("p6", "Alice")
    _make_dino("p6", "triceratops", tamed=True, is_partner=False)

    resp = partner_handler(
        _partner_event("triceratops", {"player_id": "p6"}),
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["is_partner"] is True
    assert body["species"] == "triceratops"

    plaza = get_item("PLAZA", "PARTNER#p6")
    assert plaza is not None
    assert plaza["species"] == "triceratops"
    assert plaza["owner_name"] == "Alice"


# ── partner: unsets old partner when changing ────────────────────────────────

def test_set_partner_unsets_old_partner():
    _make_profile("p7", "Bob")
    _make_dino("p7", "trex", tamed=True, is_partner=True, name="Rex")
    _make_dino("p7", "spinosaurus", tamed=True, is_partner=False, name="Spine")

    resp = partner_handler(
        _partner_event("spinosaurus", {"player_id": "p7"}),
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["is_partner"] is True

    # Old partner should be unset
    old = get_item("PLAYER#p7", "DINO#trex")
    assert old["is_partner"] is False

    # New partner should be set
    new = get_item("PLAYER#p7", "DINO#spinosaurus")
    assert new["is_partner"] is True

    # Plaza entry should reflect new partner
    plaza = get_item("PLAZA", "PARTNER#p7")
    assert plaza["species"] == "spinosaurus"


# ── partner: reject untamed dino ─────────────────────────────────────────────

def test_set_partner_reject_untamed():
    _make_profile("p8")
    _make_dino("p8", "parasaurolophus", tamed=False)

    resp = partner_handler(
        _partner_event("parasaurolophus", {"player_id": "p8"}),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "tamed" in body["error"]


# ── customize: apply paint consumes inventory item ───────────────────────────

def test_customize_paint_consumes_item():
    _make_profile("p9")
    _make_dino("p9", "trex", tamed=True)

    # Give player a paint item
    put_item({
        "PK": "PLAYER#p9",
        "SK": "ITEM#paint001",
        "type": "paint",
        "name": "Red Paint",
        "details": {},
    })

    resp = customize_handler(
        _customize_event("trex", {
            "player_id": "p9",
            "paint": {"region": "body", "color": 0},
        }),
        None,
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["colors"]["body"] == 0

    # Paint item should be consumed
    consumed = get_item("PLAYER#p9", "ITEM#paint001")
    assert consumed is None


# ── customize: paint requires inventory item ──────────────────────────────────

def test_customize_paint_requires_inventory():
    _make_profile("p10")
    _make_dino("p10", "trex", tamed=True)
    # No paint items in inventory

    resp = customize_handler(
        _customize_event("trex", {
            "player_id": "p10",
            "paint": {"region": "body", "color": 45},
        }),
        None,
    )
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "paint" in body["error"].lower()
