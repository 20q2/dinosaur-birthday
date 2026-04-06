import os
import json
import boto3
from .db import get_connections_table

_apigw = None


def _get_apigw():
    global _apigw
    if _apigw is None:
        endpoint = os.environ["WEBSOCKET_ENDPOINT"]
        _apigw = boto3.client(
            "apigatewaymanagementapi", endpoint_url=endpoint
        )
    return _apigw


def broadcast(channel, event_type, data):
    """Send a message to all connections subscribed to a channel."""
    table = get_connections_table()
    resp = table.scan()
    connections = resp.get("Items", [])

    message = json.dumps({"channel": channel, "type": event_type, "data": data})
    apigw = _get_apigw()

    stale = []
    for conn in connections:
        channels = conn.get("channels", [])
        if channel in channels or channel == "all":
            try:
                apigw.post_to_connection(
                    ConnectionId=conn["connectionId"], Data=message
                )
            except apigw.exceptions.GoneException:
                stale.append(conn["connectionId"])

    for conn_id in stale:
        table.delete_item(Key={"connectionId": conn_id})


def send_to_connection(connection_id, channel, event_type, data):
    """Send a message to a specific connection."""
    message = json.dumps({"channel": channel, "type": event_type, "data": data})
    try:
        _get_apigw().post_to_connection(
            ConnectionId=connection_id, Data=message
        )
    except Exception:
        pass
