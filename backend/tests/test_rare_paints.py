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
