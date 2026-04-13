import json
import uuid
from datetime import datetime, timezone
from ..shared.db import get_item, put_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import EXPLORER_NOTES
from ..shared.rare_paints import grant_rare_paint
from ..shared.xp import award_xp
from ..shared.ws_broadcast import broadcast

NOTE_XP = 40


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

    # Require a tamed dino companion before notes can be claimed/viewed.
    # Notes are a reward for active players — a new guest with no dino would
    # waste the XP (no partner to receive it) and burn the note's one-time claim.
    dinos = query_pk(f"PLAYER#{player_id}", "DINO#")
    has_tamed_dino = any(d.get("tamed") for d in dinos)
    if not has_tamed_dino:
        return error(
            "This scroll refuses to unfurl... it seems to be waiting. Come back once you've befriended a dinosaur companion!",
            403,
        )

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

    # Award XP to partner dino
    dino_result = award_xp(player_id, NOTE_XP)

    # Count total notes found (including this one)
    found_notes = query_pk(f"PLAYER#{player_id}", "NOTE#")

    # Grant metallic rare paint on collecting all 5 notes
    if len(found_notes) == len(EXPLORER_NOTES):
        grant_rare_paint(player_id, "metallic")

    # Post to feed
    try:
        player_name = profile.get("name", "Someone")
        note_num = note_id.replace("note", "")
        feed_message = f"{player_name} discovered Explorer Note #{note_num}!"

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "note",
            "message": feed_message,
            "player_name": player_name,
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "note",
            "message": feed_message,
            "player_name": player_name,
            "timestamp": ts,
        })
    except Exception:
        pass

    return success({
        "found": True,
        "note_id": note_id,
        "note_text": note_text,
        "notes_found": len(found_notes),
        "notes_total": len(EXPLORER_NOTES),
        "xp_awarded": NOTE_XP,
        "dino": dino_result,
    })
