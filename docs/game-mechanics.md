# Game Mechanics & Systems

## Core Game Loop

```
Scan QR → Encounter dino → Find food QR → Tame → Set partner → Earn XP → Customize
                                                  ↕
                                           Trivia lobbies (50/30 XP)
                                           Party events (25 XP + item)
                                           Boss fight (collaborative)
```

## Species

| Species | Diet | Food | Regions | Flavor |
|---------|------|------|---------|--------|
| trex | carnivore | meat | body, belly, stripes | Apex predator, tiny arms |
| spinosaurus | carnivore | meat | body, sail, belly | Semi-aquatic, dramatic |
| dilophosaurus | carnivore | meat | body, frill, crest | Spits without meat |
| pachycephalosaurus | herbivore | mejoberries | body, dome, spots | Headbutt specialist |
| parasaurolophus | herbivore | mejoberries | body, crest, belly | Crest trombone |
| triceratops | herbivore | mejoberries | body, frill, horns | Charges pinatas |
| ankylosaurus | herbivore | mejoberries | body, armor, club | Tank, immune to peer pressure |

Each species has 3 colorable regions. Colors are hue values (0-359). Random on encounter.

## Encounter & Taming

1. **Scan dino QR** → `POST /scan/dino/{species}`
   - Generates: random colors per region, gender (50/50), nature (15 options), 5% shiny
   - Creates untamed DINO record
   - Returns encounter data + diet info

2. **Scan food QR** → `POST /scan/food/{type}` (meat or mejoberries)
   - If species provided: tames that specific dino (validates food match)
   - If multiple untamed match: returns `choose_species=true` with candidate list
   - If one match: auto-tames
   - Sets `tamed=true`

## XP & Leveling

- **Max level**: 5
- **XP per level**: 100 (level * 100 cumulative threshold, but XP resets within level)
- **Only partner dino** receives XP (via `shared/xp.py:award_xp`)
- **Sources**:
  - Trivia correct answer: 50 XP (both players)
  - Trivia incorrect answer: 30 XP (both players)
  - Party event: 25 XP
- **Cap**: At level 5, XP stops accumulating

## Partner Dino

- One per player, set via `PUT /dino/{species}/partner`
- Must be tamed
- Appears on plaza (PLAZA:PARTNER#{player_id})
- All XP earned goes to partner
- Broadcasts `dino_arrive`/`dino_leave` on plaza channel when changed

## Customization

### Rename
- Custom name up to 20 chars
- `PUT /dino/{species}/customize` with `{ name: "Rex" }`

### Hats
- Equip from inventory: `{ hat: "cowboy_hat" }` or unequip: `{ hat: "" }`
- 15 total hats (6 common, 5 uncommon, 2 legendary)
- Drop sources: trivia (random on correct), events (50% chance)

### Paint
- Apply color to one region: `{ paint: { region: "body", color: 320 } }`
- Consumes 1 paint item from inventory
- 18 predefined hue values (Crimson 0, Scarlet 15, Rose 340, etc.)
- Color is a hue value 0-359

## Trivia Lobbies

1. **Host creates** → `POST /lobby` → gets 3-symbol code + lobby record (TTL 2min)
2. **Guest joins** → `POST /lobby/{code}/join` → validates cooldown, broadcasts trivia_start
3. **Both answer** → `POST /lobby/{code}/answer` → scores, awards XP + items
4. **Cooldown**: 15min between same player pair (COOLDOWN#{sorted_ids}:META with TTL)
5. **Symbols**: 10 available emoji symbols, 3 chosen randomly for code
6. **30 trivia questions** about dinosaurs in `game_data.py`

## Party Events

5 once-per-player events (checked via EVENT#{player_id}:{type}):
- cooking_pot, dance_floor, photo_booth, cake_table, mystery_chest
- Each awards: 25 XP to partner + random hat (50%) or paint (50%)
- Feed entry posted with optional description

## Boss Fight

### Buildup (admin-triggered)
- Phase 1: Shadows → Phase 2: Tremors → Phase 3: Roar
- Each broadcasts to plaza channel, shown as global overlay via BossBanner

### Fight
- `POST /admin/boss/start` → HP = connected_players * 300
- `POST /boss/tap` → damage = 5 + sum(player's tamed dino levels)
- HP decremented atomically in DynamoDB
- Real-time HP sync via WebSocket `boss:hp_update`
- Tap throttled to ~3/sec (333ms) on frontend

### Victory
- When HP ≤ 0: awards "Kaiju Slayer" legendary hat to final attacker
- Broadcasts `boss_defeated`, navigates all to /boss/victory
- Feed: "GODZILLA HAS BEEN DEFEATED!"

## Explorer Notes

- 5 lore entries (note1-note5) scattered as QR codes
- `POST /scan/note/{note_id}` → adds NOTE#{id} to player
- Returns note text (story of discovering dinos at the party venue)
- Tracked on Profile page as progress bar

## Alex's Inspiration

- Special one-time scan: `POST /scan/inspiration`
- Awards "Birthday Girl's Blessing" legendary hat
- Sets INSPIRATION marker on player
- Shown as golden badge on Profile page

## Activity Feed

- All notable actions post to FEED partition (PK=FEED, SK=timestamp#uuid)
- Types: encounter, tamed, play, event, inspiration, note, boss, announcement
- Broadcast via WebSocket `feed:new_entry`
- Displayed in FeedScreen (full) and Plaza (mini, last 5)
- Admin announcements via `POST /admin/announce`

## Admin Capabilities

| Action | Endpoint | Notes |
|--------|----------|-------|
| Dashboard stats | GET /admin/dashboard | Player count, dino counts, boss status |
| Boss buildup | POST /admin/boss/buildup | Phase 1/2/3 |
| Start boss | POST /admin/boss/start | HP scales with player count |
| Announce | POST /admin/announce | Global feed message |
| Reset player | DELETE /admin/reset?player_id=X | Keeps PROFILE |
| Reset all | DELETE /admin/reset-all | Keeps all PROFILEs |
| QR codes | Frontend AdminQRCodes | Display/print codes |
| Simulator | Frontend AdminSimulator | Trigger scans manually |
| Bots | Frontend AdminBots | Spawn fake players |
