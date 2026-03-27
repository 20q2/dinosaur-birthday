# Architecture & File Reference

## Project Structure

```
AlexBirthdayDinos/
├── frontend/                     # Preact + Vite SPA
│   ├── src/
│   │   ├── main.jsx              # Entry: renders App to #app
│   │   ├── app.jsx               # Root component, routing, WS init
│   │   ├── router.jsx            # useStore() hook (pub/sub to store)
│   │   ├── store.js              # Global state (player, route, boss, feed)
│   │   ├── api.js                # REST API client (all endpoints)
│   │   ├── ws.js                 # WebSocket client (reconnect, channels)
│   │   ├── config.js             # VITE_API_URL, VITE_WS_URL, VITE_PHOTO_BUCKET
│   │   ├── components/
│   │   │   ├── Onboarding.jsx    # Registration: name + selfie upload
│   │   │   ├── Plaza.jsx         # Animated plaza canvas + mini feed
│   │   │   ├── PlazaCanvas.js    # Canvas rendering of partner dinos
│   │   │   ├── MyDinos.jsx       # Dino collection list
│   │   │   ├── DinoDetail.jsx    # Customize: rename, hat, paint, partner
│   │   │   ├── DinoSprite.jsx    # Canvas-based recolored sprite renderer
│   │   │   ├── DinoEncounter.jsx # Wild dino scan result
│   │   │   ├── DinoTaming.jsx    # Feed food to tame
│   │   │   ├── PlayMenu.jsx      # Create/join trivia lobby
│   │   │   ├── PlayLobby.jsx     # Waiting room (host shows code)
│   │   │   ├── PlayTrivia.jsx    # Answer trivia question
│   │   │   ├── EventScan.jsx     # Party event participation
│   │   │   ├── InspirationScan.jsx # Alex's blessing scan
│   │   │   ├── NoteScan.jsx      # Explorer note discovery
│   │   │   ├── BossBanner.jsx    # Global buildup overlay (phases 1-3)
│   │   │   ├── BossFight.jsx     # Tap-to-attack boss screen
│   │   │   ├── BossVictory.jsx   # Victory celebration
│   │   │   ├── FeedScreen.jsx    # Full activity feed
│   │   │   ├── Profile.jsx       # Player profile + stats + inventory
│   │   │   ├── BottomNav.jsx     # Tab bar (plaza, dinos, play, feed, profile)
│   │   │   ├── AdminPanel.jsx    # Admin tabs container
│   │   │   ├── AdminQRCodes.jsx  # QR code display/print
│   │   │   ├── AdminSimulator.jsx # Manual scan triggering
│   │   │   └── AdminBots.jsx     # Fake player spawning
│   │   ├── data/
│   │   │   ├── species.js        # SPECIES object (7 dinos, diet, regions, flavor)
│   │   │   └── hats.js           # HATS array, HAT_MAP, STARTER_HATS
│   │   ├── utils/
│   │   │   ├── spriteEngine.js   # Pixel-art recoloring (HSV hue shift)
│   │   │   ├── colors.js         # HSL/RGB/HSV conversions
│   │   │   ├── sprites.js        # getSpeciesEmoji() helper
│   │   │   └── uuid.js           # generateId() for player IDs
│   │   └── assets/               # Sprite PNGs for each species + plaza bg
│   ├── vite.config.js            # Base: /dinosaur-birthday/, port 3000
│   └── package.json              # preact, vite, vitest
│
├── backend/                      # Python 3.12 Lambda handlers
│   ├── src/
│   │   ├── shared/
│   │   │   ├── db.py             # DynamoDB CRUD (put, get, query, update, delete)
│   │   │   ├── response.py       # success(body), error(msg, code)
│   │   │   ├── game_data.py      # SPECIES, HATS, TRIVIA, NATURES, helpers
│   │   │   ├── xp.py             # award_xp(player_id, amount) → partner dino
│   │   │   └── ws_broadcast.py   # broadcast(channel, type, data)
│   │   └── handlers/
│   │       ├── player.py         # POST/GET /player
│   │       ├── scan_dino.py      # POST /scan/dino/{species}
│   │       ├── scan_food.py      # POST /scan/food/{type}
│   │       ├── scan_event.py     # POST /scan/event/{type}
│   │       ├── scan_inspiration.py # POST /scan/inspiration
│   │       ├── scan_note.py      # POST /scan/note/{note_id}
│   │       ├── dino.py           # PUT /dino/{species}/customize, /partner
│   │       ├── lobby.py          # POST /lobby, /lobby/{code}/join, /answer
│   │       ├── boss.py           # POST /boss/tap
│   │       ├── plaza.py          # GET /plaza
│   │       ├── feed.py           # GET /feed
│   │       ├── admin.py          # GET/POST/DELETE /admin/*
│   │       ├── ws_connect.py     # $connect
│   │       ├── ws_disconnect.py  # $disconnect
│   │       └── ws_default.py     # $default (subscribe/unsubscribe)
│   ├── tests/                    # pytest tests for each handler
│   └── requirements.txt          # boto3
│
├── infra/                        # AWS CDK (TypeScript)
│   ├── lib/dino-party-stack.ts   # All AWS resources (16 Lambdas, DDB, S3, APIs)
│   ├── bin/app.ts                # CDK app entry
│   └── package.json              # aws-cdk-lib
│
├── scripts/                      # QR code generation
└── docs/superpowers/             # Design specs and implementation plans
```

## Frontend Patterns

### State Flow
```
User action → api.someEndpoint() → Backend Lambda → DynamoDB
                                  → ws_broadcast() → WebSocket
                                                   → ws.on(channel, type, handler)
                                                   → store.notify() → useStore() re-render
```

### Component Template
```jsx
import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../router.jsx';
import { store } from '../store.js';
import { api } from '../api.js';

export function MyComponent({ prop }) {
  const { player, playerId } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.endpoint(playerId, prop);
      setData(result);
      await store.refresh(); // Reload player data if needed
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      {/* content */}
    </div>
  );
}

const styles = {
  page: { padding: '20px 16px 80px', maxWidth: '480px', margin: '0 auto' },
};
```

### Style Conventions
- Dark theme: bg `#0a0a0a`, cards `#111` border `#1a1a2e`, text `#e0e0e0`
- Accent: indigo `#6366f1`, success `#22c55e`, warning `#f59e0b`, error `#ef4444`
- All inline styles (no CSS files, no CSS modules)
- Mobile-first, `maxWidth: '480px'`, `minHeight: '100dvh'`
- Bottom padding `80px` on pages (for BottomNav)

### Navigation
```jsx
store.navigate('/dinos');          // Hash navigation
store.navigate(`/dinos/${species}`);
// Route matched in app.jsx Screen():
const match = route.match(/^\/dinos\/(\w+)/);
if (match) return <DinoDetail species={match[1]} />;
```

## Backend Patterns

### Handler Template
```python
import json
from ..shared.db import get_item, put_item, query_pk
from ..shared.response import success, error
from ..shared.ws_broadcast import broadcast

def handler(event, context):
    method = event["httpMethod"]
    if method == "POST":
        return post_handler(event)
    return error("Method not allowed", 405)

def post_handler(event):
    body = json.loads(event.get("body") or "{}")
    player_id = body.get("player_id")
    if not player_id:
        return error("player_id required")

    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    if not profile:
        return error("Player not found", 404)

    # ... business logic ...

    # Post to feed
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    put_item({"PK": "FEED", "SK": f"{ts}#{uuid.uuid4()}", ...})
    broadcast("feed", "new_entry", {...})

    return success(response_data)
```

### Adding a New Endpoint
1. Create handler in `backend/src/handlers/new_handler.py`
2. Add Lambda + API route in `infra/lib/dino-party-stack.ts`
3. Grant DynamoDB/WS permissions in CDK
4. Add api method in `frontend/src/api.js`
5. Write tests in `backend/tests/test_new_handler.py`

## WebSocket Flow
```
Client                          Server
  |-- connect ------------------>| ws_connect: store connectionId, channels: [plaza, feed]
  |-- {action: subscribe,   --->| ws_default: append channel to connection
  |    channel: "boss"}          |
  |                              |
  |    (some handler runs)       |
  |                              |-- broadcast("boss", "hp_update", {...})
  |<-- {channel, type, data} ---|    scans connections table, sends to matching
  |                              |
  |-- disconnect --------------->| ws_disconnect: delete connection record
```
