import json
import uuid
from datetime import datetime, timezone
from ..shared.db import put_item, get_item
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
        "tamed": False,
        "shiny": shiny,
        "name": "",
    }
    put_item(dino)

    feed_msg = f"✨SHINY✨ {species_data['name']}" if shiny else f"wild {species_data['name']}"
    feed_entry_message = f"{profile['name']} encountered a {feed_msg}!"
    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
            "timestamp": ts,
        })
    except Exception:
        pass

    # Check if player already harvested the food this dino needs
    food_type = species_data["food"]
    has_food = get_item(f"FOOD#{player_id}", food_type) is not None

    return success({
        "species": species,
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "shiny": shiny,
        "tamed": False,
        "diet": species_data["diet"],
        "food": species_data["food"],
        "has_food": has_food,
        "already_owned": False,
    })
