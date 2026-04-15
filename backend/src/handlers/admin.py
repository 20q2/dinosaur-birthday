import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from ..shared.db import get_item, put_item, query_pk, delete_item, get_table, get_connections_table
from ..shared.response import success, error
from ..shared.ws_broadcast import broadcast
from ..shared.game_data import (
    HATS, PAINTS, PAINT_MAP, SPECIES,
    random_colors, random_nature, random_gender, is_shiny,
)
from ..shared.rare_paints import grant_rare_paint, RARE_EFFECTS


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

    # Persist buildup phase in BOSS#STATE so late-joiners see the right state
    boss = get_item("BOSS", "STATE")
    if boss:
        get_table().update_item(
            Key={"PK": "BOSS", "SK": "STATE"},
            UpdateExpression="SET buildup_phase = :bp",
            ExpressionAttributeValues={":bp": phase},
        )
    else:
        put_item({
            "PK": "BOSS",
            "SK": "STATE",
            "status": "buildup",
            "buildup_phase": phase,
        })

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

    hp = player_count * 700
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

    # Broadcast boss_start to all connected clients
    broadcast("all", "boss_start", {
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


def stop_handler(event, context):
    """POST /admin/boss/stop — Reset boss fight to idle."""
    put_item({
        "PK": "BOSS",
        "SK": "STATE",
        "status": "idle",
        "buildup_phase": 0,
        "hp": 0,
        "max_hp": 0,
    })

    broadcast("all", "boss_stopped", {"status": "idle"})

    _post_feed_entry("boss_stop", "The boss fight has been called off. The city is safe... for now.")

    return success({"status": "idle"})


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
                "buildup_phase": _to_int(boss.get("buildup_phase", 0)),
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


def reset_player_handler(event, context):
    """DELETE /admin/reset?player_id=X — wipe a player's game data (keep PROFILE)."""
    params = event.get("queryStringParameters") or {}
    player_id = params.get("player_id", "").strip()

    if not player_id:
        return error("player_id is required")

    deleted = 0

    # Delete all PLAYER#{id} items except PROFILE
    player_items = query_pk(f"PLAYER#{player_id}")
    for item in player_items:
        sk = item.get("SK", "")
        if sk != "PROFILE":
            delete_item(f"PLAYER#{player_id}", sk)
            deleted += 1

    # Delete PLAZA entry for this player
    plaza_sk = f"PARTNER#{player_id}"
    plaza_item = get_item("PLAZA", plaza_sk)
    if plaza_item is not None:
        delete_item("PLAZA", plaza_sk)
        deleted += 1

    # Delete COOLDOWN items that contain the player_id
    cooldown_items = query_pk("COOLDOWN")
    for item in cooldown_items:
        sk = item.get("SK", "")
        if player_id in sk:
            delete_item("COOLDOWN", sk)
            deleted += 1

    return success({"deleted": deleted, "player_id": player_id})


def reset_all_handler(event, context):
    """DELETE /admin/reset-all — wipe the entire game table (keep PROFILEs)."""
    table = get_table()
    deleted = 0

    # Scan the entire table and delete everything except PROFILE items
    scan_kwargs = {}
    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get("Items", [])

        for item in items:
            sk = item.get("SK", "")
            if sk == "PROFILE":
                continue
            delete_item(item["PK"], sk)
            deleted += 1

        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return success({"deleted": deleted})


def nuke_all_handler(event, context):
    """DELETE /admin/nuke-all — delete EVERYTHING including player profiles."""
    table = get_table()
    deleted = 0

    scan_kwargs = {}
    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get("Items", [])

        for item in items:
            delete_item(item["PK"], item["SK"])
            deleted += 1

        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return success({"deleted": deleted})


def give_all_items_handler(event, context):
    """POST /admin/give-all-items — give a player one of every hat + 5 paints."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id", "").strip()

    if not player_id:
        return error("player_id is required")

    # Verify player exists
    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    created = 0

    # Give one of every hat
    for hat in HATS:
        item_id = str(uuid.uuid4())[:8]
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{item_id}",
            "type": "hat",
            "name": hat["name"],
            "details": {"hat_id": hat["id"], "rarity": hat["rarity"]},
        })
        created += 1

    # Give one of every standard paint
    for paint in PAINTS:
        item_id = str(uuid.uuid4())[:8]
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{item_id}",
            "type": "paint",
            "name": f"{paint['name']} Paint",
            "details": {"paint_id": paint["id"], "hue": paint["hue"]},
        })
        created += 1

    # Give all 4 rare paints (skip idempotency — debug tool)
    from ..shared.rare_paints import EFFECT_NAMES
    for effect in RARE_EFFECTS:
        # Only add if not already in inventory
        existing_items = query_pk(f"PLAYER#{player_id}", sk_prefix="ITEM#")
        has_effect = any(
            i.get("details", {}).get("effect") == effect for i in existing_items
        )
        if not has_effect:
            item_id = str(uuid.uuid4())[:8]
            put_item({
                "PK": f"PLAYER#{player_id}",
                "SK": f"ITEM#{item_id}",
                "type": "paint",
                "name": EFFECT_NAMES[effect],
                "details": {"effect": effect},
            })
            created += 1

    player_name = profile.get("name", "Unknown")
    _post_feed_entry("event", f"{player_name} received a treasure trove of items!")

    return success({"created": created, "player_id": player_id})


def give_item_handler(event, context):
    """POST /admin/give-item — give a player a specific hat or paint."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id", "").strip()
    item_type = body.get("type", "").strip()       # "hat" or "paint"
    item_id = body.get("item_id", "").strip()       # e.g. "cowboy_hat" or "crimson"

    if not player_id:
        return error("player_id is required")
    if item_type not in ("hat", "paint"):
        return error("type must be 'hat' or 'paint'")
    if not item_id:
        return error("item_id is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    uid = str(uuid.uuid4())[:8]

    if item_type == "hat":
        hat = next((h for h in HATS if h["id"] == item_id), None)
        if not hat:
            return error(f"Unknown hat: {item_id}")
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{uid}",
            "type": "hat",
            "name": hat["name"],
            "details": {"hat_id": hat["id"], "rarity": hat["rarity"]},
        })
    else:
        paint = PAINT_MAP.get(item_id)
        if not paint:
            return error(f"Unknown paint: {item_id}")
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{uid}",
            "type": "paint",
            "name": f"{paint['name']} Paint",
            "details": {"paint_id": paint["id"], "hue": paint["hue"]},
        })

    player_name = profile.get("name", "Unknown")
    return success({"item_type": item_type, "item_id": item_id, "player": player_name})


def give_dino_handler(event, context):
    """POST /admin/give-dino — give a player a tamed dino in one shot.

    Body params:
      player_id (str, required)
      species   (str, required)
      level     (int, optional, 1-5, default 1)
      shiny     (bool, optional, default random 5%)
      hat       (str, optional, hat_id — empty for none)
      name      (str, optional, custom name)
      colors    (dict, optional, pre-set colors)
      set_partner (bool, optional — if true, also make this the plaza partner)
    """
    body = json.loads(event.get("body") or "{}")
    player_id = (body.get("player_id") or "").strip()
    species   = (body.get("species") or "").strip()

    if not player_id:
        return error("player_id is required")
    if species not in SPECIES:
        return error(f"Unknown species: {species}")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # Normalize optional fields
    try:
        level = int(body.get("level") or 1)
    except (TypeError, ValueError):
        level = 1
    level = max(1, min(5, level))

    shiny_raw = body.get("shiny", None)
    if shiny_raw is None:
        shiny = is_shiny()
    else:
        shiny = bool(shiny_raw)

    hat = (body.get("hat") or "").strip()
    if hat and not any(h["id"] == hat for h in HATS):
        return error(f"Unknown hat: {hat}")

    name = (body.get("name") or "").strip()[:24]

    species_data = SPECIES[species]
    colors = body.get("colors")
    if not colors or not isinstance(colors, dict):
        colors = random_colors(species_data["regions"], shiny=shiny)

    gender = random_gender()
    nature = random_nature()
    xp = (level - 1) * 100  # place player at the start of their level

    # Preserve some existing fields if the dino already exists
    existing = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if existing:
        gender = existing.get("gender", gender)
        nature = existing.get("nature", nature)
        # Preserve partner status unless explicitly overridden later
        is_partner = bool(existing.get("is_partner", False))
    else:
        is_partner = False

    dino = {
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "hat": hat,
        "xp": xp,
        "level": level,
        "is_partner": is_partner,
        "tamed": True,
        "shiny": shiny,
        "name": name,
    }
    put_item(dino)

    # Optionally promote to partner (only if player has no current partner, or force)
    set_partner = bool(body.get("set_partner", False))
    if set_partner:
        # Clear previous partner flag on any other dino
        all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
        for d in all_dinos:
            if d.get("SK") != f"DINO#{species}" and d.get("is_partner"):
                update_from = d.get("SK")
                get_table().update_item(
                    Key={"PK": f"PLAYER#{player_id}", "SK": update_from},
                    UpdateExpression="SET is_partner = :f",
                    ExpressionAttributeValues={":f": False},
                )
        get_table().update_item(
            Key={"PK": f"PLAYER#{player_id}", "SK": f"DINO#{species}"},
            UpdateExpression="SET is_partner = :t",
            ExpressionAttributeValues={":t": True},
        )

        plaza_data = {
            "PK": "PLAZA",
            "SK": f"PARTNER#{player_id}",
            "species": species,
            "hat": hat,
            "colors": colors,
            "level": level,
            "name": name,
            "gender": gender,
            "shiny": shiny,
            "owner_name": profile.get("name", ""),
            "owner_photo": profile.get("photo_url", ""),
        }
        put_item(plaza_data)
        try:
            broadcast("plaza", "dino_arrive", {
                "player_id": player_id,
                "species": species,
                "name": name,
                "hat": hat,
                "colors": colors,
                "level": level,
                "shiny": shiny,
                "owner_name": profile.get("name", ""),
                "owner_photo": profile.get("photo_url", ""),
            })
        except Exception:
            pass

    player_name = profile.get("name", "Unknown")
    display_name = name or species_data["name"]
    shiny_tag = "✨SHINY✨ " if shiny else ""
    _post_feed_entry(
        "tamed",
        f"{player_name} received {shiny_tag}{display_name} (Lv {level})!",
        player_name,
    )

    return success({
        "species": species,
        "level": level,
        "shiny": shiny,
        "hat": hat,
        "name": name,
        "colors": colors,
        "tamed": True,
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
        if path.endswith("/boss/stop"):
            return stop_handler(event, context)
        if path.endswith("/announce"):
            return announce_handler(event, context)
        if path.endswith("/give-all-items"):
            return give_all_items_handler(event, context)
        if path.endswith("/give-item"):
            return give_item_handler(event, context)
        if path.endswith("/give-dino"):
            return give_dino_handler(event, context)

    if method == "GET":
        if path.endswith("/dashboard"):
            return dashboard_handler(event, context)

    if method == "DELETE":
        if path.endswith("/nuke-all"):
            return nuke_all_handler(event, context)
        # Check reset-all BEFORE reset since reset-all path also ends with "reset"
        if path.endswith("/reset-all"):
            return reset_all_handler(event, context)
        if path.endswith("/reset"):
            return reset_player_handler(event, context)

    return error("Not found", 404)
