import json
import uuid
from datetime import datetime, timezone
from ..shared.db import put_item, get_item, query_pk, update_item
from ..shared.response import success, error


def handler(event, context):
    method = event["httpMethod"]
    if method == "POST":
        return create_player(event)
    elif method == "GET":
        return get_player(event)
    elif method == "PUT":
        return update_player(event)
    return error("Method not allowed", 405)


def create_player(event):
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("id")
    name = body.get("name", "").strip()
    photo_url = body.get("photo_url", "")

    if not player_id or not name:
        return error("id and name are required")

    existing = get_item(f"PLAYER#{player_id}", "PROFILE")
    if existing:
        return success({"id": player_id, "name": existing["name"], "photo_url": existing.get("photo_url", "")})

    item = {
        "PK": f"PLAYER#{player_id}",
        "SK": "PROFILE",
        "name": name,
        "photo_url": photo_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    put_item(item)

    # Give every new player a starter Party Hat
    item_id = str(uuid.uuid4())[:8]
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "hat",
        "name": "Party Hat",
        "details": {"hat_id": "party_hat", "rarity": "common"},
    })

    return success({"id": player_id, "name": name, "photo_url": photo_url})


def update_player(event):
    player_id = event["pathParameters"]["id"]
    body = json.loads(event.get("body") or "{}")
    photo_url = body.get("photo_url")

    if photo_url is None:
        return error("photo_url is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    update_item(f"PLAYER#{player_id}", "PROFILE", {"photo_url": photo_url})
    return success({"id": player_id, "photo_url": photo_url})


def get_player(event):
    player_id = event["pathParameters"]["id"]
    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    all_items = query_pk(f"PLAYER#{player_id}")

    dinos = []
    items = []
    notes = []
    inspiration = False

    for item in all_items:
        sk = item["SK"]
        if sk.startswith("DINO#"):
            dinos.append({
                "species": sk.replace("DINO#", ""),
                "name": item.get("name", ""),
                "colors": item.get("colors", {}),
                "gender": item.get("gender", ""),
                "nature": item.get("nature", ""),
                "hat": item.get("hat", ""),
                "xp": item.get("xp", 0),
                "level": item.get("level", 1),
                "is_partner": item.get("is_partner", False),
                "tamed": item.get("tamed", False),
                "shiny": item.get("shiny", False),
                "background": item.get("background", ""),
            })
        elif sk.startswith("ITEM#"):
            items.append({
                "id": sk.replace("ITEM#", ""),
                "type": item.get("type", ""),
                "name": item.get("name", ""),
                "details": item.get("details", {}),
            })
        elif sk.startswith("NOTE#"):
            notes.append(sk.replace("NOTE#", ""))
        elif sk == "INSPIRATION":
            inspiration = True

    return success({
        "id": player_id,
        "name": profile["name"],
        "photo_url": profile.get("photo_url", ""),
        "dinos": dinos,
        "items": items,
        "notes": notes,
        "inspiration": inspiration,
    })
