import json
from ..shared.db import get_item, put_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import EXPLORER_NOTES


def handler(event, context):
    """POST /scan/note/{note_id} — Discover an explorer's note (once per player)."""
    note_id = event["pathParameters"]["note_id"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    if note_id not in EXPLORER_NOTES:
        return error(f"Unknown note: {note_id}", 404)

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    note_text = EXPLORER_NOTES[note_id]

    # Check once-per-player (but still show the note if already found)
    existing = get_item(f"PLAYER#{player_id}", f"NOTE#{note_id}")
    if existing:
        # Count total notes found
        found_notes = query_pk(f"PLAYER#{player_id}", "NOTE#")
        return success({
            "already_found": True,
            "note_id": note_id,
            "note_text": note_text,
            "notes_found": len(found_notes),
            "notes_total": len(EXPLORER_NOTES),
        })

    # Write the note to player's record
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"NOTE#{note_id}",
        "note_id": note_id,
    })

    # Count total notes found (including this one)
    found_notes = query_pk(f"PLAYER#{player_id}", "NOTE#")

    return success({
        "found": True,
        "note_id": note_id,
        "note_text": note_text,
        "notes_found": len(found_notes),
        "notes_total": len(EXPLORER_NOTES),
    })
