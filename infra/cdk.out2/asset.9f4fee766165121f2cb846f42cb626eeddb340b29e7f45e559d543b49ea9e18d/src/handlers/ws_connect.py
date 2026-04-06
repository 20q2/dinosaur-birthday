from ..shared.db import get_connections_table


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    get_connections_table().put_item(
        Item={"connectionId": connection_id, "channels": ["plaza", "feed"]}
    )
    return {"statusCode": 200}
