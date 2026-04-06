import os
import boto3
from boto3.dynamodb.conditions import Key

_table = None
_connections_table = None


def get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb")
        _table = dynamodb.Table(os.environ["TABLE_NAME"])
    return _table


def get_connections_table():
    global _connections_table
    if _connections_table is None:
        dynamodb = boto3.resource("dynamodb")
        _connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])
    return _connections_table


def put_item(item):
    get_table().put_item(Item=item)


def get_item(pk, sk):
    resp = get_table().get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")


def query_pk(pk, sk_prefix=None):
    table = get_table()
    if sk_prefix:
        resp = table.query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix)
        )
    else:
        resp = table.query(KeyConditionExpression=Key("PK").eq(pk))
    return resp.get("Items", [])


def update_item(pk, sk, updates):
    expressions = []
    names = {}
    values = {}
    for i, (key, value) in enumerate(updates.items()):
        alias = f"#k{i}"
        val_alias = f":v{i}"
        expressions.append(f"{alias} = {val_alias}")
        names[alias] = key
        values[val_alias] = value

    get_table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="SET " + ", ".join(expressions),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def delete_item(pk, sk):
    get_table().delete_item(Key={"PK": pk, "SK": sk})
