import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from ..shared.db import get_item, put_item, query_pk, get_table, get_connections_table
from ..shared.response import success, error
from ..shared.ws_broadcast import broadcast


def _to_int(val):
    """Convert Decimal or other numeric to int."""
    if isinstance(val, Decimal):
        return int(val)
    return int(val) if val is not None else 0


def _post_feed_entry(entry_type, message, player_name=""):
    """Write a feed entry and broadcast it."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        uid = str(uuid.uuid4())[:8]
        sk = f"{now}#{uid}"

        put_item({
            "PK": "FEED",
            "SK": sk,
            "type": entry_type,
            "message": message,
            "player_name": player_name,
            "details": "",
        })

        broadcast("feed", "new_entry", {
            "id": sk,
            "type": entry_type,
            "message": message,
            "player_name": player_name,
            "timestamp": now,
        })
        return sk
    except Exception:
        return None


def buildup_handler(event, context):
    """POST /admin/boss/buildup — Trigger next buildup phase."""
    body = json.loads(event.get("body") or "{}")
    phase = body.get("phase")

    if phase is None:
        return error("phase is required (1, 2, or 3)")

    phase = int(phase)

    phase_config = {
        1: {
            "type": "shadows",
            "message": "Something massive stirs in the darkness... shadows loom over the plaza.",
        },
        2: {
            "type": "tremors",
            "message": "The ground trembles beneath your feet. The dinos are restless!",
        },
        3: {
            "type": "roar",
            "message": "A deafening ROOOOAR shakes the earth. GODZILLA IS COMING!",
        },
    }

    if phase not in phase_config:
        return error("phase must be 1, 2, or 3")

    cfg = phase_config[phase]

    # Broadcast buildup event on plaza channel (global overlay)
    broadcast("plaza", "buildup", {
        "phase": phase,
        "type": cfg["type"],
    })

    # Also post to feed
    _post_feed_entry("boss_buildup", cfg["message"])

    return success({
        "phase": phase,
        "type": cfg["type"],
        "message": cfg["message"],
    })


def start_handler(event, context):
    """POST /admin/boss/start — Start the boss fight."""
    # Count active players by scanning for PROFILE items
    # We'll do a scan of PLAYER profiles via query on known players
    # Use a simple estimate: scan the connections table for player count
    # or just count all FEED/PLAYER records. Using connections as proxy.
    try:
        connections = get_connections_table().scan().get("Items", [])
        player_count = max(len(connections), 1)
    except Exception:
        player_count = 5  # fallback

    hp = player_count * 300
    max_hp = hp

    # Create/overwrite BOSS#STATE
    boss_state = {
        "PK": "BOSS",
        "SK": "STATE",
        "hp": hp,
        "max_hp": max_hp,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    put_item(boss_state)

    # Broadcast boss_start to all channels
    broadcast("all", "boss_start", {
        "hp": hp,
        "max_hp": max_hp,
        "status": "active",
    })

    # Also send on boss channel specifically
    broadcast("boss", "boss_start", {
        "hp": hp,
        "max_hp": max_hp,
        "status": "active",
    })

    # Post to feed
    _post_feed_entry(
        "boss_start",
        "GODZILLA IS ATTACKING THE PLAZA! Fight back — tap to deal damage!",
    )

    return success({
        "hp": hp,
        "max_hp": max_hp,
        "status": "active",
        "player_count": player_count,
    })


def announce_handler(event, context):
    """POST /admin/announce — Post an announcement to the feed."""
    body = json.loads(event.get("body") or "{}")
    message = body.get("message", "").strip()

    if not message:
        return error("message is required")

    feed_id = _post_feed_entry("announcement", message)

    return success({"message": message, "feed_id": feed_id})


def dashboard_handler(event, context):
    """GET /admin/dashboard — Get stats including player list."""
    try:
        # Count players (scan for PROFILE SKs)
        table = get_table()

        # We'll do targeted queries; for a real app we'd use a GSI
        # For now, scan and count is acceptable for an admin endpoint
        resp = table.scan(
            FilterExpression="SK = :sk",
            ExpressionAttributeValues={":sk": "PROFILE"},
        )
        profile_items = resp.get("Items", [])
        player_count = len(profile_items)

        # Count tamed dinos (also gather per-player counts)
        dino_resp = table.scan(
            FilterExpression="begins_with(SK, :prefix) AND tamed = :t",
            ExpressionAttributeValues={":prefix": "DINO#", ":t": True},
        )
        tamed_dinos = dino_resp.get("Items", [])
        dino_count = len(tamed_dinos)

        # Build per-player dino count map
        player_dino_counts = {}
        for dino in tamed_dinos:
            pk = dino.get("PK", "")
            if pk.startswith("PLAYER#"):
                pid = pk[len("PLAYER#"):]
                player_dino_counts[pid] = player_dino_counts.get(pid, 0) + 1

        # Count feed entries
        feed_items = query_pk("FEED")
        feed_count = len(feed_items)

        # Get boss state
        boss = get_item("BOSS", "STATE")
        boss_info = None
        if boss:
            boss_info = {
                "hp": _to_int(boss.get("hp", 0)),
                "max_hp": _to_int(boss.get("max_hp", 0)),
                "status": boss.get("status", "waiting"),
            }

        # Build player list with dino counts
        players = []
        for item in profile_items:
            pk = item.get("PK", "")
            if pk.startswith("PLAYER#"):
                pid = pk[len("PLAYER#"):]
                players.append({
                    "id": pid,
                    "name": item.get("name", "Unknown"),
                    "dino_count": player_dino_counts.get(pid, 0),
                })
        # Sort by name for consistent ordering
        players.sort(key=lambda p: p["name"].lower())

    except Exception as e:
        return error(f"Dashboard query failed: {str(e)}", 500)

    return success({
        "players": player_count,
        "dinos_tamed": dino_count,
        "feed_entries": feed_count,
        "boss": boss_info,
        "player_list": players,
    })


def handler(event, context):
    """Route admin endpoints."""
    path = event.get("resource", event.get("path", ""))
    method = event.get("httpMethod", "")

    if method == "POST":
        if path.endswith("/boss/buildup"):
            return buildup_handler(event, context)
        if path.endswith("/boss/start"):
            return start_handler(event, context)
        if path.endswith("/announce"):
            return announce_handler(event, context)

    if method == "GET":
        if path.endswith("/dashboard"):
            return dashboard_handler(event, context)

    return error("Not found", 404)
