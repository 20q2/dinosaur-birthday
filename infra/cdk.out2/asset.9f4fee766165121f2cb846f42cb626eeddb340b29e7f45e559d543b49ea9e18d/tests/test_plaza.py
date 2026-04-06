import json
import pytest
from src.shared.db import put_item


def test_get_plaza():
    # Create a plaza entry
    put_item({
        "PK": "PLAZA", "SK": "PARTNER#p1",
        "species": "trex", "hat": "party_hat", "colors": {"body": 120},
        "level": 3, "name": "Rex", "owner_name": "Jake", "owner_photo": "",
    })
    event = {"httpMethod": "GET", "pathParameters": {}}
    from src.handlers.plaza import handler
    resp = handler(event, None)
    body = json.loads(resp["body"])
    assert len(body["partners"]) == 1
    assert body["partners"][0]["species"] == "trex"


def test_get_plaza_empty():
    # No plaza entries — should return empty list
    event = {"httpMethod": "GET", "pathParameters": {}}
    from src.handlers.plaza import handler
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["partners"] == []


def test_get_plaza_multiple_partners():
    # Create several plaza entries
    put_item({
        "PK": "PLAZA", "SK": "PARTNER#p2",
        "species": "spinosaurus", "hat": "", "colors": {"body": 200},
        "level": 5, "name": "Spiny", "owner_name": "Alice", "owner_photo": "",
    })
    put_item({
        "PK": "PLAZA", "SK": "PARTNER#p3",
        "species": "triceratops", "hat": "crown", "colors": {"body": 60},
        "level": 2, "name": "Tri", "owner_name": "Bob", "owner_photo": "",
    })

    event = {"httpMethod": "GET", "pathParameters": {}}
    from src.handlers.plaza import handler
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert len(body["partners"]) == 2

    species_set = {p["species"] for p in body["partners"]}
    assert "spinosaurus" in species_set
    assert "triceratops" in species_set


def test_get_plaza_partner_fields():
    # Verify all expected fields are returned
    put_item({
        "PK": "PLAZA", "SK": "PARTNER#p4",
        "species": "ankylosaurus", "hat": "party_hat",
        "colors": {"body": 90, "belly": 45},
        "level": 4, "name": "Anky", "owner_name": "Carol", "owner_photo": "https://example.com/carol.jpg",
    })

    event = {"httpMethod": "GET", "pathParameters": {}}
    from src.handlers.plaza import handler
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    partner = body["partners"][0]
    assert partner["player_id"] == "p4"
    assert partner["species"] == "ankylosaurus"
    assert partner["hat"] == "party_hat"
    assert partner["colors"] == {"body": 90, "belly": 45}
    assert partner["level"] == 4
    assert partner["name"] == "Anky"
    assert partner["owner_name"] == "Carol"
    assert partner["owner_photo"] == "https://example.com/carol.jpg"
