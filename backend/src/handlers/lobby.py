import json
import time
import uuid
import random
from datetime import datetime, timezone
from ..shared.db import get_item, put_item, update_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import generate_lobby_code, random_trivia, random_hat, random_paint
from ..shared.ws_broadcast import broadcast
from ..shared.xp import award_xp
from ..shared.rare_paints import grant_rare_paint


def _give_reward(player_id):
    """Give a random hat or paint item (50/50) to the player's inventory."""
    item_id = str(uuid.uuid4())
    if random.random() < 0.5:
        hat = random_hat()
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{item_id}",
            "type": "hat",
            "name": hat["name"],
            "details": {"hat_id": hat["id"], "rarity": hat["rarity"]},
        })
        return {"type": "hat", "name": hat["name"], "hat_id": hat["id"]}
    else:
        paint = random_paint()
        put_item({
            "PK": f"PLAYER#{player_id}",
            "SK": f"ITEM#{item_id}",
            "type": "paint",
            "name": f"{paint['name']} Paint",
            "details": {"paint_id": paint["id"], "hue": paint["hue"]},
        })
        return {
            "type": "paint",
            "name": f"{paint['name']} Paint",
            "paint_id": paint["id"],
            "hue": paint["hue"],
        }


def _track_trivia_partner(player_id, other_id):
    """
    Record that player_id played trivia with other_id.
    Unique per pair (idempotent). Grants starry_night at 10 unique partners.
    """
    sk = f"PARTNER#{other_id}"
    if get_item(f"EVENT#{player_id}", sk):
        return
    put_item({"PK": f"EVENT#{player_id}", "SK": sk})
    partners = query_pk(f"EVENT#{player_id}", sk_prefix="PARTNER#")
    if len(partners) == 10:
        grant_rare_paint(player_id, "starry_night")


# ── Handler: POST /lobby ──────────────────────────────────────────────────────

def create_lobby_handler(event, context):
    """POST /lobby — Create a new lobby."""
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if not player_id:
        return error("player_id is required")

    symbols = generate_lobby_code()
    code = "-".join(symbols)

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
        "trivia": {"question": trivia["question"], "options": trivia["options"]},
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

    # Fetch both players' partner dinos for canvas rendering
    def _get_partner_dino(pid):
        dinos = query_pk(f"PLAYER#{pid}", "DINO#")
        partner = next((d for d in dinos if d.get("is_partner") and d.get("tamed")), None)
        if not partner:
            return {"species": "", "colors": {}, "hat": "", "name": ""}
        return {
            "species": partner["SK"].replace("DINO#", ""),
            "colors": partner.get("colors", {}),
            "hat": partner.get("hat", ""),
            "name": partner.get("name", ""),
        }

    host_dino = _get_partner_dino(host_id)
    guest_dino = _get_partner_dino(player_id)

    # Broadcast trivia to the lobby channel so both players receive it
    try:
        broadcast(f"lobby:{code}", "trivia_start", {
            "code": code,
            "question": trivia["question"],
            "options": trivia["options"],
            "host_dino": host_dino,
            "guest_dino": guest_dino,
        })
    except Exception:
        pass

    # Notify plaza so other players see the two dinos playing together
    try:
        broadcast("plaza", "play_together", {
            "player_ids": [host_id, player_id],
        })
    except Exception:
        pass

    return success({
        "code": code,
        "trivia": {
            "question": trivia["question"],
            "options": trivia["options"],
        },
        "host_dino": host_dino,
        "guest_dino": guest_dino,
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

    if lobby.get("status") not in ("active", "done"):
        return error("Lobby is not active")

    host_id = lobby["host_id"]
    guest_id = lobby.get("guest_id")

    if player_id not in (host_id, guest_id):
        return error("You are not in this lobby")

    trivia = lobby["trivia_question"]
    correct_index = int(trivia["answer"])
    is_correct = answer == correct_index

    # Each player answers independently and gets their own rewards
    answer_key = "host_answered" if player_id == host_id else "guest_answered"
    already_answered = bool(lobby.get(answer_key, False))
    if already_answered:
        return error("You already answered")

    xp_amount = 50 if is_correct else 30
    my_dino = award_xp(player_id, xp_amount)
    item_reward = _give_reward(player_id) if is_correct else None

    # Mark this player as answered
    update_fields = {answer_key: True}

    # One-time operations: cooldown, partner tracking, feed (on first answer from either)
    if not lobby.get("host_answered") and not lobby.get("guest_answered"):
        now = int(time.time())
        pair = sorted([host_id, guest_id or ""])
        pair_key = f"{pair[0]}#{pair[1]}"
        put_item({
            "PK": f"COOLDOWN#{pair_key}",
            "SK": "META",
            "ttl": now + 0,
        })

        if guest_id:
            _track_trivia_partner(host_id, guest_id)
            _track_trivia_partner(guest_id, host_id)

        try:
            host_profile = get_item(f"PLAYER#{host_id}", "PROFILE")
            guest_profile = get_item(f"PLAYER#{guest_id}", "PROFILE") if guest_id else None
            host_name = host_profile.get("name", "Someone") if host_profile else "Someone"
            guest_name = guest_profile.get("name", "Someone") if guest_profile else "Someone"
            play_message = f"{host_name} and {guest_name}'s dinos played together!"
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
            feed_sk = f"{ts}#{uuid.uuid4()}"
            put_item({"PK": "FEED", "SK": feed_sk, "type": "play", "message": play_message, "player_name": host_name})
            broadcast("feed", "new_entry", {"id": feed_sk, "type": "play", "message": play_message, "player_name": host_name, "timestamp": ts})
        except Exception:
            pass

    update_item(f"LOBBY#{code}", "META", update_fields)

    # Notify plaza that play session ended
    try:
        broadcast("plaza", "play_ended", {
            "player_ids": [host_id, guest_id],
        })
    except Exception:
        pass

    # Fetch partner info for cooldown save on the frontend
    partner_id = guest_id if player_id == host_id else host_id
    try:
        partner_profile = get_item(f"PLAYER#{partner_id}", "PROFILE") if partner_id else None
        partner_name = partner_profile.get("name", "") if partner_profile else ""
    except Exception:
        partner_name = ""

    return success({
        "correct": is_correct,
        "correct_index": correct_index,
        "xp_awarded": xp_amount,
        "reward": item_reward if item_reward else None,
        "my_dino": my_dino,
        "partner_id": partner_id,
        "partner_name": partner_name,
    })


# ── Handler: GET /lobby/{code} ───────────────────────────────────────────────

def get_lobby_handler(event, context):
    """GET /lobby/{code} — Check lobby status (used for host polling fallback)."""
    code = event["pathParameters"]["code"]
    lobby = get_item(f"LOBBY#{code}", "META")
    if not lobby:
        return error("Lobby not found", 404)

    result = {"code": code, "status": lobby.get("status", "waiting")}

    # If a guest has joined, include the trivia and dino data so the host can start
    if lobby.get("status") == "active" and lobby.get("guest_id"):
        trivia = lobby.get("trivia_question", {})
        result["trivia"] = {"question": trivia.get("question", ""), "options": trivia.get("options", [])}

        def _get_partner_dino(pid):
            dinos = query_pk(f"PLAYER#{pid}", "DINO#")
            partner = next((d for d in dinos if d.get("is_partner") and d.get("tamed")), None)
            if not partner:
                return {"species": "", "colors": {}, "hat": "", "name": ""}
            return {
                "species": partner["SK"].replace("DINO#", ""),
                "colors": partner.get("colors", {}),
                "hat": partner.get("hat", ""),
                "name": partner.get("name", ""),
            }

        result["guest_dino"] = _get_partner_dino(lobby["guest_id"])

    return success(result)


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

    # GET /lobby/{code} — host polls for guest join
    if method == "GET" and "code" in (event.get("pathParameters") or {}):
        return get_lobby_handler(event, context)

    return error("Not found", 404)
