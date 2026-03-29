import json
import pytest
from src.shared.db import get_item, put_item, query_pk
from src.shared.rare_paints import grant_rare_paint


def _make_profile(player_id, name="Tester"):
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name, "photo_url": ""})


def test_grant_rare_paint_creates_item_and_claim():
    _make_profile("p1")
    item = grant_rare_paint("p1", "rainbow")
    assert item is not None
    assert item["details"]["effect"] == "rainbow"
    assert item["name"] == "Rainbow Paint"
    # Item in inventory
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    assert any(i.get("details", {}).get("effect") == "rainbow" for i in items)
    # Claim record written
    claim = get_item("PLAYER#p1", "RARE_PAINT_rainbow")
    assert claim is not None


def test_grant_rare_paint_idempotent():
    _make_profile("p1")
    first = grant_rare_paint("p1", "rainbow")
    second = grant_rare_paint("p1", "rainbow")
    assert first is not None
    assert second is None  # already claimed
    # Only one item in inventory
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    rainbow = [i for i in items if i.get("details", {}).get("effect") == "rainbow"]
    assert len(rainbow) == 1


def test_grant_different_effects_are_independent():
    _make_profile("p1")
    grant_rare_paint("p1", "rainbow")
    grant_rare_paint("p1", "metallic")
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    effects = {i.get("details", {}).get("effect") for i in items}
    assert "rainbow" in effects
    assert "metallic" in effects


from unittest.mock import patch
from src.handlers.scan_inspiration import handler as inspiration_handler


def _inspiration_event(body):
    return {"httpMethod": "POST", "body": json.dumps(body)}


def _make_partner_dino(player_id, species="trex"):
    put_item({
        "PK": f"PLAYER#{player_id}", "SK": f"DINO#{species}",
        "name": "", "colors": {}, "gender": "female", "nature": "Jolly",
        "hat": "", "xp": 0, "level": 1, "is_partner": True, "tamed": True, "shiny": False,
    })


def test_inspiration_grants_rainbow_paint():
    _make_profile("p1")
    _make_partner_dino("p1")
    with patch("src.handlers.scan_inspiration.broadcast"):
        resp = inspiration_handler(_inspiration_event({"player_id": "p1"}), None)
    assert resp["statusCode"] == 200
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    assert any(i.get("details", {}).get("effect") == "rainbow" for i in items)


def test_inspiration_rainbow_not_granted_twice():
    _make_profile("p1")
    _make_partner_dino("p1")
    with patch("src.handlers.scan_inspiration.broadcast"):
        inspiration_handler(_inspiration_event({"player_id": "p1"}), None)
        inspiration_handler(_inspiration_event({"player_id": "p1"}), None)  # already received
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    rainbow = [i for i in items if i.get("details", {}).get("effect") == "rainbow"]
    assert len(rainbow) == 1


from src.handlers.scan_note import handler as note_handler
from src.shared.game_data import EXPLORER_NOTES


def _note_event(note_id, body):
    return {"httpMethod": "POST", "pathParameters": {"note_id": note_id}, "body": json.dumps(body)}


def test_metallic_granted_on_5th_note():
    _make_profile("p1")
    note_ids = list(EXPLORER_NOTES.keys())  # 5 notes
    for i, note_id in enumerate(note_ids):
        resp = note_handler(_note_event(note_id, {"player_id": "p1"}), None)
        assert resp["statusCode"] == 200
        items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
        has_metallic = any(i.get("details", {}).get("effect") == "metallic" for i in items)
        if i < 4:
            assert not has_metallic, f"Should not have metallic after note {i+1}"
        else:
            assert has_metallic, "Should have metallic after 5th note"


def test_metallic_not_granted_twice():
    _make_profile("p1")
    note_ids = list(EXPLORER_NOTES.keys())
    for note_id in note_ids:
        note_handler(_note_event(note_id, {"player_id": "p1"}), None)
    # Collect all notes a second time (already_found path)
    for note_id in note_ids:
        note_handler(_note_event(note_id, {"player_id": "p1"}), None)
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    metallic = [i for i in items if i.get("details", {}).get("effect") == "metallic"]
    assert len(metallic) == 1
