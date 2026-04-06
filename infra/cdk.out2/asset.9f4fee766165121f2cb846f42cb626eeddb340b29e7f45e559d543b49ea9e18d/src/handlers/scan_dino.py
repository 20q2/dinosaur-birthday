import json
import uuid
from datetime import datetime, timezone
from ..shared.db import put_item, get_item, query_pk, update_item
from ..shared.response import success, error
from ..shared.game_data import SPECIES, random_colors, random_nature, random_gender, is_shiny
from ..shared.ws_broadcast import broadcast


def handler(event, context):
    species = event["pathParameters"]["species"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if species not in SPECIES:
        return error(f"Unknown species: {species}")
    if not player_id:
        return error("player_id is required")

    # Godzilla requires boss to be defeated
    if species == "godzilla":
        boss = get_item("BOSS", "STATE")
        if not boss or boss.get("status") != "defeated":
            return success({"not_available": True, "species": "godzilla"})

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    existing = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if existing:
        return success({
            "already_owned": True,
            "species": species,
            "tamed": existing.get("tamed", False),
            "name": existing.get("name", ""),
        })

    species_data = SPECIES[species]
    shiny = is_shiny()
    colors = random_colors(species_data["regions"], shiny=shiny)
    gender = random_gender()
    nature = random_nature()

    # Godzilla arrives pre-tamed; other dinos start wild
    is_godzilla = species == "godzilla"
    tamed = True if is_godzilla else False

    dino = {
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "hat": "",
        "xp": 0,
        "level": 1,
        "is_partner": False,
        "tamed": tamed,
        "shiny": shiny,
        "name": "",
    }
    put_item(dino)

    # Auto-set as partner if player has none (for pre-tamed godzilla)
    first_partner = False
    if is_godzilla:
        all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
        has_partner = any(d.get("is_partner") for d in all_dinos)
        if not has_partner:
            update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"is_partner": True})
            put_item({
                "PK": "PLAZA",
                "SK": f"PARTNER#{player_id}",
                "species": species,
                "hat": "",
                "colors": colors,
                "level": 1,
                "name": "",
                "gender": gender,
                "owner_name": profile.get("name", ""),
                "owner_photo": profile.get("photo_url", ""),
            })
            try:
                broadcast("plaza", "dino_arrive", {
                    "player_id": player_id,
                    "species": species,
                    "name": "",
                    "hat": "",
                    "colors": colors,
                    "level": 1,
                    "owner_name": profile.get("name", ""),
                    "owner_photo": profile.get("photo_url", ""),
                })
            except Exception:
                pass
            first_partner = True

    feed_msg = f"✨SHINY✨ {species_data['name']}" if shiny else species_data['name']
    if is_godzilla:
        feed_entry_message = f"{profile['name']} tamed {feed_msg}!"
    else:
        feed_entry_message = f"{profile['name']} encountered a wild {feed_msg}!"
    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "tamed" if is_godzilla else "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "tamed" if is_godzilla else "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
            "timestamp": ts,
        })
    except Exception:
        pass

    result = {
        "species": species,
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "shiny": shiny,
        "tamed": tamed,
        "already_owned": False,
    }

    if is_godzilla:
        result["first_partner"] = first_partner
    else:
        # Only include food info for normal dinos
        food_type = species_data["food"]
        has_food = get_item(f"FOOD#{player_id}", food_type) is not None
        result["diet"] = species_data["diet"]
        result["food"] = species_data["food"]
        result["has_food"] = has_food

    return success(result)
