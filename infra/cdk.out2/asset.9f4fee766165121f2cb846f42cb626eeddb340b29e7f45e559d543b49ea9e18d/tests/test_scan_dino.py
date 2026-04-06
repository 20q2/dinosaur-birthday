import json
from src.handlers.scan_dino import handler
from src.shared.db import get_item, put_item


def _event(body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"species": body.get("species", "trex")},
        "body": json.dumps(body),
    }


def test_encounter_new_dino():
    put_item({"PK": "PLAYER#p1", "SK": "PROFILE", "name": "Jake"})
    resp = handler(_event({"player_id": "p1", "species": "trex"}), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["species"] == "trex"
    assert body["tamed"] is False
    assert "colors" in body
    assert "gender" in body
    assert "nature" in body
    assert "shiny" in body

    item = get_item("PLAYER#p1", "DINO#trex")
    assert item is not None
    assert item["tamed"] is False


def test_encounter_already_owned():
    put_item({"PK": "PLAYER#p2", "SK": "PROFILE", "name": "Sarah"})
    put_item({"PK": "PLAYER#p2", "SK": "DINO#trex", "tamed": True, "name": "Rex"})

    resp = handler(_event({"player_id": "p2", "species": "trex"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["already_owned"] is True


def test_godzilla_rejected_before_boss_defeated():
    put_item({"PK": "PLAYER#pg1", "SK": "PROFILE", "name": "Eager"})
    event = _event({"player_id": "pg1", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body.get("not_available") is True


def test_godzilla_rejected_boss_active():
    put_item({"PK": "PLAYER#pg2", "SK": "PROFILE", "name": "Impatient"})
    put_item({"PK": "BOSS", "SK": "STATE", "status": "active", "hp": 500, "max_hp": 900})
    event = _event({"player_id": "pg2", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body.get("not_available") is True


def test_godzilla_tamed_after_boss_defeated():
    put_item({"PK": "PLAYER#pg3", "SK": "PROFILE", "name": "Victor"})
    put_item({"PK": "BOSS", "SK": "STATE", "status": "defeated", "hp": 0, "max_hp": 900})
    event = _event({"player_id": "pg3", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["species"] == "godzilla"
    assert body["tamed"] is True
    assert "colors" in body
    item = get_item("PLAYER#pg3", "DINO#godzilla")
    assert item is not None
    assert item["tamed"] is True


def test_encounter_invalid_species():
    put_item({"PK": "PLAYER#p3", "SK": "PROFILE", "name": "Mike"})
    event = _event({"player_id": "p3", "species": "pikachu"})
    event["pathParameters"]["species"] = "pikachu"
    resp = handler(event, None)
    assert resp["statusCode"] == 400
