import json
from decimal import Decimal
from ..shared.db import query_pk
from ..shared.response import success


def _to_native(obj):
    """Recursively convert DynamoDB Decimal types to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_native(v) for v in obj]
    return obj


def handler(event, context):
    """GET /plaza — return all partner dinos in the plaza."""
    items = query_pk("PLAZA", "PARTNER#")
    partners = []
    for item in items:
        player_id = item["SK"].replace("PARTNER#", "")
        partners.append({
            "player_id": player_id,
            "species": item.get("species", ""),
            "hat": item.get("hat", ""),
            "colors": _to_native(item.get("colors", {})),
            "level": _to_native(item.get("level", 1)),
            "name": item.get("name", ""),
            "owner_name": item.get("owner_name", ""),
            "owner_photo": item.get("owner_photo", ""),
        })
    return success({"partners": partners})
