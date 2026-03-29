from .db import query_pk, update_item


def award_xp(player_id, amount):
    """Award XP to the player's partner dino. Returns updated dino info or None."""
    dinos = query_pk(f"PLAYER#{player_id}", "DINO#")
    partner = next((d for d in dinos if d.get("is_partner") and d.get("tamed")), None)
    if not partner:
        return None

    species = partner["SK"].replace("DINO#", "")
    current_xp = int(partner.get("xp", 0))
    current_level = int(partner.get("level", 1))

    new_xp = current_xp + amount
    new_level = current_level

    while new_level < 5 and new_xp >= new_level * 100:
        new_xp -= new_level * 100
        new_level += 1

    if new_level >= 5:
        new_xp = min(new_xp, 0)
        new_level = 5

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"xp": new_xp, "level": new_level})
    return {"species": species, "xp": new_xp, "level": new_level}
