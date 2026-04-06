import os
import pytest
import boto3
from moto import mock_aws

os.environ["TABLE_NAME"] = "test-game-table"
os.environ["CONNECTIONS_TABLE"] = "test-connections-table"
os.environ["WEBSOCKET_ENDPOINT"] = "https://fake.execute-api.us-east-1.amazonaws.com/prod"
os.environ["S3_BUCKET"] = "test-photos"


@pytest.fixture(autouse=True)
def aws_env():
    with mock_aws():
        # Create DynamoDB tables
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        dynamodb.create_table(
            TableName="test-game-table",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        dynamodb.create_table(
            TableName="test-connections-table",
            KeySchema=[
                {"AttributeName": "connectionId", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "connectionId", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # Reset cached table references
        from src.shared import db
        db._table = None
        db._connections_table = None

        yield
