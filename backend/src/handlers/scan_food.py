import json
import uuid
from datetime import datetime, timezone
from ..shared.db import get_item, put_item, update_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import SPECIES
from ..shared.xp import award_xp
from ..shared.ws_broadcast import broadcast


def _harvest(player_id, food_type, profile):
    """Award XP for harvesting food. Called on every scan."""
    dino_result = award_xp(player_id, 5)
    return {
        "xp_awarded": 5,
        "dino": dino_result,
        "no_partner": dino_result is None,
    }


def _auto_set_partner(player_id, species, profile):
    """If the player has no partner yet, auto-set this dino as partner."""
    all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
    has_partner = any(d.get("is_partner") for d in all_dinos)
    if has_partner:
        return False

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"is_partner": True})

    dino = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    put_item({
        "PK": "PLAZA",
        "SK": f"PARTNER#{player_id}",
        "species": species,
        "hat": dino.get("hat", ""),
        "colors": dino.get("colors", {}),
        "level": dino.get("level", 1),
        "name": dino.get("name", ""),
        "gender": dino.get("gender", ""),
        "owner_name": profile.get("name", "") if profile else "",
        "owner_photo": profile.get("photo_url", "") if profile else "",
    })

    try:
        broadcast("plaza", "dino_arrive", {
            "player_id": player_id,
            "species": species,
            "name": dino.get("name", ""),
            "hat": dino.get("hat", ""),
            "colors": dino.get("colors", {}),
            "level": dino.get("level", 1),
            "owner_name": profile.get("name", "") if profile else "",
            "owner_photo": profile.get("photo_url", "") if profile else "",
        })
    except Exception:
        pass

    return True


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

    # Always do harvest tracking
    harvest = _harvest(player_id, food_type, profile)

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
            return success({"already_tamed": True, "species": species, "harvest": harvest})

        update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})
        first_partner = _auto_set_partner(player_id, species, profile)

        try:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
            feed_sk = f"{ts}#{uuid.uuid4()}"
            tamed_message = f"{profile['name']} tamed a wild {SPECIES[species]['name']}!"
            put_item({
                "PK": "FEED",
                "SK": feed_sk,
                "type": "tamed",
                "message": tamed_message,
                "player_name": profile["name"],
            })
            broadcast("feed", "new_entry", {
                "id": feed_sk,
                "type": "tamed",
                "message": tamed_message,
                "player_name": profile["name"],
                "timestamp": ts,
            })
        except Exception:
            pass

        return success({"tamed": True, "species": species, "harvest": harvest, "first_partner": first_partner})

    # If no species specified, find untamed dinos that eat this food
    all_items = query_pk(f"PLAYER#{player_id}", "DINO#")
    untamed = []
    for item in all_items:
        sp = item["SK"].replace("DINO#", "")
        if not item.get("tamed") and SPECIES.get(sp, {}).get("food") == food_type:
            untamed.append(sp)

    if not untamed:
        # No untamed dinos — still show harvest screen (not an error anymore)
        return success({"harvest_only": True, "food_type": food_type, "harvest": harvest})

    # If multiple options, ask user to choose
    if len(untamed) > 1:
        return success({
            "choose_species": True,
            "untamed": untamed,
            "food_type": food_type,
            "harvest": harvest,
        })

    # Only one option, auto-select
    species = untamed[0]

    dino = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if not dino:
        return error("You haven't encountered this dino yet")

    if dino.get("tamed"):
        return success({"already_tamed": True, "species": species, "harvest": harvest})

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})
    first_partner = _auto_set_partner(player_id, species, profile)

    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        tamed_message = f"{profile['name']} tamed a wild {SPECIES[species]['name']}!"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "tamed",
            "message": tamed_message,
            "player_name": profile["name"],
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "tamed",
            "message": tamed_message,
            "player_name": profile["name"],
            "timestamp": ts,
        })
    except Exception:
        pass

    return success({"tamed": True, "species": species, "harvest": harvest, "first_partner": first_partner})
