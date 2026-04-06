import json
from ..shared.db import query_pk
from ..shared.response import success


def handler(event, context):
    """GET /feed — return last 50 feed entries."""
    items = query_pk("FEED")
    # SK is timestamp#id, so reverse sort gives newest first
    items.sort(key=lambda x: x["SK"], reverse=True)
    entries = items[:50]

    feed = []
    for item in entries:
        feed.append({
            "id": item["SK"],
            "type": item.get("type", ""),
            "message": item.get("message", ""),
            "player_name": item.get("player_name", ""),
            "details": item.get("details", ""),
            "timestamp": item["SK"].split("#")[0],
        })

    return success({"entries": feed})
