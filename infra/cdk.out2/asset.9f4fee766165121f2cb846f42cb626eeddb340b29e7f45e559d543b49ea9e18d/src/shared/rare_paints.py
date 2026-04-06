import uuid
from .db import get_item, put_item

RARE_EFFECTS = frozenset({"rainbow", "metallic", "starry_night", "prismatic"})

EFFECT_NAMES = {
    "rainbow":      "Rainbow Paint",
    "metallic":     "Metallic Paint",
    "starry_night": "Starry Night Paint",
    "prismatic":    "Prismatic Paint",
}


def grant_rare_paint(player_id, effect):
    """
    Grant a one-time rare paint item to a player.
    Returns the item dict if newly granted, or None if the effect was already claimed.
    """
    claim_sk = f"RARE_PAINT_{effect}"
    if get_item(f"PLAYER#{player_id}", claim_sk):
        return None

    item_id = str(uuid.uuid4())
    item = {
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "paint",
        "name": EFFECT_NAMES[effect],
        "details": {"effect": effect},
    }
    put_item(item)
    put_item({"PK": f"PLAYER#{player_id}", "SK": claim_sk})
    return item
