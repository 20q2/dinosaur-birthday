import json
import uuid
from datetime import datetime, timezone
from ..shared.db import get_item, put_item
from ..shared.response import success, error
from ..shared.xp import award_xp
from ..shared.ws_broadcast import broadcast

BLESSING_HAT = {"id": "birthday_blessing", "name": "Birthday Balloons", "rarity": "legendary"}


def handler(event, context):
    """POST /scan/inspiration — Alex's Inspiration QR (once per player)."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # Check once-per-player
    existing = get_item(f"PLAYER#{player_id}", "INSPIRATION")
    if existing:
        return success({
            "already_received": True,
            "item": {
                "type": "hat",
                "name": BLESSING_HAT["name"],
                "hat_id": BLESSING_HAT["id"],
                "rarity": BLESSING_HAT["rarity"],
            },
        })

    # Award 50 XP to partner dino
    dino_result = award_xp(player_id, 50)

    # Award Birthday Girl's Blessing hat
    item_id = str(uuid.uuid4())
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "hat",
        "name": BLESSING_HAT["name"],
        "details": {"hat_id": BLESSING_HAT["id"], "rarity": BLESSING_HAT["rarity"]},
    })

    # Mark as received
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": "INSPIRATION",
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    # Post to feed
    try:
        player_name = profile.get("name", "Someone")
        feed_message = f"Alex blessed {player_name} with Inspiration! ✨"

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "inspiration",
            "message": feed_message,
            "player_name": player_name,
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "inspiration",
            "message": feed_message,
            "player_name": player_name,
            "timestamp": ts,
        })
    except Exception:
        pass

    return success({
        "claimed": True,
        "xp_awarded": 50,
        "dino": dino_result,
        "item": {
            "type": "hat",
            "name": BLESSING_HAT["name"],
            "hat_id": BLESSING_HAT["id"],
            "rarity": BLESSING_HAT["rarity"],
        },
    })
