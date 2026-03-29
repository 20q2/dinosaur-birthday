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


def test_encounter_invalid_species():
    put_item({"PK": "PLAYER#p3", "SK": "PROFILE", "name": "Mike"})
    event = _event({"player_id": "p3", "species": "pikachu"})
    event["pathParameters"]["species"] = "pikachu"
    resp = handler(event, None)
    assert resp["statusCode"] == 400
