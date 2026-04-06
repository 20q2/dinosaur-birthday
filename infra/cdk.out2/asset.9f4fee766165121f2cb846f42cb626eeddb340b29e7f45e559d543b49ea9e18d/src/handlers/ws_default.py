import json
from ..shared.db import get_connections_table


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    body = json.loads(event.get("body", "{}"))
    action = body.get("action")

    table = get_connections_table()

    if action == "subscribe":
        channel = body.get("channel")
        if channel:
            conn = table.get_item(Key={"connectionId": connection_id}).get("Item", {})
            channels = conn.get("channels", [])
            if channel not in channels:
                channels.append(channel)
                table.update_item(
                    Key={"connectionId": connection_id},
                    UpdateExpression="SET channels = :c",
                    ExpressionAttributeValues={":c": channels},
                )

    elif action == "unsubscribe":
        channel = body.get("channel")
        if channel:
            conn = table.get_item(Key={"connectionId": connection_id}).get("Item", {})
            channels = conn.get("channels", [])
            if channel in channels:
                channels.remove(channel)
                table.update_item(
                    Key={"connectionId": connection_id},
                    UpdateExpression="SET channels = :c",
                    ExpressionAttributeValues={":c": channels},
                )

    return {"statusCode": 200}
