import json
from src.handlers.scan_note import handler
from src.shared.db import put_item, get_item, query_pk
from src.shared.game_data import EXPLORER_NOTES


def _event(note_id, body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"note_id": note_id},
        "body": json.dumps(body),
    }


def _make_profile(player_id, name="Tester"):
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name})


# ── test_find_note_returns_text ───────────────────────────────────────────────

def test_find_note_returns_text():
    _make_profile("nt1", "Kim")

    resp = handler(_event("note1", {"player_id": "nt1"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["found"] is True
    assert body["note_id"] == "note1"
    assert body["note_text"] == EXPLORER_NOTES["note1"]
    assert body["notes_found"] == 1
    assert body["notes_total"] == 5


# ── test_note_once_per_player_shows_text_again ────────────────────────────────

def test_note_once_per_player_shows_text_again():
    _make_profile("nt2", "Leo")

    resp1 = handler(_event("note2", {"player_id": "nt2"}), None)
    assert json.loads(resp1["body"])["found"] is True

    # Second scan — already_found but still returns text
    resp2 = handler(_event("note2", {"player_id": "nt2"}), None)
    assert resp2["statusCode"] == 200
    body2 = json.loads(resp2["body"])
    assert body2["already_found"] is True
    assert body2["note_text"] == EXPLORER_NOTES["note2"]


# ── test_note_count_accumulates ───────────────────────────────────────────────

def test_note_count_accumulates():
    _make_profile("nt3", "Mia")

    for i in range(1, 4):
        resp = handler(_event(f"note{i}", {"player_id": "nt3"}), None)
        body = json.loads(resp["body"])
        assert body["notes_found"] == i

    # Verify 3 NOTE# records exist
    notes = query_pk("PLAYER#nt3", "NOTE#")
    assert len(notes) == 3


# ── test_invalid_note_id ──────────────────────────────────────────────────────

def test_invalid_note_id():
    _make_profile("nt4", "Nora")

    resp = handler(_event("note99", {"player_id": "nt4"}), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert "Unknown note" in body["error"]


# ── test_note_requires_player_id ─────────────────────────────────────────────

def test_note_requires_player_id():
    resp = handler(_event("note1", {}), None)
    assert resp["statusCode"] == 400
    body = json.loads(resp["body"])
    assert "player_id" in body["error"]


# ── test_note_player_not_found ────────────────────────────────────────────────

def test_note_player_not_found():
    resp = handler(_event("note1", {"player_id": "ghost_player_note"}), None)
    assert resp["statusCode"] == 404


# ── test_no_xp_awarded ────────────────────────────────────────────────────────

def test_no_xp_awarded_for_notes():
    """Notes give no XP — pure flavor."""
    _make_profile("nt5", "Oscar")
    put_item({
        "PK": "PLAYER#nt5",
        "SK": "DINO#trex",
        "name": "Trex",
        "colors": {"body": 100},
        "gender": "male",
        "nature": "Bold",
        "hat": "",
        "xp": 0,
        "level": 1,
        "is_partner": True,
        "tamed": True,
        "shiny": False,
    })

    resp = handler(_event("note3", {"player_id": "nt5"}), None)
    assert resp["statusCode"] == 200

    # Dino XP should be unchanged
    dino = get_item("PLAYER#nt5", "DINO#trex")
    assert int(dino["xp"]) == 0


# ── test_all_five_notes_findable ─────────────────────────────────────────────

def test_all_five_notes_findable():
    _make_profile("nt6", "Penny")

    for note_id, text in EXPLORER_NOTES.items():
        resp = handler(_event(note_id, {"player_id": "nt6"}), None)
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["note_text"] == text

    notes = query_pk("PLAYER#nt6", "NOTE#")
    assert len(notes) == 5
