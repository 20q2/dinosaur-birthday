import json
import time
import uuid
from datetime import datetime, timezone
from ..shared.db import get_item, put_item, update_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import generate_lobby_code, random_trivia, random_hat
from ..shared.ws_broadcast import broadcast


# ── XP Helper ────────────────────────────────────────────────────────────────

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

    # Level up: 100 XP per level, cap at 5
    while new_level < 5 and new_xp >= new_level * 100:
        new_xp -= new_level * 100
        new_level += 1

    if new_level >= 5:
        new_xp = min(new_xp, 0)  # Cap at max level
        new_level = 5

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"xp": new_xp, "level": new_level})
    return {"species": species, "xp": new_xp, "level": new_level}


def _give_hat(player_id):
    """Give a random hat item to the player's inventory. Returns the hat."""
    import uuid
    hat = random_hat()
    item_id = str(uuid.uuid4())
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "hat",
        "name": hat["name"],
        "details": {"hat_id": hat["id"], "rarity": hat["rarity"]},
    })
    return hat


# ── Handler: POST /lobby ──────────────────────────────────────────────────────

def create_lobby_handler(event, context):
    """POST /lobby — Create a new lobby."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    symbols = generate_lobby_code()
    code = "_".join(symbols)

    now = int(time.time())
    ttl = now + 120  # 2 minutes

    trivia = random_trivia()

    put_item({
        "PK": f"LOBBY#{code}",
        "SK": "META",
        "host_id": player_id,
        "status": "waiting",
        "trivia_question": trivia,
        "created_at": now,
        "ttl": ttl,
    })

    return success({
        "code": code,
        "symbols": symbols,
    })


# ── Handler: POST /lobby/{code}/join ─────────────────────────────────────────

def join_lobby_handler(event, context):
    """POST /lobby/{code}/join — Join a lobby."""
    code = event["pathParameters"]["code"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    lobby = get_item(f"LOBBY#{code}", "META")
    if not lobby:
        return error("Lobby not found", 404)

    if lobby.get("status") != "waiting":
        return error("Lobby is not available")

    host_id = lobby["host_id"]

    if player_id == host_id:
        return error("You cannot join your own lobby")

    # Check cooldown — sorted pair key ensures consistent ordering
    pair = sorted([host_id, player_id])
    pair_key = f"{pair[0]}#{pair[1]}"
    cooldown = get_item(f"COOLDOWN#{pair_key}", "META")
    if cooldown:
        now = int(time.time())
        ttl = int(cooldown.get("ttl", 0))
        if ttl > now:
            remaining = ttl - now
            minutes = remaining // 60
            seconds = remaining % 60
            return error(
                f"These dinos need a rest! Cooldown: {minutes}m {seconds}s remaining"
            )

    # Set guest and activate lobby
    update_item(f"LOBBY#{code}", "META", {
        "guest_id": player_id,
        "status": "active",
    })

    trivia = lobby["trivia_question"]

    # Broadcast trivia to the lobby channel so both players receive it
    try:
        broadcast(f"lobby:{code}", "trivia_start", {
            "code": code,
            "question": trivia["question"],
            "options": trivia["options"],
        })
    except Exception:
        pass

    return success({
        "code": code,
        "trivia": {
            "question": trivia["question"],
            "options": trivia["options"],
        },
    })


# ── Handler: POST /lobby/{code}/answer ───────────────────────────────────────

def answer_lobby_handler(event, context):
    """POST /lobby/{code}/answer — Submit a trivia answer."""
    code = event["pathParameters"]["code"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")
    answer = body.get("answer")

    if player_id is None:
        return error("player_id is required")
    if answer is None:
        return error("answer is required")

    try:
        answer = int(answer)
    except (TypeError, ValueError):
        return error("answer must be an integer 0-3")

    lobby = get_item(f"LOBBY#{code}", "META")
    if not lobby:
        return error("Lobby not found", 404)

    if lobby.get("status") != "active":
        return error("Lobby is not active")

    host_id = lobby["host_id"]
    guest_id = lobby.get("guest_id")

    if player_id not in (host_id, guest_id):
        return error("You are not in this lobby")

    trivia = lobby["trivia_question"]
    correct_index = int(trivia["answer"])
    is_correct = answer == correct_index

    xp_amount = 50 if is_correct else 30

    # Award XP to both players' partner dinos
    host_dino = award_xp(host_id, xp_amount)
    guest_dino = award_xp(guest_id, xp_amount) if guest_id else None

    rewards = {"xp": xp_amount, "correct": is_correct}
    hat_reward = None

    if is_correct:
        # Give a random hat to each player
        host_hat = _give_hat(host_id)
        if guest_id:
            _give_hat(guest_id)
        hat_reward = host_hat  # representative hat for response

    # Create cooldown — expires in 15 minutes
    now = int(time.time())
    pair = sorted([host_id, guest_id or ""])
    pair_key = f"{pair[0]}#{pair[1]}"
    put_item({
        "PK": f"COOLDOWN#{pair_key}",
        "SK": "META",
        "ttl": now + 900,  # 15 minutes
    })

    # Mark lobby as done
    update_item(f"LOBBY#{code}", "META", {"status": "done"})

    # Post to feed
    try:
        host_profile = get_item(f"PLAYER#{host_id}", "PROFILE")
        guest_profile = get_item(f"PLAYER#{guest_id}", "PROFILE") if guest_id else None
        host_name = host_profile.get("name", "Someone") if host_profile else "Someone"
        guest_name = guest_profile.get("name", "Someone") if guest_profile else "Someone"

        play_message = f"{host_name} and {guest_name}'s dinos played together!"
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "play",
            "message": play_message,
            "player_name": host_name,
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "play",
            "message": play_message,
            "player_name": host_name,
            "timestamp": ts,
        })
    except Exception:
        pass

    # Broadcast result to lobby channel
    result_data = {
        "correct": is_correct,
        "correct_index": correct_index,
        "xp_awarded": xp_amount,
        "host_dino": host_dino,
        "guest_dino": guest_dino,
    }
    if hat_reward:
        result_data["hat"] = hat_reward["name"]

    try:
        broadcast(f"lobby:{code}", "trivia_result", result_data)
    except Exception:
        pass

    return success({
        "correct": is_correct,
        "correct_index": correct_index,
        "xp_awarded": xp_amount,
        "hat": hat_reward["name"] if hat_reward else None,
        "host_dino": host_dino,
        "guest_dino": guest_dino,
    })


# ── Main Router ───────────────────────────────────────────────────────────────

def handler(event, context):
    """Route lobby requests to sub-handlers."""
    resource = event.get("resource", event.get("path", ""))
    method = event.get("httpMethod", "POST")

    if resource == "/lobby" and method == "POST":
        return create_lobby_handler(event, context)

    if "/join" in resource and method == "POST":
        return join_lobby_handler(event, context)

    if "/answer" in resource and method == "POST":
        return answer_lobby_handler(event, context)

    return error("Not found", 404)
