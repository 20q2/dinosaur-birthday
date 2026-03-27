# Dino Party - Project Guide

Birthday party game where guests scan QR codes to collect/tame dinosaurs, customize them, play trivia, and fight a boss. Built for Alex's birthday.

## Quick Reference

- **Live**: https://20q2.github.io/dinosaur-birthday/ | Admin: append `#admin`
- **Stack**: Preact + Vite frontend, Python 3.12 Lambda backend, DynamoDB, API Gateway (REST + WebSocket), CDK
- **Frontend dev**: `cd frontend && npm run dev` (port 3000, base path `/dinosaur-birthday/`)
- **Backend tests**: `cd backend && pytest`
- **Deploy**: `cd infra && npx cdk deploy` then rebuild frontend with CDK output URLs
- **Env vars**: `VITE_API_URL`, `VITE_WS_URL`, `VITE_PHOTO_BUCKET` (set in frontend/.env or shell)

## Architecture

| Layer | Tech | Key files |
|-------|------|-----------|
| Frontend | Preact 10, Vite 6 | `frontend/src/app.jsx`, `store.js`, `api.js`, `ws.js` |
| Backend | Python 3.12 Lambdas | `backend/src/handlers/*.py`, `backend/src/shared/*.py` |
| Infra | AWS CDK (TypeScript) | `infra/lib/dino-party-stack.ts` |
| Database | DynamoDB (2 tables) | Game table (PK/SK composite), Connections table |
| Real-time | API Gateway WebSocket | Channels: plaza, feed, boss, lobby:{code} |

## Coding Patterns (FOLLOW THESE)

- **Components**: Preact functional components, `useStore()` hook for global state, inline `styles` object at bottom of file
- **Routing**: Hash-based (`window.location.hash`), matched via regex in `app.jsx:Screen()`
- **State**: Centralized `store.js` with pub/sub (`subscribe`/`notify`), localStorage for `playerId`
- **API calls**: `api.js` wraps `fetch` with JSON, throws on non-ok. Components use try/catch with loading/error state
- **Backend handlers**: `handler(event, context)` → route by httpMethod → shared `success()`/`error()` responses
- **DB access**: `shared/db.py` (put_item, get_item, query_pk, update_item, delete_item)
- **WebSocket**: `shared/ws_broadcast.py` broadcast(channel, type, data) → all subscribed connections
- **Feed entries**: PK=`FEED`, SK=`{ISO_timestamp}#{uuid}`, broadcast to feed channel after creation
- **Styling**: All inline styles (no CSS files), dark theme (#0a0a0a bg, #e0e0e0 text, #6366f1 accent indigo, #1a1a2e cards)

## DynamoDB Key Patterns

| PK | SK | What |
|----|----|------|
| `PLAYER#{id}` | `PROFILE` | Player name, photo_url |
| `PLAYER#{id}` | `DINO#{species}` | Owned dino (colors, level, hat, tamed, shiny...) |
| `PLAYER#{id}` | `ITEM#{uuid}` | Inventory item (hat or paint) |
| `PLAYER#{id}` | `NOTE#{note_id}` | Collected explorer note |
| `PLAYER#{id}` | `INSPIRATION` | Alex's blessing flag |
| `PLAZA` | `PARTNER#{player_id}` | Partner dino on plaza |
| `FEED` | `{timestamp}#{uuid}` | Activity feed entry |
| `BOSS` | `STATE` | Boss fight hp/status |
| `LOBBY#{code}` | `META` | Trivia lobby (TTL 2min) |
| `COOLDOWN#{pair}` | `META` | Lobby cooldown (TTL 15min) |
| `EVENT#{player_id}` | `{event_type}` | Once-per-player event claim |

## Game Data Constants

- **7 species**: trex, spinosaurus, dilophosaurus (carnivore/meat) | pachycephalosaurus, parasaurolophus, triceratops, ankylosaurus (herbivore/mejoberries)
- **3 colorable regions per species** (body + 2 unique), hue values 0-359
- **15 hats**: 6 common, 5 uncommon, 2 legendary (Birthday Blessing, Kaiju Slayer)
- **5 party events**: cooking_pot, dance_floor, photo_booth, cake_table, mystery_chest
- **5 explorer notes**, **30 trivia questions**, **15 natures**, **5% shiny chance**
- **XP**: 100/level, max level 5, only partner dino earns XP
- **XP sources**: trivia correct 50 / incorrect 30, events 25
- **Boss HP**: player_count * 300, damage = 5 + sum(tamed dino levels)

## Gotchas & Lessons

- `photo_url` stored as base64 data URL (no S3 upload yet), resized to 200px JPEG 0.7 quality
- Plaza broadcasts include `owner_photo` — any dino.py partner-set or customize call must re-broadcast updated plaza data
- Lobby codes are 3-symbol arrays (not strings): `["meat", "party_hat", "cowboy_hat"]`
- WebSocket connections auto-subscribe to `plaza` and `feed` channels on connect
- Frontend uses Preact (not React) — import from `preact/hooks`, no `react-dom`
- Vite base path is `/dinosaur-birthday/` — asset paths must account for this
- Admin panel has no auth — accessed via `/#admin` route
- TTL fields are epoch seconds (not ISO) for DynamoDB auto-expiry

## Detailed References

- [Architecture & File Guide](docs/architecture.md)
- [DynamoDB Schema Details](docs/dynamo-schema.md)
- [Game Mechanics & Systems](docs/game-mechanics.md)
