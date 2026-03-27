# DynamoDB Schema Reference

## Tables

### Game Table: `dino-party-game`
- **PK** (String): Partition key
- **SK** (String): Sort key
- **ttl** (Number): TTL attribute (epoch seconds) — DynamoDB auto-deletes expired items
- **Billing**: PAY_PER_REQUEST (on-demand)

### Connections Table: `dino-party-connections`
- **connectionId** (String): Partition key (WebSocket connection ID)
- **channels** (List<String>): Subscribed channels

---

## Game Table Key Patterns

### Player Profile
```
PK: PLAYER#{player_id}
SK: PROFILE
Attributes: name, photo_url, created_at
```
Created during registration. photo_url is base64 data URL or empty string.

### Player Dinos
```
PK: PLAYER#{player_id}
SK: DINO#{species}
Attributes: name, colors {region: hue}, gender, nature, hat, xp, level,
            is_partner, tamed, shiny
```
- Created on scan (tamed=false), updated on tame (tamed=true)
- `colors` is a map: `{ body: 120, belly: 45, stripes: 200 }` (hue values 0-359)
- `is_partner` — only one per player, set via /dino/{species}/partner
- `level` 1-5, `xp` resets per level (100 XP per level)

### Player Items (Inventory)
```
PK: PLAYER#{player_id}
SK: ITEM#{uuid}
Attributes: type ("hat" | "paint"), name, details {}
```
- Hats: awarded from trivia/events, equipped via customize
- Paints: consumed when applied to dino region

### Player Notes
```
PK: PLAYER#{player_id}
SK: NOTE#{note_id}  (note1-note5)
```
Existence marker only. 5 total collectible notes.

### Player Inspiration
```
PK: PLAYER#{player_id}
SK: INSPIRATION
```
Existence marker. Once-per-player Alex's blessing.

### Plaza Partners
```
PK: PLAZA
SK: PARTNER#{player_id}
Attributes: species, hat, colors, level, name, owner_name, owner_photo
```
One per player. Updated when partner changes or dino customized. Queried by GET /plaza.

### Feed Entries
```
PK: FEED
SK: {ISO_timestamp}#{uuid}  (e.g., "2026-03-27T14:30:00#abc-123")
Attributes: type, message, player_name, timestamp
```
SK sorts chronologically. Feed types: encounter, tamed, play, event, inspiration, note, boss, announcement.

### Boss State
```
PK: BOSS
SK: STATE
Attributes: hp, max_hp, status ("active" | "defeated"), started_at
```
Single record, created by admin, updated by tap endpoint.

### Trivia Lobbies
```
PK: LOBBY#{code}
SK: META
Attributes: host_id, guest_id, status ("waiting" | "active" | "finished"),
            trivia (question object), symbols, created_at, ttl
```
TTL: 2 minutes (120s from creation). Code is array of 3 symbol strings.

### Lobby Cooldowns
```
PK: COOLDOWN#{pair_key}
SK: META
Attributes: ttl
```
pair_key = sorted player IDs joined (ensures symmetric). TTL: 15 minutes.

### Event Claims
```
PK: EVENT#{player_id}
SK: {event_type}  (cooking_pot, dance_floor, photo_booth, cake_table, mystery_chest)
```
Existence marker. Prevents double-claiming events.

---

## Common Query Patterns

| Operation | Access Pattern |
|-----------|---------------|
| Get full player data | `query_pk("PLAYER#{id}")` → aggregates PROFILE + DINOs + ITEMs + NOTEs + INSPIRATION |
| Get specific dino | `get_item("PLAYER#{id}", "DINO#{species}")` |
| Get partner dino | `query_pk("PLAYER#{id}")` then filter `is_partner=True` |
| Get all plaza dinos | `query_pk("PLAZA")` |
| Get feed | `query_pk("FEED")` → sort by SK desc, limit 50 |
| Check event claimed | `get_item("EVENT#{player_id}", "{event_type}")` |
| Check cooldown | `get_item("COOLDOWN#{pair_key}", "META")` |
| Get boss status | `get_item("BOSS", "STATE")` |
| Get lobby | `get_item("LOBBY#{code}", "META")` |

## Important Notes

- **No GSIs** — all access is PK/SK based
- **TTL is epoch seconds** — use `int(time.time()) + seconds` to set
- **Feed SK format** ensures chronological sort within PK=FEED partition
- **Player deletion** (admin reset): delete all SK items under PLAYER#{id} except PROFILE
- **update_item** uses UpdateExpression with SET for atomic field updates (used for boss HP decrement, lobby status changes)
