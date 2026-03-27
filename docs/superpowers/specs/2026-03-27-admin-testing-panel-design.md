# Admin Testing Panel Design

## Purpose

Expand the admin panel into a full game testing tool so a solo developer can walk through every game feature, spawn bots for multiplayer testing, and reset state between test runs — all from `/#/admin`.

## Architecture

The admin panel becomes a tabbed interface with 5 tabs. The existing dashboard content is extracted into its own component. Each tab is a separate file for manageability.

**Frontend files:**
- `AdminPanel.jsx` — tab shell with horizontal tab bar, renders active tab component
- `AdminDashboard.jsx` — extracted from current AdminPanel (stats, player list, boss controls, announcements)
- `AdminQRCodes.jsx` — clickable grid of all 20 scan URLs
- `AdminSimulator.jsx` — player selector + step-by-step API action caller
- `AdminBots.jsx` — spawn and control fake players
- `AdminReset.jsx` — per-player and full game reset

**Backend additions to `admin.py`:**
- `DELETE /admin/reset?player_id=X` — wipe a player's game data (keep profile)
- `DELETE /admin/reset-all` — wipe the entire game table

**SAM template:** Add DELETE method to the existing AdminFunction resource.

## Tab 1: Dashboard

Extracted from the current AdminPanel.jsx with no behavior changes:
- Player count, dino count, tamed count
- Player list with names
- Boss buildup controls (phase 1/2/3), boss start button
- Announcement text input + send

## Tab 2: QR Codes

All 20 scan URLs as clickable buttons that navigate to the real scan routes. Grouped by category with headers.

**Dinos (7):**
| Label | Route |
|-------|-------|
| T-Rex | `/#/scan/dino/trex` |
| Spinosaurus | `/#/scan/dino/spinosaurus` |
| Dilophosaurus | `/#/scan/dino/dilophosaurus` |
| Pachycephalosaurus | `/#/scan/dino/pachycephalosaurus` |
| Parasaurolophus | `/#/scan/dino/parasaurolophus` |
| Stegosaurus | `/#/scan/dino/stegosaurus` |
| Triceratops | `/#/scan/dino/triceratops` |

**Food (2):**
| Label | Route |
|-------|-------|
| Meat | `/#/scan/food/meat` |
| Mejoberries | `/#/scan/food/mejoberries` |

**Events (5):**
| Label | Route |
|-------|-------|
| Cooking Pot | `/#/scan/event/cooking_pot` |
| Dance Floor | `/#/scan/event/dance_floor` |
| Photo Booth | `/#/scan/event/photo_booth` |
| Cake Table | `/#/scan/event/cake_table` |
| Mystery Chest | `/#/scan/event/mystery_chest` |

**Special (1):**
| Label | Route |
|-------|-------|
| Alex's Inspiration | `/#/scan/inspiration` |

**Notes (5):**
| Label | Route |
|-------|-------|
| Note #1 | `/#/scan/note/1` |
| Note #2 | `/#/scan/note/2` |
| Note #3 | `/#/scan/note/3` |
| Note #4 | `/#/scan/note/4` |
| Note #5 | `/#/scan/note/5` |

Each button shows the label in large text and the category as a small color-coded subtitle. Carnivore dinos show red, herbivore green.

## Tab 3: Simulator

An admin-only interface for calling game APIs as a specific player.

### Player Selector
- Dropdown of existing players (populated from dashboard API's `player_list`)
- "Create Test Player" button — generates a UUID, calls POST /player with name "TestPlayer-N" (auto-incrementing), selects the new player
- Selected player's stats shown inline: name, dino count, tamed count, items, notes found, level of partner dino

### Action Sections

Each section is a collapsible group. Every action shows the raw JSON API response in a styled response box below the controls.

**Scan Dino:**
- Species dropdown (all 7)
- "Encounter" button — calls `POST /scan/dino/{species}` with selected player ID
- Response shows: wild dino stats, shiny status, already_owned flag

**Tame Dino:**
- Food type dropdown (meat / mejoberries)
- Optional species dropdown (for multi-choice scenario)
- "Feed" button — calls `POST /scan/food/{type}`
- Response shows: tamed result or choose_species list

**Customize Dino:**
- Species dropdown (filtered to player's tamed dinos after refresh)
- Name text input
- Hat dropdown (all hats from HATS data)
- "Set as Partner" checkbox
- "Save" button — calls `PUT /dino/{species}/customize` and optionally `PUT /dino/{species}/partner`

**Social Play:**
- "Create Lobby" button — calls `POST /lobby`, shows the 3-symbol code
- "Join Lobby" text input for code + "Join" button — calls `POST /lobby/{code}/join`, response includes the trivia question and options
- After joining: shows the trivia question text + 4 answer buttons that call `POST /lobby/{code}/answer`
- Note: In the real game, the host gets trivia via WebSocket. In the simulator, the join response returns the trivia directly, so no WS needed.

**Scan Event:**
- Event type dropdown (5 types)
- "Claim" button — calls `POST /scan/event/{type}`

**Scan Inspiration:**
- "Claim Inspiration" button — calls `POST /scan/inspiration`

**Scan Note:**
- Note ID dropdown (1-5)
- "Read Note" button — calls `POST /scan/note/{id}`
- Response shows the note text

**Boss Tap:**
- "Tap Boss" button — calls `POST /boss/tap`
- Shows damage dealt and remaining HP

**Refresh Player:**
- "Refresh" button at top — reloads the selected player's full data from `GET /player/{id}`

## Tab 4: Bots

Frontend-only automation that calls the same REST APIs with fake player IDs.

### Bot Management
- "Spawn Bot" button — creates a player via `POST /player` with name "Bot-{random dino name}" (e.g., "Bot-Rex", "Bot-Stego"), adds to the active bots list
- Active bots list showing: name, ID, current state (idle / busy), dino count
- "Remove Bot" button per bot (just removes from local list, doesn't delete backend data)

### Bot Actions

Per-bot actions (buttons next to each bot):
- **Auto-Collect** — sequentially: encounter a random species, tame with correct food, name the dino "{BotName}'s {Species}", set as partner. Calls 3-4 APIs in sequence.
- **Join Lobby** — text input for lobby code. Bot joins and auto-answers trivia (random answer index 0-3).
- **Boss Tap x10** — fires `POST /boss/tap` 10 times in rapid sequence with the bot's player ID. Shows total damage dealt.

Bulk actions (apply to all bots):
- "All Auto-Collect" — runs auto-collect for every bot
- "All Join Lobby" — all bots join a specified lobby code
- "All Boss Tap" — all bots tap 10 times each

Bot state and list are ephemeral (not persisted). Refreshing the page clears bots.

## Tab 5: Reset

Dangerous operations with clear warnings.

### Per-Player Reset
- Player dropdown (same as simulator)
- "Reset Player" button with red styling
- Confirmation dialog: "Reset all game data for {name}? This keeps their profile but removes all dinos, items, notes, inspiration, and cooldowns."
- Calls `DELETE /admin/reset?player_id=X`

### Full Game Reset
- "Reset Everything" button with red styling and warning icon
- Double confirmation: text input that requires typing "RESET" to enable the button
- Calls `DELETE /admin/reset-all`
- Warning text: "This deletes ALL data — every player's dinos, items, notes, the plaza, feed, boss state, lobbies, and cooldowns. Player profiles are kept."

### Backend: DELETE /admin/reset

Receives `player_id` query parameter. Queries all items with PK `PLAYER#{player_id}` and deletes everything except the item with SK `PROFILE`. Also deletes the player's PLAZA entry (PK `PLAZA`, SK `PARTNER#{player_id}`). Deletes any COOLDOWN items containing the player_id. Returns count of deleted items.

### Backend: DELETE /admin/reset-all

Scans the entire game table. Deletes all items EXCEPT those with SK `PROFILE` (preserves player registrations). Uses batch_write with delete requests, handling the 25-item-per-batch DynamoDB limit. Returns total count of deleted items.

## Styling

Follows the existing dark theme:
- Tab bar: horizontal, sticky at top of admin page, dark background (#111), active tab highlighted with purple (#6366f1) underline
- Each tab's content scrolls independently below the tab bar
- Response boxes for API results: monospace font, dark background (#0a0a0a), green border for success, red border for errors
- Danger buttons (reset): red background (#dc2626)
- Bot status indicators: green dot for idle, amber spinner for busy

## Error Handling

All API calls in the simulator and bot tabs show errors inline in the response box (red text). No silent failures. Network errors show the raw error message.
