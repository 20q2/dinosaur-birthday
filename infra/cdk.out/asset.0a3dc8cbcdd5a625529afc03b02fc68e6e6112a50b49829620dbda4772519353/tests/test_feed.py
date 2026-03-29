import json
from src.shared.db import put_item
from src.handlers.feed import handler


def test_get_feed_empty():
    event = {"httpMethod": "GET", "pathParameters": {}}
    resp = handler(event, None)
    body = json.loads(resp["body"])
    assert body["entries"] == []


def test_get_feed_returns_entries_newest_first():
    put_item({"PK": "FEED", "SK": "2026-03-26T01:00:00#1", "type": "tamed", "message": "Jake tamed a T-Rex!", "player_name": "Jake"})
    put_item({"PK": "FEED", "SK": "2026-03-26T02:00:00#2", "type": "play", "message": "Sarah and Mike played!", "player_name": "Sarah"})
    put_item({"PK": "FEED", "SK": "2026-03-26T03:00:00#3", "type": "levelup", "message": "Emma's Rex reached Lv3!", "player_name": "Emma"})

    event = {"httpMethod": "GET", "pathParameters": {}}
    resp = handler(event, None)
    body = json.loads(resp["body"])
    assert len(body["entries"]) == 3
    assert body["entries"][0]["message"] == "Emma's Rex reached Lv3!"
    assert body["entries"][2]["message"] == "Jake tamed a T-Rex!"
