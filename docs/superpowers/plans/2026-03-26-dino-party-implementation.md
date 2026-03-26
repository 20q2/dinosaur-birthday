# Dino Party Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based mobile party game where 30-40 guests scan QR codes to discover, tame, and customize pixel-art dinosaurs, culminating in a collective Godzilla boss fight.

**Architecture:** Static Preact SPA on GitHub Pages talks to an AWS backend (API Gateway REST + WebSocket, Lambda Python 3.12, DynamoDB single-table, S3 for photos). QR codes are URLs that route to game screens. WebSocket provides real-time plaza, feed, lobby, and boss fight updates.

**Tech Stack:** Preact + Vite (frontend), AWS SAM + Python 3.12 + boto3 (backend), DynamoDB (database), S3 (photos), API Gateway WebSocket (real-time), pytest + moto (backend tests), vitest (frontend tests)

**Spec:** `docs/superpowers/specs/2026-03-26-dino-party-game-design.md`

---

## File Structure

### Frontend (`frontend/`)

```
frontend/
  index.html
  vite.config.js
  package.json
  src/
    main.jsx                    # Entry point, mounts App
    app.jsx                     # Router + layout shell
    store.js                    # Simple reactive store (player, dinos, items, feed)
    api.js                      # REST API client (fetch wrapper)
    ws.js                       # WebSocket client with auto-reconnect
    router.jsx                  # Hash-based router
    components/
      BottomNav.jsx             # 5-tab navigation bar
      Onboarding.jsx            # Name + selfie entry
      Plaza.jsx                 # Plaza screen (wraps canvas)
      PlazaCanvas.js            # Canvas rendering: dinos, hats, movement, effects
      MyDinos.jsx               # Dino collection list
      DinoDetail.jsx            # Single dino: stats, customize, set partner
      DinoEncounter.jsx         # Wild dino encounter screen
      DinoTaming.jsx            # Feed + name + starter hat
      PlayMenu.jsx              # Host/join lobby choice + recent plays
      PlayLobby.jsx             # Lobby code display (host) / input (join)
      PlayTrivia.jsx            # Dinos playing + trivia + rewards
      FeedScreen.jsx            # Live activity feed
      EventScan.jsx             # Party event scan result
      InspirationScan.jsx       # Alex's Inspiration result
      NoteScan.jsx              # Explorer's note reveal
      BossBanner.jsx            # "Godzilla is attacking!" overlay
      BossFight.jsx             # Tap-to-attack screen
      BossVictory.jsx           # Victory + confetti
      Profile.jsx               # Name, photo, items, notes
      AdminPanel.jsx            # Dashboard + boss controls + announcements
    data/
      species.js                # 7 species: name, diet, food, flavor text, color regions
      hats.js                   # Hat definitions: id, name, rarity
      natures.js                # Nature pool
    utils/
      colors.js                 # Hue-shift color generation
      sprites.js                # Sprite loading + rendering helpers
      uuid.js                   # UUID generation
    assets/
      sprites/                  # Placeholder PNGs until real art
```

### Backend (`backend/`)

```
backend/
  template.yaml                 # SAM template (all AWS resources)
  samconfig.toml                # SAM deploy config
  src/
    handlers/
      player.py                 # POST /player, GET /player/{id}
      scan_dino.py              # POST /scan/dino/{species}
      scan_food.py              # POST /scan/food/{type}
      scan_event.py             # POST /scan/event/{type}
      scan_inspiration.py       # POST /scan/inspiration
      scan_note.py              # POST /scan/note/{note_id}
      lobby.py                  # POST /lobby, POST /lobby/{code}/join, POST /lobby/{code}/answer
      dino.py                   # PUT /dino/{species}/customize, PUT /dino/{species}/partner
      boss.py                   # POST /boss/tap
      admin.py                  # POST /admin/boss/buildup, /start, /announce, GET /admin/dashboard
      ws_connect.py             # WebSocket $connect
      ws_disconnect.py          # WebSocket $disconnect
      ws_default.py             # WebSocket $default (subscribe to channels)
    shared/
      db.py                     # DynamoDB get/put/query/update/delete helpers
      ws_broadcast.py           # Broadcast to WebSocket connections by channel
      game_data.py              # Species, hats, natures, trivia questions
      response.py               # HTTP response helpers (CORS, JSON)
    requirements.txt
  tests/
    conftest.py                 # Shared fixtures (moto DynamoDB, test data)
    test_player.py
    test_scan_dino.py
    test_scan_food.py
    test_scan_event.py
    test_lobby.py
    test_boss.py
    test_dino.py
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.jsx`
- Create: `backend/requirements.txt`, `backend/src/shared/response.py`
- Create: `.gitignore`

- [ ] **Step 1: Initialize project structure**

```bash
mkdir -p frontend/src/{components,data,utils,assets/sprites}
mkdir -p backend/src/{handlers,shared}
mkdir -p backend/tests
```

- [ ] **Step 2: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.env
__pycache__/
.pytest_cache/
.aws-sam/
.superpowers/
*.pyc
```

- [ ] **Step 3: Create frontend package.json**

Create `frontend/package.json`:
```json
{
  "name": "dino-party",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "preact": "^10.25.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: Create vite.config.js**

Create `frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: '/AlexBirthdayDinos/',
  server: {
    port: 3000,
  },
});
```

- [ ] **Step 5: Create index.html**

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0a0a1a" />
  <title>Dino Party</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a1a;
      color: #e0e0e0;
      min-height: 100dvh;
      overflow-x: hidden;
    }
    #app { min-height: 100dvh; display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 6: Create main.jsx entry point**

Create `frontend/src/main.jsx`:
```jsx
import { render } from 'preact';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));
```

- [ ] **Step 7: Create minimal App**

Create `frontend/src/app.jsx`:
```jsx
export function App() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Dino Party</h1>
      <p>Loading...</p>
    </div>
  );
}
```

- [ ] **Step 8: Create backend requirements.txt**

Create `backend/requirements.txt`:
```
boto3>=1.35.0
```

Create `backend/tests/requirements.txt`:
```
pytest>=8.0.0
moto[dynamodb,s3]>=5.0.0
```

- [ ] **Step 9: Create response helpers**

Create `backend/src/shared/response.py`:
```python
import json


def success(body, status_code=200):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def error(message, status_code=400):
    return success({"error": message}, status_code)
```

- [ ] **Step 10: Install deps and verify**

```bash
cd frontend && npm install
cd ../backend && pip install -r requirements.txt -r tests/requirements.txt
```

- [ ] **Step 11: Verify frontend runs**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts on port 3000, shows "Dino Party" page.

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat: project scaffolding - Preact frontend + Python backend"
```

---

## Task 2: AWS Infrastructure (SAM Template)

**Files:**
- Create: `backend/template.yaml`
- Create: `backend/src/handlers/ws_connect.py`, `ws_disconnect.py`, `ws_default.py`
- Create: `backend/src/shared/db.py`, `backend/src/shared/ws_broadcast.py`

- [ ] **Step 1: Create SAM template**

Create `backend/template.yaml`:
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Dino Party backend

Globals:
  Function:
    Runtime: python3.12
    Timeout: 10
    MemorySize: 256
    Environment:
      Variables:
        TABLE_NAME: !Ref GameTable
        CONNECTIONS_TABLE: !Ref ConnectionsTable
        WEBSOCKET_ENDPOINT: !Sub "https://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod"
        S3_BUCKET: !Ref PhotoBucket

Resources:
  # DynamoDB Tables
  GameTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: dino-party-game
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

  ConnectionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: dino-party-connections
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: connectionId
          AttributeType: S
      KeySchema:
        - AttributeName: connectionId
          KeyType: HASH

  # S3 Bucket for profile pics
  PhotoBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "dino-party-photos-${AWS::AccountId}"
      LifecycleConfiguration:
        Rules:
          - Id: AutoDelete
            Status: Enabled
            ExpirationInDays: 7
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins: ["*"]
            AllowedMethods: [GET, PUT]
            AllowedHeaders: ["*"]

  # REST API
  RestApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowOrigin: "'*'"
        AllowMethods: "'GET,POST,PUT,OPTIONS'"
        AllowHeaders: "'Content-Type'"

  # WebSocket API
  WebSocketApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: dino-party-ws
      ProtocolType: WEBSOCKET
      RouteSelectionExpression: "$request.body.action"

  WebSocketStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref WebSocketApi
      StageName: prod
      AutoDeploy: true

  # WebSocket handlers
  WsConnectFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.ws_connect.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable

  WsConnectPermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref WsConnectFunction
      Principal: apigateway.amazonaws.com

  WsConnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: "$connect"
      Target: !Sub "integrations/${WsConnectIntegration}"

  WsConnectIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WsConnectFunction.Arn}/invocations"

  WsDisconnectFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.ws_disconnect.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable

  WsDisconnectPermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref WsDisconnectFunction
      Principal: apigateway.amazonaws.com

  WsDisconnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: "$disconnect"
      Target: !Sub "integrations/${WsDisconnectIntegration}"

  WsDisconnectIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WsDisconnectFunction.Arn}/invocations"

  WsDefaultFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.ws_default.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"

  WsDefaultPermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref WsDefaultFunction
      Principal: apigateway.amazonaws.com

  WsDefaultRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: "$default"
      Target: !Sub "integrations/${WsDefaultIntegration}"

  WsDefaultIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WsDefaultFunction.Arn}/invocations"

  # REST handlers - Player
  PlayerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.player.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - S3CrudPolicy:
            BucketName: !Ref PhotoBucket
      Events:
        CreatePlayer:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /player
            Method: POST
        GetPlayer:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /player/{id}
            Method: GET

  # REST handlers - Scan
  ScanDinoFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.scan_dino.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        ScanDino:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /scan/dino/{species}
            Method: POST

  ScanFoodFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.scan_food.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        ScanFood:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /scan/food/{type}
            Method: POST

  ScanEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.scan_event.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        ScanEvent:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /scan/event/{type}
            Method: POST

  ScanInspirationFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.scan_inspiration.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        ScanInspiration:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /scan/inspiration
            Method: POST

  ScanNoteFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.scan_note.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
      Events:
        ScanNote:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /scan/note/{note_id}
            Method: POST

  # REST handlers - Lobby
  LobbyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.lobby.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        CreateLobby:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /lobby
            Method: POST
        JoinLobby:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /lobby/{code}/join
            Method: POST
        AnswerTrivia:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /lobby/{code}/answer
            Method: POST

  # REST handlers - Dino customization
  DinoFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.dino.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        CustomizeDino:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /dino/{species}/customize
            Method: PUT
        SetPartner:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /dino/{species}/partner
            Method: PUT

  # REST handlers - Boss
  BossFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.boss.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        BossTap:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /boss/tap
            Method: POST

  # REST handlers - Admin
  AdminFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src.handlers.admin.handler
      CodeUri: .
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GameTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable
        - Statement:
            - Effect: Allow
              Action: execute-api:ManageConnections
              Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
      Events:
        BossBuildup:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/boss/buildup
            Method: POST
        BossStart:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/boss/start
            Method: POST
        Announce:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/announce
            Method: POST
        Dashboard:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/dashboard
            Method: GET

Outputs:
  RestApiUrl:
    Value: !Sub "https://${RestApi}.execute-api.${AWS::Region}.amazonaws.com/prod"
  WebSocketUrl:
    Value: !Sub "wss://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod"
  PhotoBucketName:
    Value: !Ref PhotoBucket
```

- [ ] **Step 2: Create DynamoDB helpers**

Create `backend/src/shared/db.py`:
```python
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
```

- [ ] **Step 3: Create WebSocket broadcast helper**

Create `backend/src/shared/ws_broadcast.py`:
```python
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
```

- [ ] **Step 4: Create WebSocket connect/disconnect/default handlers**

Create `backend/src/handlers/ws_connect.py`:
```python
from ..shared.db import get_connections_table


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    get_connections_table().put_item(
        Item={"connectionId": connection_id, "channels": ["plaza", "feed"]}
    )
    return {"statusCode": 200}
```

Create `backend/src/handlers/ws_disconnect.py`:
```python
from ..shared.db import get_connections_table


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    get_connections_table().delete_item(Key={"connectionId": connection_id})
    return {"statusCode": 200}
```

Create `backend/src/handlers/ws_default.py`:
```python
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
```

- [ ] **Step 5: Add __init__.py files for Python packages**

```bash
touch backend/src/__init__.py
touch backend/src/handlers/__init__.py
touch backend/src/shared/__init__.py
touch backend/tests/__init__.py
```

- [ ] **Step 6: Validate SAM template**

```bash
cd backend && sam validate
```

Expected: Template is valid.

- [ ] **Step 7: Deploy to AWS**

```bash
cd backend && sam build && sam deploy --guided
```

Follow the prompts: stack name `dino-party`, region (your choice), confirm IAM role creation.
Save the output URLs (RestApiUrl, WebSocketUrl, PhotoBucketName) — these go into the frontend config.

- [ ] **Step 8: Create frontend config**

Create `frontend/src/config.js`:
```js
// Replace these after SAM deploy
export const API_URL = import.meta.env.VITE_API_URL || 'https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod';
export const WS_URL = import.meta.env.VITE_WS_URL || 'wss://YOUR_WS_ID.execute-api.REGION.amazonaws.com/prod';
export const PHOTO_BUCKET = import.meta.env.VITE_PHOTO_BUCKET || 'dino-party-photos-ACCOUNT_ID';
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: AWS infrastructure - SAM template, DynamoDB, API Gateway, S3"
```

---

## Task 3: Game Data & Test Fixtures

**Files:**
- Create: `backend/src/shared/game_data.py`
- Create: `frontend/src/data/species.js`, `frontend/src/data/hats.js`, `frontend/src/data/natures.js`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create backend game data**

Create `backend/src/shared/game_data.py`:
```python
import random

SPECIES = {
    "trex": {"name": "T-Rex", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "spinosaurus": {"name": "Spinosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "sail", "belly"]},
    "dilophosaurus": {"name": "Dilophosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "frill", "crest"]},
    "pachycephalosaurus": {"name": "Pachycephalosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "dome", "spots"]},
    "parasaurolophus": {"name": "Parasaurolophus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "crest", "belly"]},
    "triceratops": {"name": "Triceratops", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "frill", "horns"]},
    "ankylosaurus": {"name": "Ankylosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "armor", "club"]},
}

HATS = [
    {"id": "party_hat", "name": "Party Hat", "rarity": "common"},
    {"id": "cowboy_hat", "name": "Cowboy Hat", "rarity": "common"},
    {"id": "top_hat", "name": "Top Hat", "rarity": "common"},
    {"id": "flower_crown", "name": "Flower Crown", "rarity": "common"},
    {"id": "sunglasses", "name": "Sunglasses", "rarity": "common"},
    {"id": "chef_hat", "name": "Chef Hat", "rarity": "common"},
    {"id": "viking_helmet", "name": "Viking Helmet", "rarity": "uncommon"},
    {"id": "wizard_hat", "name": "Wizard Hat", "rarity": "uncommon"},
    {"id": "pirate_hat", "name": "Pirate Hat", "rarity": "uncommon"},
    {"id": "crown", "name": "Crown", "rarity": "uncommon"},
    {"id": "halo", "name": "Halo", "rarity": "uncommon"},
    {"id": "headband", "name": "Headband", "rarity": "common"},
    {"id": "beanie", "name": "Beanie", "rarity": "common"},
    {"id": "bow", "name": "Bow", "rarity": "common"},
    {"id": "birthday_blessing", "name": "Birthday Girl's Blessing", "rarity": "legendary"},
    {"id": "kaiju_slayer", "name": "Kaiju Slayer", "rarity": "legendary"},
]

# Only common/uncommon hats drop randomly. Legendary are special rewards.
DROPPABLE_HATS = [h for h in HATS if h["rarity"] in ("common", "uncommon")]

NATURES = [
    "Bold", "Jolly", "Timid", "Brave", "Gentle", "Quirky",
    "Hasty", "Calm", "Sassy", "Naive", "Lonely", "Adamant",
    "Naughty", "Relaxed", "Modest",
]

LOBBY_SYMBOLS = [
    "meat", "mejoberry", "party_hat", "cowboy_hat", "top_hat",
    "sunglasses", "paint", "bone", "egg", "leaf",
]

TRIVIA = [
    {"question": "What period did the T-Rex live in?", "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"], "answer": 1},
    {"question": "How many horns does a Triceratops have?", "options": ["One", "Two", "Three", "Four"], "answer": 2},
    {"question": "What does 'Pachycephalosaurus' mean?", "options": ["Swift lizard", "Thick-headed lizard", "Armored lizard", "Horned lizard"], "answer": 1},
    {"question": "Which dinosaur had a sail on its back?", "options": ["T-Rex", "Ankylosaurus", "Spinosaurus", "Triceratops"], "answer": 2},
    {"question": "What did Ankylosaurus use its tail club for?", "options": ["Swimming", "Catching prey", "Defense", "Digging"], "answer": 2},
    {"question": "Were dinosaurs warm-blooded or cold-blooded?", "options": ["Warm-blooded", "Cold-blooded", "Likely somewhere in between", "It varied by species"], "answer": 2},
    {"question": "What does 'dinosaur' literally mean?", "options": ["Big lizard", "Ancient reptile", "Terrible lizard", "Dragon beast"], "answer": 2},
    {"question": "Which period came first?", "options": ["Jurassic", "Cretaceous", "Triassic", "Carboniferous"], "answer": 2},
    {"question": "What was the largest flying reptile?", "options": ["Pteranodon", "Quetzalcoatlus", "Archaeopteryx", "Dimorphodon"], "answer": 1},
    {"question": "How long ago did dinosaurs go extinct?", "options": ["50 million years", "66 million years", "100 million years", "200 million years"], "answer": 1},
    {"question": "What asteroid impact killed the dinosaurs?", "options": ["Tunguska", "Chicxulub", "Meteor Crater", "Vredefort"], "answer": 1},
    {"question": "Dilophosaurus was named for its...", "options": ["Two legs", "Two crests", "Two teeth", "Two tails"], "answer": 1},
    {"question": "What is a group of dinosaurs called?", "options": ["A pack", "A herd", "A flock", "All of the above"], "answer": 3},
    {"question": "Which dinosaur is the state fossil of Montana?", "options": ["T-Rex", "Triceratops", "Maiasaura", "Stegosaurus"], "answer": 2},
    {"question": "What did herbivore dinosaurs eat?", "options": ["Fish", "Insects", "Plants", "Other dinosaurs"], "answer": 2},
    {"question": "Parasaurolophus used its crest for...", "options": ["Fighting", "Making sounds", "Smelling", "Balance"], "answer": 1},
    {"question": "How many claws did a T-Rex have on each hand?", "options": ["One", "Two", "Three", "Five"], "answer": 1},
    {"question": "What came first: grass or T-Rex?", "options": ["Grass", "T-Rex", "They appeared at the same time", "Neither existed"], "answer": 0},
    {"question": "Which is NOT a real dinosaur?", "options": ["Dracorex", "Giganotosaurus", "Dracolich", "Nigersaurus"], "answer": 2},
    {"question": "Where were the first dinosaur fossils discovered?", "options": ["North America", "China", "England", "Argentina"], "answer": 2},
    {"question": "What was the smallest known dinosaur?", "options": ["Compsognathus", "Microraptor", "Bee Hummingbird ancestor", "Lesothosaurus"], "answer": 1},
    {"question": "Ankylosaurus belonged to which family?", "options": ["Theropod", "Sauropod", "Thyreophoran", "Ornithopod"], "answer": 2},
    {"question": "What modern animals are descendants of dinosaurs?", "options": ["Lizards", "Crocodiles", "Birds", "Turtles"], "answer": 2},
    {"question": "How fast could a T-Rex run?", "options": ["5 mph", "15-20 mph", "40 mph", "60 mph"], "answer": 1},
    {"question": "What's special about Spinosaurus compared to other large theropods?", "options": ["It could fly", "It was semi-aquatic", "It had armor", "It was venomous"], "answer": 1},
    {"question": "In what era did dinosaurs live?", "options": ["Paleozoic", "Mesozoic", "Cenozoic", "Precambrian"], "answer": 1},
    {"question": "What does 'Triceratops' mean?", "options": ["Three-horned face", "Triple crown", "Three-pointed head", "Triangle lizard"], "answer": 0},
    {"question": "Which dinosaur had the longest neck?", "options": ["Brachiosaurus", "Diplodocus", "Supersaurus", "Argentinosaurus"], "answer": 2},
    {"question": "What color were dinosaurs?", "options": ["Gray", "Green", "We're not entirely sure", "Brown"], "answer": 2},
    {"question": "How did Dilophosaurus actually kill prey? (Not like Jurassic Park)", "options": ["Venom spit", "Frill attack", "Biting and clawing", "Tail whip"], "answer": 2},
]

EXPLORER_NOTES = {
    "note1": "Day 1. Arrived at what the locals call 'Alex's Birthday.' The creatures here are... friendly? One tried to eat my hat.",
    "note2": "Day 3. The Mejoberry supply is running low. The herbivores have started eyeing the veggie platter with alarming intensity.",
    "note3": "Day 5. Befriended a Pachycephalosaurus today. It headbutted me affectionately. I now have a concussion and a best friend.",
    "note4": "Day 7. The Rex has claimed the grill as its territory. Nobody dares approach. We've been eating salad for two days.",
    "note5": "Day 10. There are rumors of something massive approaching from the east. The ground shakes at night. The dinos are restless.",
}


def random_colors(regions):
    """Generate random hue shifts for each color region."""
    return {region: random.randint(0, 359) for region in regions}


def random_nature():
    return random.choice(NATURES)


def random_gender():
    return random.choice(["male", "female"])


def is_shiny():
    return random.random() < 0.05


def random_hat():
    return random.choice(DROPPABLE_HATS)


def random_trivia():
    return random.choice(TRIVIA)


def generate_lobby_code():
    return random.sample(LOBBY_SYMBOLS, 3)
```

- [ ] **Step 2: Create frontend game data**

Create `frontend/src/data/species.js`:
```js
export const SPECIES = {
  trex: {
    id: 'trex', name: 'T-Rex', diet: 'carnivore', food: 'meat',
    regions: ['body', 'belly', 'stripes'],
    flavor: "The apex predator of the party. Will fight you for the last chicken wing.",
  },
  spinosaurus: {
    id: 'spinosaurus', name: 'Spinosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'sail', 'belly'],
    flavor: "Semi-aquatic and fully dramatic. Will splash in any puddle it finds.",
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'frill', 'crest'],
    flavor: "Will absolutely spit on you if you don't bring it meat. Just like Alex's cat.",
  },
  pachycephalosaurus: {
    id: 'pachycephalosaurus', name: 'Pachycephalosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'dome', 'spots'],
    flavor: "Known for headbutting the snack table. Approach from behind.",
  },
  parasaurolophus: {
    id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'crest', 'belly'],
    flavor: "Plays its crest like a trombone at 2am. Neighbors love it.",
  },
  triceratops: {
    id: 'triceratops', name: 'Triceratops', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'frill', 'horns'],
    flavor: "Three horns are better than one. Will charge the piñata on sight.",
  },
  ankylosaurus: {
    id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'armor', 'club'],
    flavor: "Built like a tank. Immune to peer pressure and spicy food.",
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
```

Create `frontend/src/data/hats.js`:
```js
export const HATS = [
  { id: 'party_hat', name: 'Party Hat', rarity: 'common' },
  { id: 'cowboy_hat', name: 'Cowboy Hat', rarity: 'common' },
  { id: 'top_hat', name: 'Top Hat', rarity: 'common' },
  { id: 'flower_crown', name: 'Flower Crown', rarity: 'common' },
  { id: 'sunglasses', name: 'Sunglasses', rarity: 'common' },
  { id: 'chef_hat', name: 'Chef Hat', rarity: 'common' },
  { id: 'viking_helmet', name: 'Viking Helmet', rarity: 'uncommon' },
  { id: 'wizard_hat', name: 'Wizard Hat', rarity: 'uncommon' },
  { id: 'pirate_hat', name: 'Pirate Hat', rarity: 'uncommon' },
  { id: 'crown', name: 'Crown', rarity: 'uncommon' },
  { id: 'halo', name: 'Halo', rarity: 'uncommon' },
  { id: 'headband', name: 'Headband', rarity: 'common' },
  { id: 'beanie', name: 'Beanie', rarity: 'common' },
  { id: 'bow', name: 'Bow', rarity: 'common' },
  { id: 'birthday_blessing', name: "Birthday Girl's Blessing", rarity: 'legendary' },
  { id: 'kaiju_slayer', name: 'Kaiju Slayer', rarity: 'legendary' },
];

export const STARTER_HATS = HATS.filter(h => h.rarity === 'common').slice(0, 4);
export const HAT_MAP = Object.fromEntries(HATS.map(h => [h.id, h]));
```

Create `frontend/src/data/natures.js`:
```js
export const NATURES = [
  'Bold', 'Jolly', 'Timid', 'Brave', 'Gentle', 'Quirky',
  'Hasty', 'Calm', 'Sassy', 'Naive', 'Lonely', 'Adamant',
  'Naughty', 'Relaxed', 'Modest',
];
```

- [ ] **Step 3: Create test conftest.py**

Create `backend/tests/conftest.py`:
```python
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
```

- [ ] **Step 4: Write test for game data**

Create `backend/tests/test_game_data.py`:
```python
from src.shared.game_data import (
    SPECIES, HATS, DROPPABLE_HATS, NATURES, TRIVIA, EXPLORER_NOTES,
    LOBBY_SYMBOLS, random_colors, random_nature, random_gender,
    is_shiny, random_hat, random_trivia, generate_lobby_code,
)


def test_all_species_have_required_fields():
    for key, species in SPECIES.items():
        assert "name" in species
        assert "diet" in species
        assert species["diet"] in ("carnivore", "herbivore")
        assert "food" in species
        assert "regions" in species
        assert len(species["regions"]) >= 2


def test_species_count():
    assert len(SPECIES) == 7


def test_droppable_hats_excludes_legendary():
    for hat in DROPPABLE_HATS:
        assert hat["rarity"] != "legendary"


def test_random_colors_covers_all_regions():
    regions = ["body", "crest", "belly"]
    colors = random_colors(regions)
    assert set(colors.keys()) == set(regions)
    for hue in colors.values():
        assert 0 <= hue <= 359


def test_random_nature_is_valid():
    for _ in range(20):
        assert random_nature() in NATURES


def test_random_gender_is_valid():
    for _ in range(20):
        assert random_gender() in ("male", "female")


def test_lobby_code_has_three_unique_symbols():
    code = generate_lobby_code()
    assert len(code) == 3
    assert len(set(code)) == 3
    for symbol in code:
        assert symbol in LOBBY_SYMBOLS


def test_trivia_has_enough_questions():
    assert len(TRIVIA) >= 25


def test_trivia_format():
    for q in TRIVIA:
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) == 4
        assert "answer" in q
        assert 0 <= q["answer"] <= 3


def test_explorer_notes_count():
    assert len(EXPLORER_NOTES) == 5
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/test_game_data.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: game data - species, hats, natures, trivia, explorer's notes"
```

---

## Task 4: Player API + Onboarding UI

**Files:**
- Create: `backend/src/handlers/player.py`
- Create: `backend/tests/test_player.py`
- Create: `frontend/src/store.js`, `frontend/src/api.js`, `frontend/src/utils/uuid.js`
- Create: `frontend/src/components/Onboarding.jsx`

- [ ] **Step 1: Write player handler tests**

Create `backend/tests/test_player.py`:
```python
import json
from src.handlers.player import handler
from src.shared.db import get_item, query_pk


def _make_event(method, path, body=None, path_params=None):
    return {
        "httpMethod": method,
        "path": path,
        "pathParameters": path_params or {},
        "body": json.dumps(body) if body else None,
        "headers": {},
    }


def test_create_player():
    event = _make_event("POST", "/player", body={
        "id": "player-123",
        "name": "Jake",
    })
    resp = handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["id"] == "player-123"
    assert body["name"] == "Jake"

    item = get_item("PLAYER#player-123", "PROFILE")
    assert item is not None
    assert item["name"] == "Jake"


def test_create_player_missing_name():
    event = _make_event("POST", "/player", body={"id": "p1"})
    resp = handler(event, None)
    assert resp["statusCode"] == 400


def test_get_player():
    # Create first
    create_event = _make_event("POST", "/player", body={
        "id": "player-456",
        "name": "Sarah",
    })
    handler(create_event, None)

    # Get
    get_event = _make_event("GET", "/player/player-456", path_params={"id": "player-456"})
    resp = handler(get_event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["name"] == "Sarah"
    assert "dinos" in body
    assert "items" in body


def test_get_nonexistent_player():
    event = _make_event("GET", "/player/nope", path_params={"id": "nope"})
    resp = handler(event, None)
    assert resp["statusCode"] == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_player.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement player handler**

Create `backend/src/handlers/player.py`:
```python
import json
from datetime import datetime, timezone
from ..shared.db import put_item, get_item, query_pk
from ..shared.response import success, error


def handler(event, context):
    method = event["httpMethod"]
    if method == "POST":
        return create_player(event)
    elif method == "GET":
        return get_player(event)
    return error("Method not allowed", 405)


def create_player(event):
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("id")
    name = body.get("name", "").strip()
    photo_url = body.get("photo_url", "")

    if not player_id or not name:
        return error("id and name are required")

    existing = get_item(f"PLAYER#{player_id}", "PROFILE")
    if existing:
        return success({"id": player_id, "name": existing["name"], "photo_url": existing.get("photo_url", "")})

    item = {
        "PK": f"PLAYER#{player_id}",
        "SK": "PROFILE",
        "name": name,
        "photo_url": photo_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    put_item(item)

    return success({"id": player_id, "name": name, "photo_url": photo_url})


def get_player(event):
    player_id = event["pathParameters"]["id"]
    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    all_items = query_pk(f"PLAYER#{player_id}")

    dinos = []
    items = []
    notes = []
    inspiration = False

    for item in all_items:
        sk = item["SK"]
        if sk.startswith("DINO#"):
            dinos.append({
                "species": sk.replace("DINO#", ""),
                "name": item.get("name", ""),
                "colors": item.get("colors", {}),
                "gender": item.get("gender", ""),
                "nature": item.get("nature", ""),
                "hat": item.get("hat", ""),
                "xp": item.get("xp", 0),
                "level": item.get("level", 1),
                "is_partner": item.get("is_partner", False),
                "tamed": item.get("tamed", False),
                "shiny": item.get("shiny", False),
            })
        elif sk.startswith("ITEM#"):
            items.append({
                "id": sk.replace("ITEM#", ""),
                "type": item.get("type", ""),
                "name": item.get("name", ""),
                "details": item.get("details", {}),
            })
        elif sk.startswith("NOTE#"):
            notes.append(sk.replace("NOTE#", ""))
        elif sk == "INSPIRATION":
            inspiration = True

    return success({
        "id": player_id,
        "name": profile["name"],
        "photo_url": profile.get("photo_url", ""),
        "dinos": dinos,
        "items": items,
        "notes": notes,
        "inspiration": inspiration,
    })
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_player.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Create frontend API client**

Create `frontend/src/api.js`:
```js
import { API_URL } from './config.js';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${API_URL}${path}`, opts);
  const data = await resp.json();

  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  createPlayer: (id, name, photoUrl) =>
    request('POST', '/player', { id, name, photo_url: photoUrl }),

  getPlayer: (id) =>
    request('GET', `/player/${id}`),

  scanDino: (playerId, species) =>
    request('POST', `/scan/dino/${species}`, { player_id: playerId }),

  scanFood: (playerId, type, species) =>
    request('POST', `/scan/food/${type}`, { player_id: playerId, species }),

  scanEvent: (playerId, type, description) =>
    request('POST', `/scan/event/${type}`, { player_id: playerId, description }),

  scanInspiration: (playerId) =>
    request('POST', '/scan/inspiration', { player_id: playerId }),

  scanNote: (playerId, noteId) =>
    request('POST', `/scan/note/${noteId}`, { player_id: playerId }),

  createLobby: (playerId) =>
    request('POST', '/lobby', { player_id: playerId }),

  joinLobby: (playerId, code) =>
    request('POST', `/lobby/${code}/join`, { player_id: playerId }),

  answerTrivia: (playerId, code, answerIndex) =>
    request('POST', `/lobby/${code}/answer`, { player_id: playerId, answer: answerIndex }),

  customizeDino: (playerId, species, updates) =>
    request('PUT', `/dino/${species}/customize`, { player_id: playerId, ...updates }),

  setPartner: (playerId, species) =>
    request('PUT', `/dino/${species}/partner`, { player_id: playerId }),

  bossTap: (playerId) =>
    request('POST', '/boss/tap', { player_id: playerId }),

  adminBossBuildup: () =>
    request('POST', '/admin/boss/buildup'),

  adminBossStart: () =>
    request('POST', '/admin/boss/start'),

  adminAnnounce: (message) =>
    request('POST', '/admin/announce', { message }),

  adminDashboard: () =>
    request('GET', '/admin/dashboard'),
};
```

- [ ] **Step 6: Create UUID utility**

Create `frontend/src/utils/uuid.js`:
```js
export function generateId() {
  return crypto.randomUUID();
}
```

- [ ] **Step 7: Create store**

Create `frontend/src/store.js`:
```js
import { api } from './api.js';
import { generateId } from './utils/uuid.js';

const PLAYER_ID_KEY = 'dino_party_player_id';
const PENDING_ROUTE_KEY = 'dino_party_pending_route';

const listeners = new Set();

export const store = {
  // State
  playerId: localStorage.getItem(PLAYER_ID_KEY),
  player: null,
  loading: true,
  route: window.location.hash.slice(1) || '/plaza',
  bossState: null,

  // Initialize
  async init() {
    if (this.playerId) {
      try {
        this.player = await api.getPlayer(this.playerId);
        this.loading = false;
        this.notify();
      } catch {
        this.loading = false;
        this.notify();
      }
    } else {
      this.loading = false;
      this.notify();
    }
  },

  // Auth
  async register(name, photoUrl) {
    const id = generateId();
    const player = await api.createPlayer(id, name, photoUrl);
    localStorage.setItem(PLAYER_ID_KEY, id);
    this.playerId = id;
    this.player = { ...player, dinos: [], items: [], notes: [], inspiration: false };
    this.notify();
    return player;
  },

  isRegistered() {
    return !!this.playerId;
  },

  // Refresh player data
  async refresh() {
    if (!this.playerId) return;
    this.player = await api.getPlayer(this.playerId);
    this.notify();
  },

  // Routing
  navigate(route) {
    this.route = route;
    window.location.hash = route;
    this.notify();
  },

  setPendingRoute(route) {
    localStorage.setItem(PENDING_ROUTE_KEY, route);
  },

  popPendingRoute() {
    const route = localStorage.getItem(PENDING_ROUTE_KEY);
    localStorage.removeItem(PENDING_ROUTE_KEY);
    return route;
  },

  // Subscriptions
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  notify() {
    listeners.forEach(fn => fn());
  },
};

// Listen for hash changes
window.addEventListener('hashchange', () => {
  store.route = window.location.hash.slice(1) || '/plaza';
  store.notify();
});
```

- [ ] **Step 8: Create Onboarding component**

Create `frontend/src/components/Onboarding.jsx`:
```jsx
import { useState } from 'preact/hooks';
import { store } from '../store.js';

export function Onboarding() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      await store.register(name.trim(), '');
      const pending = store.popPendingRoute();
      if (pending) {
        store.navigate(pending);
      } else {
        store.navigate('/plaza');
      }
    } catch (err) {
      setError('Failed to join. Try again!');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.logo}>🦕</div>
      <h1 style={styles.title}>DINO PARTY</h1>
      <p style={styles.subtitle}>Alex's Birthday Bash</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onInput={(e) => setName(e.target.value)}
          maxLength={20}
          style={styles.input}
          autoFocus
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          style={{
            ...styles.button,
            opacity: loading || !name.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Joining...' : 'JOIN THE PARTY'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100dvh', padding: '20px',
  },
  logo: { fontSize: '64px', marginBottom: '16px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '6px' },
  subtitle: { color: '#888', fontSize: '14px', marginBottom: '32px' },
  form: { width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' },
  input: {
    padding: '14px', borderRadius: '8px', border: '1px solid #333',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: '13px', textAlign: 'center' },
};
```

- [ ] **Step 9: Wire up App with routing**

Create `frontend/src/router.jsx`:
```jsx
import { useEffect, useState } from 'preact/hooks';
import { store } from './store.js';

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick(t => t + 1)), []);
  return store;
}
```

Update `frontend/src/app.jsx`:
```jsx
import { useEffect } from 'preact/hooks';
import { useStore } from './router.jsx';
import { Onboarding } from './components/Onboarding.jsx';

export function App() {
  const { loading, player, route } = useStore();

  useEffect(() => { store.init(); }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <p>Loading...</p>
    </div>;
  }

  // Not registered — show onboarding (but save pending route if it's a scan)
  if (!player) {
    if (route.startsWith('/scan/')) {
      store.setPendingRoute(route);
    }
    return <Onboarding />;
  }

  // Placeholder for routed screens — will be filled in later tasks
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Welcome, {player.name}!</h2>
      <p>Route: {route}</p>
      <p>Dinos: {player.dinos.length}/7</p>
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: player API, onboarding UI, store, routing shell"
```

---

## Task 5: Dino Encounter & Taming API

**Files:**
- Create: `backend/src/handlers/scan_dino.py`, `backend/src/handlers/scan_food.py`
- Create: `backend/tests/test_scan_dino.py`, `backend/tests/test_scan_food.py`

- [ ] **Step 1: Write scan_dino tests**

Create `backend/tests/test_scan_dino.py`:
```python
import json
from src.handlers.scan_dino import handler
from src.shared.db import get_item, put_item


def _event(body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"species": body.get("species", "trex")},
        "body": json.dumps(body),
    }


def test_encounter_new_dino():
    put_item({"PK": "PLAYER#p1", "SK": "PROFILE", "name": "Jake"})
    resp = handler(_event({"player_id": "p1", "species": "trex"}), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["species"] == "trex"
    assert body["tamed"] is False
    assert "colors" in body
    assert "gender" in body
    assert "nature" in body
    assert "shiny" in body

    item = get_item("PLAYER#p1", "DINO#trex")
    assert item is not None
    assert item["tamed"] is False


def test_encounter_already_owned():
    put_item({"PK": "PLAYER#p2", "SK": "PROFILE", "name": "Sarah"})
    put_item({"PK": "PLAYER#p2", "SK": "DINO#trex", "tamed": True, "name": "Rex"})

    resp = handler(_event({"player_id": "p2", "species": "trex"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["already_owned"] is True


def test_encounter_invalid_species():
    put_item({"PK": "PLAYER#p3", "SK": "PROFILE", "name": "Mike"})
    event = _event({"player_id": "p3", "species": "pikachu"})
    event["pathParameters"]["species"] = "pikachu"
    resp = handler(event, None)
    assert resp["statusCode"] == 400
```

- [ ] **Step 2: Implement scan_dino handler**

Create `backend/src/handlers/scan_dino.py`:
```python
import json
from ..shared.db import put_item, get_item
from ..shared.response import success, error
from ..shared.game_data import SPECIES, random_colors, random_nature, random_gender, is_shiny
from ..shared.ws_broadcast import broadcast


def handler(event, context):
    species = event["pathParameters"]["species"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")

    if species not in SPECIES:
        return error(f"Unknown species: {species}")
    if not player_id:
        return error("player_id is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    existing = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if existing:
        return success({
            "already_owned": True,
            "species": species,
            "tamed": existing.get("tamed", False),
            "name": existing.get("name", ""),
        })

    species_data = SPECIES[species]
    shiny = is_shiny()
    colors = random_colors(species_data["regions"])
    gender = random_gender()
    nature = random_nature()

    dino = {
        "PK": f"PLAYER#{player_id}",
        "SK": f"DINO#{species}",
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "hat": "",
        "xp": 0,
        "level": 1,
        "is_partner": False,
        "tamed": False,
        "shiny": shiny,
        "name": "",
    }
    put_item(dino)

    feed_msg = f"✨SHINY✨ {species_data['name']}" if shiny else f"wild {species_data['name']}"
    try:
        broadcast("feed", "new_entry", {
            "type": "encounter",
            "message": f"{profile['name']} encountered a {feed_msg}!",
            "player_name": profile["name"],
        })
    except Exception:
        pass

    return success({
        "species": species,
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "shiny": shiny,
        "tamed": False,
        "diet": species_data["diet"],
        "food": species_data["food"],
        "already_owned": False,
    })
```

- [ ] **Step 3: Run scan_dino tests**

```bash
cd backend && python -m pytest tests/test_scan_dino.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 4: Write scan_food tests**

Create `backend/tests/test_scan_food.py`:
```python
import json
from src.handlers.scan_food import handler
from src.shared.db import put_item, get_item


def _event(food_type, body):
    return {
        "httpMethod": "POST",
        "pathParameters": {"type": food_type},
        "body": json.dumps(body),
    }


def test_tame_with_correct_food():
    put_item({"PK": "PLAYER#p1", "SK": "PROFILE", "name": "Jake"})
    put_item({
        "PK": "PLAYER#p1", "SK": "DINO#trex",
        "tamed": False, "colors": {}, "gender": "male", "nature": "Bold",
        "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "",
    })

    resp = handler(_event("meat", {"player_id": "p1", "species": "trex"}), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["tamed"] is True
    assert body["species"] == "trex"


def test_tame_with_wrong_food():
    put_item({"PK": "PLAYER#p2", "SK": "PROFILE", "name": "Sarah"})
    put_item({
        "PK": "PLAYER#p2", "SK": "DINO#trex",
        "tamed": False, "colors": {}, "gender": "male", "nature": "Bold",
        "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "",
    })

    resp = handler(_event("mejoberries", {"player_id": "p2", "species": "trex"}), None)
    assert resp["statusCode"] == 400


def test_tame_already_tamed():
    put_item({"PK": "PLAYER#p3", "SK": "PROFILE", "name": "Mike"})
    put_item({
        "PK": "PLAYER#p3", "SK": "DINO#ankylosaurus",
        "tamed": True, "colors": {}, "gender": "female", "nature": "Calm",
        "hat": "party_hat", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": "Bumpy",
    })

    resp = handler(_event("mejoberries", {"player_id": "p3", "species": "ankylosaurus"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["already_tamed"] is True


def test_tame_lists_untamed_when_no_species_given():
    put_item({"PK": "PLAYER#p4", "SK": "PROFILE", "name": "Emma"})
    put_item({"PK": "PLAYER#p4", "SK": "DINO#trex", "tamed": False, "colors": {}, "gender": "male", "nature": "Bold", "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": ""})
    put_item({"PK": "PLAYER#p4", "SK": "DINO#spinosaurus", "tamed": False, "colors": {}, "gender": "female", "nature": "Jolly", "hat": "", "xp": 0, "level": 1, "is_partner": False, "shiny": False, "name": ""})

    resp = handler(_event("meat", {"player_id": "p4"}), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["choose_species"] is True
    assert len(body["untamed"]) == 2
```

- [ ] **Step 5: Implement scan_food handler**

Create `backend/src/handlers/scan_food.py`:
```python
import json
from ..shared.db import get_item, update_item, query_pk
from ..shared.response import success, error
from ..shared.game_data import SPECIES
from ..shared.ws_broadcast import broadcast


def handler(event, context):
    food_type = event["pathParameters"]["type"]
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")
    species = body.get("species")

    if food_type not in ("meat", "mejoberries"):
        return error(f"Unknown food type: {food_type}")
    if not player_id:
        return error("player_id is required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # Find untamed dinos that eat this food
    all_items = query_pk(f"PLAYER#{player_id}", "DINO#")
    untamed = []
    for item in all_items:
        sp = item["SK"].replace("DINO#", "")
        if not item.get("tamed") and SPECIES.get(sp, {}).get("food") == food_type:
            untamed.append(sp)

    if not untamed:
        return error("No untamed dinos that eat this food")

    # If no species specified and multiple options, ask user to choose
    if not species and len(untamed) > 1:
        return success({
            "choose_species": True,
            "untamed": untamed,
            "food_type": food_type,
        })

    # If no species specified and only one option, auto-select
    if not species:
        species = untamed[0]

    if species not in SPECIES:
        return error(f"Unknown species: {species}")

    # Verify this food is correct for the species
    if SPECIES[species]["food"] != food_type:
        return error(f"{SPECIES[species]['name']} doesn't eat {food_type}!")

    dino = get_item(f"PLAYER#{player_id}", f"DINO#{species}")
    if not dino:
        return error("You haven't encountered this dino yet")

    if dino.get("tamed"):
        return success({"already_tamed": True, "species": species})

    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})

    try:
        broadcast("feed", "new_entry", {
            "type": "tamed",
            "message": f"{profile['name']} tamed a wild {SPECIES[species]['name']}!",
            "player_name": profile["name"],
        })
    except Exception:
        pass

    return success({"tamed": True, "species": species})
```

- [ ] **Step 6: Run scan_food tests**

```bash
cd backend && python -m pytest tests/test_scan_food.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: dino encounter and taming API with tests"
```

---

## Task 6: Frontend Routing + Encounter/Taming UI

**Files:**
- Create: `frontend/src/components/DinoEncounter.jsx`, `frontend/src/components/DinoTaming.jsx`
- Create: `frontend/src/components/BottomNav.jsx`
- Modify: `frontend/src/app.jsx`

- [ ] **Step 1: Create BottomNav**

Create `frontend/src/components/BottomNav.jsx`:
```jsx
import { store } from '../store.js';

const tabs = [
  { route: '/plaza', icon: '🌿', label: 'Plaza' },
  { route: '/dinos', icon: '🦕', label: 'My Dinos' },
  { route: '/play', icon: '🤝', label: 'Play' },
  { route: '/feed', icon: '📰', label: 'Feed' },
  { route: '/profile', icon: '👤', label: 'Profile' },
];

export function BottomNav() {
  const current = store.route;

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => (
        <button
          key={tab.route}
          onClick={() => store.navigate(tab.route)}
          style={{
            ...styles.tab,
            color: current === tab.route ? '#4ade80' : '#888',
          }}
        >
          <span style={styles.icon}>{tab.icon}</span>
          <span style={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-around',
    background: '#111', borderTop: '1px solid #333',
    padding: '8px 4px 12px', flexShrink: 0,
    position: 'sticky', bottom: 0,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '2px', background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px',
  },
  icon: { fontSize: '20px' },
  label: { fontSize: '10px' },
};
```

- [ ] **Step 2: Create DinoEncounter screen**

Create `frontend/src/components/DinoEncounter.jsx`:
```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';

export function DinoEncounter({ species }) {
  const [dino, setDino] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await api.scanDino(store.playerId, species);
        setDino(result);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [species]);

  if (loading) return <div style={styles.center}><p>Scanning...</p></div>;
  if (error) return <div style={styles.center}><p style={{ color: '#ef4444' }}>{error}</p></div>;

  if (dino.already_owned) {
    return (
      <div style={styles.center}>
        <p>You already have a {SPECIES[species]?.name || species}!</p>
        <button onClick={() => store.navigate('/dinos')} style={styles.button}>View My Dinos</button>
      </div>
    );
  }

  const speciesData = SPECIES[species];

  return (
    <div style={styles.container}>
      <div style={styles.header}>⚡ WILD ENCOUNTER ⚡</div>

      <div style={styles.dinoBox}>
        <div style={{ fontSize: '64px' }}>🦕</div>
      </div>

      <h2>{speciesData?.name || species}</h2>
      {dino.shiny && <div style={styles.shiny}>✨ SHINY ✨</div>}
      <div style={{ color: dino.diet === 'carnivore' ? '#ef4444' : '#22c55e', fontSize: '14px' }}>
        {dino.diet === 'carnivore' ? '🥩 Carnivore' : '🫐 Herbivore'}
      </div>
      <div style={{ color: '#888', fontSize: '12px', margin: '4px 0' }}>
        {dino.gender} · {dino.nature}
      </div>

      <div style={styles.foodHint}>
        <div style={{ color: '#f59e0b' }}>
          {dino.diet === 'carnivore' ? '🥩 This dino wants Meat!' : '🫐 This dino wants Mejoberries!'}
        </div>
        <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
          {dino.diet === 'carnivore'
            ? 'Find the Meat QR near the grill'
            : 'Find the Mejoberry QR near the veggie platters'}
        </div>
      </div>

      <button disabled style={{ ...styles.button, opacity: 0.5 }}>TAME (needs food)</button>
      <button onClick={() => store.navigate('/plaza')} style={{ ...styles.button, background: '#333', marginTop: '8px' }}>
        Back to Plaza
      </button>
    </div>
  );
}

const styles = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px' },
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', gap: '8px' },
  header: { color: '#f59e0b', fontSize: '14px', fontWeight: 'bold' },
  dinoBox: {
    width: '120px', height: '120px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0',
  },
  shiny: { color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' },
  foodHint: {
    background: '#1a1a2e', borderRadius: '8px', padding: '14px', textAlign: 'center',
    margin: '12px 0', width: '100%', maxWidth: '300px',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
};
```

- [ ] **Step 3: Create DinoTaming screen**

Create `frontend/src/components/DinoTaming.jsx`:
```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { STARTER_HATS } from '../data/hats.js';

export function DinoTaming({ foodType }) {
  const [untamed, setUntamed] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [tamed, setTamed] = useState(false);
  const [name, setName] = useState('');
  const [selectedHat, setSelectedHat] = useState(STARTER_HATS[0]?.id || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.scanFood(store.playerId, foodType, null);
        if (result.choose_species) {
          setUntamed(result.untamed);
        } else if (result.tamed) {
          setTamed(true);
          setSelectedSpecies(result.species);
        } else if (result.already_tamed) {
          store.navigate('/dinos');
        }
      } catch (err) {
        // No untamed dinos of this type
        store.navigate('/plaza');
      }
      setLoading(false);
    })();
  }, [foodType]);

  const handleChooseSpecies = async (species) => {
    setLoading(true);
    const result = await api.scanFood(store.playerId, foodType, species);
    if (result.tamed) {
      setTamed(true);
      setSelectedSpecies(species);
    }
    setLoading(false);
  };

  const handleFinish = async () => {
    if (!name.trim()) return;
    await api.customizeDino(store.playerId, selectedSpecies, {
      name: name.trim(),
      hat: selectedHat,
    });
    await store.refresh();
    store.navigate('/dinos');
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80dvh' }}><p>Feeding...</p></div>;

  // Choose which dino to feed
  if (untamed.length > 0 && !tamed) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>Which dino should eat?</h2>
        <p style={{ color: '#888', marginBottom: '16px' }}>You have multiple untamed {foodType === 'meat' ? 'carnivores' : 'herbivores'}</p>
        {untamed.map(sp => (
          <button key={sp} onClick={() => handleChooseSpecies(sp)} style={styles.choiceBtn}>
            {SPECIES[sp]?.name || sp}
          </button>
        ))}
      </div>
    );
  }

  // Name and hat selection
  if (tamed) {
    const speciesData = SPECIES[selectedSpecies];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px' }}>
        <div style={{ color: '#22c55e', fontSize: '14px' }}>✨ TAMING TIME ✨</div>
        <div style={styles.dinoBox}><span style={{ fontSize: '64px' }}>🦕</span></div>
        <h2>{speciesData?.name}</h2>
        <div style={{ color: '#22c55e' }}>❤️ Munching on {foodType === 'meat' ? 'Meat' : 'Mejoberries'}...</div>

        <input
          type="text"
          placeholder="Name your dino!"
          value={name}
          onInput={(e) => setName(e.target.value)}
          maxLength={16}
          style={styles.input}
          autoFocus
        />

        <div style={{ color: '#888', fontSize: '12px' }}>Pick a starter hat:</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {STARTER_HATS.map(hat => (
            <button
              key={hat.id}
              onClick={() => setSelectedHat(hat.id)}
              style={{
                ...styles.hatBtn,
                borderColor: selectedHat === hat.id ? '#4ade80' : '#333',
              }}
              title={hat.name}
            >
              🎩
            </button>
          ))}
        </div>

        <button
          onClick={handleFinish}
          disabled={!name.trim()}
          style={{ ...styles.mainBtn, opacity: name.trim() ? 1 : 0.5 }}
        >
          WELCOME HOME!
        </button>
      </div>
    );
  }

  return null;
}

const styles = {
  dinoBox: {
    width: '120px', height: '120px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  input: {
    padding: '14px', borderRadius: '8px', border: '1px solid #333',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center', width: '100%', maxWidth: '280px',
  },
  hatBtn: {
    width: '48px', height: '48px', background: '#333', borderRadius: '8px',
    border: '2px solid #333', fontSize: '22px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mainBtn: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '280px',
  },
  choiceBtn: {
    display: 'block', width: '100%', maxWidth: '280px', margin: '8px auto',
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px', cursor: 'pointer',
  },
};
```

- [ ] **Step 4: Update App with full routing**

Update `frontend/src/app.jsx`:
```jsx
import { useEffect } from 'preact/hooks';
import { store } from './store.js';
import { useStore } from './router.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DinoEncounter } from './components/DinoEncounter.jsx';
import { DinoTaming } from './components/DinoTaming.jsx';

export function App() {
  const { loading, player, route } = useStore();

  useEffect(() => { store.init(); }, []);

  if (loading) {
    return <div style={styles.loading}><p>Loading...</p></div>;
  }

  if (!player) {
    if (route.startsWith('/scan/')) store.setPendingRoute(route);
    return <Onboarding />;
  }

  return (
    <div style={styles.app}>
      <div style={styles.content}>
        <Screen route={route} />
      </div>
      {!route.startsWith('/scan/') && <BottomNav />}
    </div>
  );
}

function Screen({ route }) {
  // Scan routes
  const scanDino = route.match(/^\/scan\/dino\/(\w+)/);
  if (scanDino) return <DinoEncounter species={scanDino[1]} />;

  const scanFood = route.match(/^\/scan\/food\/(\w+)/);
  if (scanFood) return <DinoTaming foodType={scanFood[1]} />;

  // Main screens (placeholders for now)
  switch (route) {
    case '/plaza': return <Placeholder name="Plaza" />;
    case '/dinos': return <Placeholder name="My Dinos" />;
    case '/play': return <Placeholder name="Play" />;
    case '/feed': return <Placeholder name="Feed" />;
    case '/profile': return <Placeholder name="Profile" />;
    default: return <Placeholder name="Plaza" />;
  }
}

function Placeholder({ name }) {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>{name}</h2>
      <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
  );
}

const styles = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' },
  app: { display: 'flex', flexDirection: 'column', minHeight: '100dvh' },
  content: { flex: 1, overflow: 'auto' },
};
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: dino encounter and taming UI, bottom nav, full routing"
```

---

## Tasks 7-17: Remaining Features

The remaining tasks follow the same TDD pattern established above. Each is summarized here — the implementing agent should reference the spec for full details.

### Task 7: Dino Customization API + My Dinos UI
- `backend/src/handlers/dino.py` — PUT /dino/{species}/customize (rename, hat, paint), PUT /dino/{species}/partner (set partner, unset previous)
- `frontend/src/components/MyDinos.jsx` — list view with dino cards showing species, name, level, XP bar, hat, partner badge
- `frontend/src/components/DinoDetail.jsx` — full detail: flavor text, gender, nature, colors, rename/hat/paint buttons, set partner

### Task 8: Plaza Canvas
- `frontend/src/components/Plaza.jsx` — full-screen canvas wrapper
- `frontend/src/components/PlazaCanvas.js` — canvas rendering engine: background tiles, dino sprites with hop animation, hats, level scaling (1.0x-1.4x), champion crown, shiny sparkle effect
- `frontend/src/utils/sprites.js` — sprite sheet loader, hue-shift rendering via offscreen canvas
- `frontend/src/utils/colors.js` — hue rotation math for color regions
- Fetch plaza state from API on mount, render dinos at positions, animate hops with requestAnimationFrame

### Task 9: WebSocket Client
- `frontend/src/ws.js` — WebSocket client: connect on app load, auto-reconnect with backoff, message dispatch to store, subscribe/unsubscribe actions
- Wire plaza real-time: dino_move updates positions, dino_arrive/dino_leave adds/removes, crown_change updates crown
- Wire feed real-time: new_entry prepends to feed list
- Wire boss events: boss_start triggers boss screen, hp_update animates bar, boss_defeated triggers victory

### Task 10: Social Play — Lobby + Trivia
- `backend/src/handlers/lobby.py` — POST /lobby (create with 3-symbol code, TTL 2min), POST /lobby/{code}/join (match code, push trivia via WS), POST /lobby/{code}/answer (grade answer, award XP + hat if correct, create cooldown)
- `backend/tests/test_lobby.py` — test create, join, answer correct/incorrect, cooldown enforcement
- `frontend/src/components/PlayMenu.jsx` — host/join buttons, recent plays with cooldown timers
- `frontend/src/components/PlayLobby.jsx` — host view (show 3-symbol code), join view (select 3 symbols)
- `frontend/src/components/PlayTrivia.jsx` — split screen: dinos playing on top (canvas), trivia on bottom, transitions to rewards

### Task 11: Live Feed
- `frontend/src/components/FeedScreen.jsx` — scrolling list of feed entries, real-time via WebSocket
- Fetch recent feed entries on mount (GET from DynamoDB FEED partition)
- Add REST endpoint: GET /feed (query FEED PK, return last 50 entries sorted by timestamp desc)

### Task 12: Party Events + Special QR Codes
- `backend/src/handlers/scan_event.py` — validate event type, check once-per-player, award XP + random item, post to feed
- `backend/src/handlers/scan_inspiration.py` — check once-per-player, award 50 XP + Birthday Blessing hat, post to feed
- `backend/src/handlers/scan_note.py` — check once-per-player, store note found, return note text
- `frontend/src/components/EventScan.jsx` — event result screen with optional description input for feed
- `frontend/src/components/InspirationScan.jsx` — special Alex's Inspiration reveal screen
- `frontend/src/components/NoteScan.jsx` — explorer's note reveal with ARK-style parchment aesthetic
- Wire all scan routes in App router

### Task 13: Boss Fight
- `backend/src/handlers/boss.py` — POST /boss/tap (calculate damage from player's total dino levels, update boss HP atomically, broadcast hp_update), handle victory condition
- `backend/src/handlers/admin.py` — POST /admin/boss/buildup (broadcast buildup phase events), POST /admin/boss/start (create BOSS#STATE with HP scaled to player count, broadcast boss_start)
- `frontend/src/components/BossBanner.jsx` — overlay that appears on any screen when boss events fire (buildup shadows, tremors, roar)
- `frontend/src/components/BossFight.jsx` — full screen tap-to-attack: Godzilla sprite, HP bar, damage numbers, screen shake, player damage stat
- `frontend/src/components/BossVictory.jsx` — confetti, MVP shoutout, Kaiju Slayer hat award

### Task 14: Admin Panel
- `backend/src/handlers/admin.py` — GET /admin/dashboard (count players, dinos, feed events), POST /admin/announce (post to feed broadcast)
- `frontend/src/components/AdminPanel.jsx` — secret route /#/admin: dashboard stats, boss buildup phase buttons (Shadows → Tremors → Roar), boss start button, announcement text input, player list
- Wire /#/admin route in App router

### Task 15: Profile Screen
- `frontend/src/components/Profile.jsx` — player name, photo, explorer's notes progress (N/5 found), item inventory grid (hats + paint), inspiration badge

### Task 16: QR Code Generation
- Create `scripts/generate-qr-codes.py` — generates printable QR codes for all game URLs:
  - 7 dino species: `https://SITE/#/scan/dino/{species}`
  - 2 food types: `https://SITE/#/scan/food/meat`, `/#/scan/food/mejoberries`
  - Party events: `https://SITE/#/scan/event/{type}`
  - Alex's Inspiration: `https://SITE/#/scan/inspiration`
  - 5 explorer's notes: `https://SITE/#/scan/note/{1-5}`
- Uses `qrcode` Python library, outputs PNG files with labels

### Task 17: Deploy & Test
- Frontend: `npm run build` in frontend/, deploy dist/ to GitHub Pages via `gh-pages` package or manual push to gh-pages branch
- Backend: `sam build && sam deploy` with production config
- Update `frontend/src/config.js` with real API URLs from SAM output
- End-to-end test: scan QR → onboard → encounter → tame → customize → play → feed → boss
- Generate QR codes with final production URL
- Print QR codes

---

## Dependency Graph

```
Task 1 (scaffolding)
  └─ Task 2 (AWS infra)
       └─ Task 3 (game data)
            ├─ Task 4 (player API + onboarding)
            │    ├─ Task 5 (encounter/taming API)
            │    │    └─ Task 6 (encounter/taming UI)
            │    ├─ Task 7 (customization + My Dinos)
            │    └─ Task 12 (events + special QRs)
            ├─ Task 8 (plaza canvas)
            │    └─ Task 9 (WebSocket + real-time plaza)
            ├─ Task 10 (lobby + trivia)
            │    └─ Task 11 (feed)
            ├─ Task 13 (boss fight)
            └─ Task 14 (admin panel)
       └─ Task 15 (profile) — after Tasks 7, 12
       └─ Task 16 (QR generation) — after Task 17 URL is known
       └─ Task 17 (deploy) — after all features
```

Tasks 7-14 can be parallelized where dependencies allow. Recommended execution order for a single agent: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17.
