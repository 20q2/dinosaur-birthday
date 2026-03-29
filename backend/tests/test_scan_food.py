import json
from src.handlers.scan_food import handler
from src.shared.db import put_item, get_item


def _event(food_type, body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"type": food_type},
        "body": json.dumps(body),
    }


def test_tame_with_correct_food():
    put_item({"PK": "PLAYER#p1", "SK": "PROFILE", "name": "Jake"})
    put_item({
        "PK": "PLAYER#p1", "SK": "DINO#trex",
        "tamed": False, "colors": {}, "gender": "male", "nature": "Bold",
        "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "",
    })

    resp = handler(_event("meat", {"player_id": "p1", "species": "trex"}), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["tamed"] is True
    assert body["species"] == "trex"


def test_tame_with_wrong_food():
    put_item({"PK": "PLAYER#p2", "SK": "PROFILE", "name": "Sarah"})
    put_item({
        "PK": "PLAYER#p2", "SK": "DINO#trex",
        "tamed": False, "colors": {}, "gender": "male", "nature": "Bold",
        "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "",
    })

    resp = handler(_event("mejoberries", {"player_id": "p2", "species": "trex"}), None)
    assert resp["statusCode"] == 400


def test_tame_already_tamed():
    put_item({"PK": "PLAYER#p3", "SK": "PROFILE", "name": "Mike"})
    put_item({
        "PK": "PLAYER#p3", "SK": "DINO#ankylosaurus",
        "tamed": True, "colors": {}, "gender": "female", "nature": "Calm",
        "hat": "party_hat", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "Bumpy",
    })

    resp = handler(_event("mejoberries", {"player_id": "p3", "species": "ankylosaurus"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["already_tamed"] is True


def test_tame_lists_untamed_when_no_species_given():
    put_item({"PK": "PLAYER#p4", "SK": "PROFILE", "name": "Emma"})
    put_item({"PK": "PLAYER#p4", "SK": "DINO#trex", "tamed": False, "colors": {}, "gender": "male", "nature": "Bold", "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": ""})
    put_item({"PK": "PLAYER#p4", "SK": "DINO#spinosaurus", "tamed": False, "colors": {}, "gender": "female", "nature": "Jolly", "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": ""})

    resp = handler(_event("meat", {"player_id": "p4"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["choose_species"] is True
    assert len(body["untamed"]) == 2


def test_harvest_awards_base_xp_with_no_score():
    put_item({"PK": "PLAYER#p9", "SK": "PROFILE", "name": "Dana"})
    resp1 = handler(_event("meat", {"player_id": "p9"}), None)
    body1 = json.loads(resp1["body"])
    assert body1["harvest"]["xp_awarded"] == 3  # base XP, no minigame score

    resp2 = handler(_event("meat", {"player_id": "p9"}), None)
    body2 = json.loads(resp2["body"])
    assert body2["harvest"]["xp_awarded"] == 3  # repeatable


def test_harvest_xp_scales_with_score():
    put_item({"PK": "PLAYER#p10", "SK": "PROFILE", "name": "Eve"})

    # All perfects: raw = 0 + 6*2 = 12, xp = 3 + min(6, 6) = 9
    resp = handler(_event("meat", {"player_id": "p10", "perfects": 6, "goods": 0}), None)
    body = json.loads(resp["body"])
    assert body["harvest"]["xp_awarded"] == 9

    # All goods: raw = 6 + 0 = 6, xp = 3 + min(6, 3) = 6
    resp2 = handler(_event("meat", {"player_id": "p10", "perfects": 0, "goods": 6}), None)
    body2 = json.loads(resp2["body"])
    assert body2["harvest"]["xp_awarded"] == 6

    # Mix: 3 perfect + 2 good: raw = 2 + 6 = 8, xp = 3 + min(6, 4) = 7
    resp3 = handler(_event("meat", {"player_id": "p10", "perfects": 3, "goods": 2}), None)
    body3 = json.loads(resp3["body"])
    assert body3["harvest"]["xp_awarded"] == 7
