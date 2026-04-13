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


def _give_tamed_dino(player_id, species="trex"):
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "name": species.title(),
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


# ── test_find_note_returns_text ───────────────────────────────────────────────

def test_find_note_returns_text():
    _make_profile("nt1", "Kim")
    _give_tamed_dino("nt1")

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
    _give_tamed_dino("nt2")

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
    _give_tamed_dino("nt3")

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


# ── test_note_requires_tamed_dino ─────────────────────────────────────────────

def test_note_requires_tamed_dino():
    """A player with no tamed dino cannot claim a note (and it isn't consumed)."""
    _make_profile("nt_nodino", "Rookie")

    resp = handler(_event("note1", {"player_id": "nt_nodino"}), None)
    assert resp["statusCode"] == 403
    body = json.loads(resp["body"])
    assert "companion" in body["error"].lower()

    # Note was NOT written — they can come back and claim it later
    assert get_item("PLAYER#nt_nodino", "NOTE#note1") is None


def test_untamed_dino_does_not_count():
    """An untamed (wild-encountered) dino doesn't unlock notes."""
    _make_profile("nt_wild", "Sage")
    put_item({
        "PK": "PLAYER#nt_wild",
        "SK": "DINO#trex",
        "name": "Trex",
        "tamed": False,
        "is_partner": False,
    })

    resp = handler(_event("note1", {"player_id": "nt_wild"}), None)
    assert resp["statusCode"] == 403


# ── test_xp_awarded_for_notes ─────────────────────────────────────────────────

def test_xp_awarded_for_notes():
    """Discovering a new note awards 40 XP to partner dino."""
    _make_profile("nt5", "Oscar")
    _give_tamed_dino("nt5")

    resp = handler(_event("note3", {"player_id": "nt5"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["xp_awarded"] == 40
    assert body["dino"]["species"] == "trex"

    # Dino XP should be 40
    dino = get_item("PLAYER#nt5", "DINO#trex")
    assert int(dino["xp"]) == 40


# ── test_no_xp_on_rescan ─────────────────────────────────────────────────────

def test_no_xp_on_rescan():
    """Rescanning an already-found note does not award XP again."""
    _make_profile("nt7", "Quinn")
    _give_tamed_dino("nt7")

    handler(_event("note1", {"player_id": "nt7"}), None)
    handler(_event("note1", {"player_id": "nt7"}), None)

    dino = get_item("PLAYER#nt7", "DINO#trex")
    assert int(dino["xp"]) == 40  # only once


# ── test_all_five_notes_findable ─────────────────────────────────────────────

def test_all_five_notes_findable():
    _make_profile("nt6", "Penny")
    _give_tamed_dino("nt6")

    for note_id, text in EXPLORER_NOTES.items():
        resp = handler(_event(note_id, {"player_id": "nt6"}), None)
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["note_text"] == text

    notes = query_pk("PLAYER#nt6", "NOTE#")
    assert len(notes) == 5
