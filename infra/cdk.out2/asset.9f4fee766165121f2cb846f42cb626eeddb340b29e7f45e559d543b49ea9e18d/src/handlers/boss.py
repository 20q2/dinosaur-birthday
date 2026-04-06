import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from ..shared.db import get_item, put_item, query_pk, get_table
from ..shared.response import success, error
from ..shared.ws_broadcast import broadcast


def _to_int(val):
    """Convert Decimal or other numeric to int."""
    if isinstance(val, Decimal):
        return int(val)
    return int(val) if val is not None else 0


def tap_handler(event, context):
    """POST /boss/tap — Submit tap damage during boss fight."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    # Check that boss is active
    boss = get_item("BOSS", "STATE")
    if not boss:
        return error("No boss fight active", 404)

    if boss.get("status") != "active":
        return error(f"Boss fight is not active (status: {boss.get('status')})", 400)

    # Calculate damage: base 5 + sum of all tamed dino levels
    dinos = query_pk(f"PLAYER#{player_id}", "DINO#")
    total_levels = sum(_to_int(d.get("level", 1)) for d in dinos if d.get("tamed"))
    damage = 5 + total_levels

    # Atomically decrement HP using a conditional update
    table = get_table()
    current_hp = _to_int(boss.get("hp", 0))

    if current_hp <= 0:
        return error("Boss is already defeated", 400)

    # Clamp damage so HP doesn't go below 0
    actual_damage = min(damage, current_hp)
    new_hp = current_hp - actual_damage

    # Update boss HP in DynamoDB
    table.update_item(
        Key={"PK": "BOSS", "SK": "STATE"},
        UpdateExpression="SET hp = :new_hp",
        ExpressionAttributeValues={":new_hp": new_hp},
    )

    # Broadcast hp_update to all connected clients
    hp_data = {
        "hp": new_hp,
        "max_hp": _to_int(boss.get("max_hp", current_hp)),
        "damage": actual_damage,
        "attacker": player_id,
    }
    broadcast("all", "hp_update", hp_data)
    broadcast("boss", "hp_update", hp_data)

    # Check for defeat
    if new_hp <= 0:
        # Set status to defeated
        table.update_item(
            Key={"PK": "BOSS", "SK": "STATE"},
            UpdateExpression="SET #s = :defeated",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":defeated": "defeated"},
        )

        # Award "Kaiju Slayer" hat to ALL players
        _award_kaiju_slayer_hat_all()

        # Post feed entry
        _post_feed_entry(
            "boss_defeated",
            "GODZILLA HAS BEEN DEFEATED! The city is saved!",
            player_id,
        )

        # Broadcast boss_defeated on all channels so every client receives it
        defeat_data = {
            "hp": 0,
            "max_hp": _to_int(boss.get("max_hp", current_hp)),
            "defeated_by": player_id,
        }
        broadcast("all", "boss_defeated", defeat_data)
        broadcast("boss", "boss_defeated", defeat_data)

    return success({
        "damage": actual_damage,
        "hp": new_hp,
        "max_hp": _to_int(boss.get("max_hp", current_hp)),
        "defeated": new_hp <= 0,
    })


def _award_kaiju_slayer_hat(player_id):
    """Award the Kaiju Slayer hat to a player's partner dino."""
    try:
        # Find the partner dino
        dinos = query_pk(f"PLAYER#{player_id}", "DINO#")
        for dino in dinos:
            if dino.get("is_partner") or dino.get("tamed"):
                species = dino["SK"].replace("DINO#", "")
                get_table().update_item(
                    Key={"PK": f"PLAYER#{player_id}", "SK": f"DINO#{species}"},
                    UpdateExpression="SET hat = :hat",
                    ExpressionAttributeValues={":hat": "kaiju_slayer"},
                )
                break
    except Exception:
        pass


def _award_kaiju_slayer_hat_all():
    """Award the Kaiju Slayer hat to every player's partner/tamed dino."""
    try:
        table = get_table()
        resp = table.scan(
            FilterExpression="SK = :sk",
            ExpressionAttributeValues={":sk": "PROFILE"},
        )
        for profile in resp.get("Items", []):
            pk = profile.get("PK", "")
            if not pk.startswith("PLAYER#"):
                continue
            player_id = pk.replace("PLAYER#", "")
            _award_kaiju_slayer_hat(player_id)
    except Exception:
        pass


def _post_feed_entry(entry_type, message, player_id=""):
    """Write a feed entry to DynamoDB."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        uid = str(uuid.uuid4())[:8]
        sk = f"{now}#{uid}"

        profile = get_item(f"PLAYER#{player_id}", "PROFILE") if player_id else None
        player_name = profile.get("name", "") if profile else ""

        put_item({
            "PK": "FEED",
            "SK": sk,
            "type": entry_type,
            "message": message,
            "player_name": player_name,
            "details": "",
        })

        # Broadcast new feed entry
        broadcast("feed", "new_entry", {
            "id": sk,
            "type": entry_type,
            "message": message,
            "player_name": player_name,
            "timestamp": now,
        })
    except Exception:
        pass


def state_handler(event, context):
    """GET /boss/state — Return current boss state (public)."""
    boss = get_item("BOSS", "STATE")
    if not boss:
        return success({"status": "idle", "buildup_phase": 0})

    return success({
        "status": boss.get("status", "idle"),
        "hp": _to_int(boss.get("hp", 0)),
        "max_hp": _to_int(boss.get("max_hp", 0)),
        "buildup_phase": _to_int(boss.get("buildup_phase", 0)),
    })


def handler(event, context):
    """Route boss endpoints."""
    path = event.get("resource", event.get("path", ""))
    method = event.get("httpMethod", "")

    if method == "POST" and path.endswith("/tap"):
        return tap_handler(event, context)

    if method == "GET" and path.endswith("/state"):
        return state_handler(event, context)

    return error("Not found", 404)
