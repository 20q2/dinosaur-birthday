import json
import uuid
from datetime import datetime, timezone
from ..shared.db import get_item, put_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import random_hat
from ..shared.xp import award_xp
from ..shared.ws_broadcast import broadcast

VALID_EVENT_TYPES = {
    "cooking_pot",
    "dance_floor",
    "photo_booth",
    "cake_table",
    "mystery_chest",
}


def handler(event, context):
    """POST /scan/event/{type} — Claim a party event reward (once per player)."""
    event_type = event["pathParameters"]["type"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")
    description = body.get("description", "")

    if not player_id:
        return error("player_id is required")

    if event_type not in VALID_EVENT_TYPES:
        return error(f"Unknown event type: {event_type}")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # Check once-per-player
    existing = get_item(f"EVENT#{player_id}", event_type)
    if existing:
        return success({"already_claimed": True, "event_type": event_type})

    # Award 25 XP to partner dino
    dino_result = award_xp(player_id, 25)

    # Award random hat to player inventory
    hat = random_hat()
    item_id = str(uuid.uuid4())
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "hat",
        "name": hat["name"],
        "details": {"hat_id": hat["id"], "rarity": hat["rarity"]},
    })

    # Mark as claimed
    put_item({
        "PK": f"EVENT#{player_id}",
        "SK": event_type,
        "player_id": player_id,
        "event_type": event_type,
        "claimed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Post to feed
    try:
        player_name = profile.get("name", "Someone")
        event_label = event_type.replace("_", " ").title()
        if description:
            feed_message = f"{player_name} {description}"
        else:
            feed_message = f"{player_name} visited the {event_label}!"

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "event",
            "message": feed_message,
            "player_name": player_name,
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "event",
            "message": feed_message,
            "player_name": player_name,
            "timestamp": ts,
        })
    except Exception:
        pass

    return success({
        "claimed": True,
        "event_type": event_type,
        "xp_awarded": 25,
        "dino": dino_result,
        "item": {
            "type": "hat",
            "name": hat["name"],
            "hat_id": hat["id"],
            "rarity": hat["rarity"],
        },
    })
