from ..shared.db import get_connections_table


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    get_connections_table().delete_item(Key={"connectionId": connection_id})
    return {"statusCode": 200}
