import json
from ..shared.db import get_item, update_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import SPECIES
from ..shared.ws_broadcast import broadcast


def handler(event, context):
    food_type = event["pathParameters"]["type"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")
    species = body.get("species")

    if food_type not in ("meat", "mejoberries"):
        return error(f"Unknown food type: {food_type}")
    if not player_id:
        return error("player_id is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # If species is specified, check if it exists and handle directly
    if species:
        if species not in SPECIES:
            return error(f"Unknown species: {species}")

        # Verify this food is correct for the species
        if SPECIES[species]["food"] != food_type:
            return error(f"{SPECIES[species]['name']} doesn't eat {food_type}!")

        dino = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
        if not dino:
            return error("You haven't encountered this dino yet")

        if dino.get("tamed"):
            return success({"already_tamed": True, "species": species})

        update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})

        try:
            broadcast("feed", "new_entry", {
                "type": "tamed",
                "message": f"{profile['name']} tamed a wild {SPECIES[species]['name']}!",
                "player_name": profile["name"],
            })
        except Exception:
            pass

        return success({"tamed": True, "species": species})

    # If no species specified, find untamed dinos that eat this food
    all_items = query_pk(f"PLAYER#{player_id}", "DINO#")
    untamed = []
    for item in all_items:
        sp = item["SK"].replace("DINO#", "")
        if not item.get("tamed") and SPECIES.get(sp, {}).get("food") == food_type:
            untamed.append(sp)

    if not untamed:
        return error("No untamed dinos that eat this food")

    # If multiple options, ask user to choose
    if len(untamed) > 1:
        return success({
            "choose_species": True,
            "untamed": untamed,
            "food_type": food_type,
        })

    # Only one option, auto-select
    species = untamed[0]

    dino = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if not dino:
        return error("You haven't encountered this dino yet")

    if dino.get("tamed"):
        return success({"already_tamed": True, "species": species})

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})

    try:
        broadcast("feed", "new_entry", {
            "type": "tamed",
            "message": f"{profile['name']} tamed a wild {SPECIES[species]['name']}!",
            "player_name": profile["name"],
        })
    except Exception:
        pass

    return success({"tamed": True, "species": species})
