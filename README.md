# Dino Party

A multiplayer dinosaur-collecting party game where guests scan QR codes to discover dinosaurs, tame them with food, customize their collection, compete in trivia, and team up to defeat a Godzilla boss fight — all in real time from their phones.

Built as a birthday party activity. Players move around the venue scanning printed QR codes to trigger encounters, collect items, and interact with the event.

## Links

| | URL |
|-|-----|
| Live App | https://20q2.github.io/dinosaur-birthday/ |
| Admin Panel | https://20q2.github.io/dinosaur-birthday/#admin |
| Repository | https://github.com/20q2/dinosaur-birthday |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Preact, Vite, Vitest |
| Backend | AWS Lambda (Python 3.12), API Gateway, DynamoDB |
| Real-time | WebSocket API (API Gateway V2) |
| Storage | S3 (profile photos, 7-day TTL) |
| Infrastructure | AWS SAM (CloudFormation) |
| QR Codes | Python script (qrcode + Pillow) |

## Features

**Core Gameplay**
- Scan QR codes to encounter 7 dinosaur species (T-Rex, Spinosaurus, Triceratops, etc.)
- Feed dinos their preferred food to tame them and gain XP
- Level up dinos (max level 5, 100 XP per level)
- Customize dinos with names and hat cosmetics (15 hats across common/uncommon/legendary tiers)
- Set a partner dino that appears in the shared Plaza

**Party Events**
- QR-triggered activities: cooking pot, dance floor, photo booth, cake table, mystery chest
- Explorer's notes: 5 collectible lore entries scattered throughout the venue
- Special one-time "Alex's Inspiration" scan with a legendary hat reward

**Multiplayer**
- Lobby system with join codes for head-to-head dinosaur trivia (25 questions)
- Real-time activity feed showing catches, level-ups, and event participation
- Animated Plaza canvas showing all players' partner dinos

**Boss Fight**
- Admin-triggered 3-phase buildup (shadows, tremors, roar)
- Full-screen Godzilla tap-to-attack combat
- Damage scales with total dino levels across your collection
- Real-time HP sync across all players via WebSocket
- "Kaiju Slayer" legendary hat reward on victory

**Admin Panel** (`#admin` route)
- Dashboard with player count, dinos caught, boss status
- Boss buildup phase triggers and start button
- Broadcast announcements to all players

## Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── app.jsx                # Root component and routing
│   │   ├── store.js               # State management
│   │   ├── api.js                 # REST API client
│   │   ├── ws.js                  # WebSocket client
│   │   ├── components/            # All screens (Onboarding, Plaza, MyDinos, BossFight, etc.)
│   │   ├── data/                  # Species, hats, and nature definitions
│   │   └── utils/                 # Colors, sprites, UUID helpers
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── handlers/              # Lambda functions (player, scan_*, lobby, boss, admin, ws_*)
│   │   └── shared/                # DB operations, game data, WebSocket broadcast
│   ├── template.yaml              # SAM CloudFormation template
│   └── requirements.txt
└── scripts/
    └── generate_qr_codes.py       # Generates printable QR code PNGs
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.12+
- AWS CLI configured with credentials
- AWS SAM CLI

### Frontend

```bash
cd frontend
npm install
npm run dev        # Dev server on http://localhost:3000
npm run build      # Production build to dist/
npm test           # Run tests
```

### Backend

```bash
cd backend
pip install -r requirements.txt
sam build
sam deploy --guided   # First deploy (interactive setup)
sam deploy            # Subsequent deploys
```

After deploying, set the output values as environment variables for the frontend:

```bash
VITE_API_URL=<RestApiUrl output>
VITE_WS_URL=<WebSocketUrl output>
VITE_PHOTO_BUCKET=<PhotoBucketName output>
```

### QR Codes

```bash
cd scripts
pip install qrcode pillow
python generate_qr_codes.py    # Outputs PNGs to scripts/output/
```

Print the generated QR codes and place them around the party venue. Each code maps to a specific dino encounter, food item, event station, or explorer's note.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/player` | Create new player |
| GET | `/player/{id}` | Get player data |
| POST | `/scan/dino/{species}` | Encounter a wild dino |
| POST | `/scan/food/{type}` | Feed a dino |
| POST | `/scan/event/{type}` | Participate in party event |
| POST | `/scan/inspiration` | Claim special inspiration item |
| POST | `/scan/note/{note_id}` | Discover explorer's note |
| PUT | `/dino/{species}/customize` | Name dino / equip hat |
| PUT | `/dino/{species}/partner` | Set partner dino |
| POST | `/lobby` | Create trivia lobby |
| POST | `/lobby/{code}/join` | Join lobby |
| POST | `/lobby/{code}/answer` | Submit trivia answer |
| POST | `/boss/tap` | Deal boss damage |
| GET | `/plaza` | Get all partner dinos |
| GET | `/feed` | Get activity feed |
| GET | `/admin/dashboard` | Admin stats |
| POST | `/admin/boss/buildup` | Trigger boss buildup phase |
| POST | `/admin/boss/start` | Start boss fight |
| POST | `/admin/announce` | Broadcast announcement |

## Infrastructure

The SAM template provisions:
- **2 DynamoDB tables**: `dino-party-game` (PK/SK with TTL) and `dino-party-connections` (WebSocket tracking)
- **S3 bucket**: Profile photos with 7-day auto-expiry and CORS
- **REST API**: API Gateway with CORS enabled
- **WebSocket API**: For real-time plaza updates, boss HP sync, feed entries, and lobby events
- **14 Lambda functions**: All Python 3.12, 256MB memory, 10s timeout
