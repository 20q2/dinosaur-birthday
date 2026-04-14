import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from ..shared.db import get_item, put_item, update_item, query_pk, delete_item
from ..shared.response import success, error
from ..shared.game_data import SPECIES, HATS, PAINT_MAP
from ..shared.ws_broadcast import broadcast

HAT_IDS = {h["id"] for h in HATS}


def _get_dino(player_id, species):
    return get_item(f"PLAYER#{player_id}", f"DINO#{species}")


def _to_native(obj):
    """Recursively convert DynamoDB Decimal types to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_native(v) for v in obj]
    return obj


def _build_dino_response(dino, species):
    return {
        "species": species,
        "name": dino.get("name", ""),
        "colors": _to_native(dino.get("colors", {})),
        "gender": dino.get("gender", ""),
        "nature": dino.get("nature", ""),
        "hat": dino.get("hat", ""),
        "xp": _to_native(dino.get("xp", 0)),
        "level": _to_native(dino.get("level", 1)),
        "is_partner": bool(dino.get("is_partner", False)),
        "tamed": bool(dino.get("tamed", False)),
        "shiny": bool(dino.get("shiny", False)),
        "background": dino.get("background", ""),
    }


def customize_handler(event, context):
    """PUT /dino/{species}/customize — Rename dino, equip hat, apply paint."""
    species = event["pathParameters"]["species"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    if species not in SPECIES:
        return error(f"Unknown species: {species}")

    dino = _get_dino(player_id, species)
    if not dino:
        return error("You don't own this dino", 404)

    updates = {}

    # Handle rename
    new_name = body.get("name")
    if new_name is not None:
        new_name = str(new_name)[:16]
        updates["name"] = new_name

    # Handle hat
    new_hat = body.get("hat")
    if new_hat is not None:
        if new_hat != "" and new_hat not in HAT_IDS:
            return error(f"Unknown hat: {new_hat}")
        updates["hat"] = new_hat

    # Handle paint: apply a normal or rare paint to a color region
    paint = body.get("paint")
    if paint is not None:
        region = paint.get("region")
        paint_id = paint.get("paint_id")
        effect = paint.get("effect")

        if region is None:
            return error("paint requires 'region' field")
        if paint_id is None and effect is None:
            return error("paint requires 'paint_id' or 'effect' field")

        species_regions = SPECIES[species]["regions"]
        if region not in species_regions:
            return error(f"Invalid region '{region}' for {species}. Valid: {species_regions}")

        items = query_pk(f"PLAYER#{player_id}", sk_prefix="ITEM#")
        existing_colors = dict(dino.get("colors", {}))

        if effect:
            # Rare paint — store as { effect: "rainbow" } etc.
            from ..shared.rare_paints import RARE_EFFECTS
            if effect not in RARE_EFFECTS:
                return error(f"Unknown effect: {effect}")
            # Verify player owns this rare paint
            paint_item = None
            for item in items:
                if item.get("type") == "paint":
                    details = item.get("details") or {}
                    if details.get("effect") == effect:
                        paint_item = item
                        break
            if not paint_item:
                return error(f"No {effect} paint in inventory")
            existing_colors[region] = {"effect": effect}
        else:
            # Normal paint
            if paint_id not in PAINT_MAP:
                return error(f"Unknown paint: {paint_id}")
            paint_item = None
            for item in items:
                if item.get("type") == "paint":
                    details = item.get("details") or {}
                    if details.get("paint_id") == paint_id:
                        paint_item = item
                        break
            if not paint_item:
                return error(f"No {paint_id} paint in inventory")
            existing_colors[region] = PAINT_MAP[paint_id]["hue"]

        updates["colors"] = existing_colors

    # Handle background
    new_bg = body.get("background")
    if new_bg is not None:
        updates["background"] = str(new_bg)

    if not updates:
        return success(_build_dino_response(dino, species))

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", updates)

    # Re-fetch fresh dino data
    updated_dino = _get_dino(player_id, species)

    # Broadcast plaza update if this is the partner dino
    if updated_dino.get("is_partner"):
        try:
            profile = get_item(f"PLAYER#{player_id}", "PROFILE")
            plaza_updates = {
                k: v for k, v in updates.items()
                if k in ("name", "hat", "colors")
            }
            if plaza_updates:
                update_item("PLAZA", f"PARTNER#{player_id}", plaza_updates)
                broadcast("plaza", "partner_update", _to_native({
                    "player_id": player_id,
                    "species": species,
                    **plaza_updates,
                }))

                # Post style update to feed
                player_name = profile.get("name", "Someone") if profile else "Someone"
                dino_name = updated_dino.get("name") or SPECIES[species]["name"]
                feed_message = f"{player_name} updated {dino_name}'s style!"
                ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
                feed_sk = f"{ts}#{uuid.uuid4()}"
                put_item({
                    "PK": "FEED",
                    "SK": feed_sk,
                    "type": "customize",
                    "message": feed_message,
                    "player_name": player_name,
                })
                broadcast("feed", "new_entry", {
                    "id": feed_sk,
                    "type": "customize",
                    "message": feed_message,
                    "player_name": player_name,
                    "timestamp": ts,
                })
        except Exception:
            pass

    return success(_build_dino_response(updated_dino, species))


def partner_handler(event, context):
    """PUT /dino/{species}/partner — Set this dino as plaza partner."""
    species = event["pathParameters"]["species"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    if species not in SPECIES:
        return error(f"Unknown species: {species}")

    dino = _get_dino(player_id, species)
    if not dino:
        return error("You don't own this dino", 404)

    if not dino.get("tamed"):
        return error("Dino must be tamed before setting as partner")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")

    # Find and unset current partner
    all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
    old_partner_species = None
    for d in all_dinos:
        if d.get("is_partner") and d["SK"] != f"DINO#{species}":
            old_partner_species = d["SK"].replace("DINO#", "")
            update_item(f"PLAYER#{player_id}", d["SK"], {"is_partner": False})
            break

    # Set new partner
    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"is_partner": True})

    # Build plaza entry data
    plaza_data = {
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
        "shiny": bool(dino.get("shiny", False)),
    }
    put_item(plaza_data)

    # Broadcast events on plaza channel
    try:
        if old_partner_species and old_partner_species != species:
            broadcast("plaza", "dino_leave", {
                "player_id": player_id,
                "species": old_partner_species,
            })

        broadcast("plaza", "dino_arrive", {
            "player_id": player_id,
            "species": species,
            "name": dino.get("name", ""),
            "hat": dino.get("hat", ""),
            "colors": dino.get("colors", {}),
            "level": dino.get("level", 1),
            "owner_name": profile.get("name", "") if profile else "",
            "owner_photo": profile.get("photo_url", "") if profile else "",
            "shiny": bool(dino.get("shiny", False)),
        })
    except Exception:
        pass

    # Feed entry — announce arrival to everyone
    try:
        species_display = SPECIES.get(species, {}).get("name", species)
        dino_display = dino.get("name") or species_display
        owner_name = profile.get("name", "Someone") if profile else "Someone"
        feed_message = f"{owner_name}'s {dino_display} strutted into the plaza!"
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{str(uuid.uuid4())[:8]}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "partner",
            "message": feed_message,
            "player_name": owner_name,
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "partner",
            "message": feed_message,
            "player_name": owner_name,
            "timestamp": ts,
        })
    except Exception:
        pass

    updated_dino = _get_dino(player_id, species)
    return success(_build_dino_response(updated_dino, species))


def handler(event, context):
    """Route to sub-handlers based on path."""
    path = event.get("resource", event.get("path", ""))
    if path.endswith("/customize"):
        return customize_handler(event, context)
    elif path.endswith("/partner"):
        return partner_handler(event, context)
    return error("Not found", 404)
