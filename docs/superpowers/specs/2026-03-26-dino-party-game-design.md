# Dino Party — Game Design Spec

A web-based mobile party game for Alex's birthday. Players scan QR codes at a real-life party to discover, tame, and customize pixel-art dinosaurs. Social mechanics encourage mingling, and the night culminates in a collective boss fight against Godzilla.

## Context

- **Event**: Alex's birthday party
- **Players**: 30–40 guests
- **Timeline**: 2 weeks to build
- **Security model**: Honor system — this is a one-time party game, not a bank

## Platform

- **Frontend**: Static site on GitHub Pages. Single-page app (Preact or vanilla JS). Mobile-first, vertical phone layout.
- **Backend**: AWS — API Gateway (REST + WebSocket), Lambda (Python 3.12), DynamoDB (single table, on-demand), S3 (profile pics with 7-day lifecycle).
- **QR codes**: Printed and placed around the party. Each encodes a URL with route parameters. Scanned with the phone's native camera — no in-app scanner needed.

## Dinosaur Species

| Species            | Diet      | Food QR     |
|--------------------|-----------|-------------|
| T-Rex              | Carnivore | Meat        |
| Spinosaurus        | Carnivore | Meat        |
| Dilophosaurus      | Carnivore | Meat        |
| Pachycephalosaurus | Herbivore | Mejoberries |
| Parasaurolophus    | Herbivore | Mejoberries |
| Triceratops        | Herbivore | Mejoberries |
| Ankylosaurus       | Herbivore | Mejoberries |

**Boss**: Godzilla (not collectible — the final enemy)

## Core Game Loop

The loop is designed to make players good party guests:

1. **Explore** — Wander the party looking for dino QR codes hidden in social areas.
2. **Discover** — Scan a dino QR. A wild dino appears with a unique random color combination. It is untamed — visible but not yet yours.
3. **Feed** — Find the correct food QR (meat near the grill/meat dishes, mejoberries near veggie/fruit platters). Scan it. If you have multiple untamed dinos of that diet, pick which one to feed.
4. **Name & Hat** — Name your dino and pick a starter hat.
5. **Socialize** — Find another player IRL, set up a play lobby, answer a dino trivia question together. Earn XP + a random hat. Bonus XP or rare hat for a correct answer.
6. **Party events** — Activities like the "cooking pot" (making a mixed drink). Scan the event QR, optionally describe what happened (e.g., the drink recipe). Earn XP + a random item (hat or paint).
7. **Collect & customize** — Level up dinos with XP, equip hats, use paint to recolor, set your partner for the plaza.
8. **Boss fight** — Godzilla raid triggered by the host. Everyone taps to attack. Collective victory.

**Why this encourages good party behavior**:
- Dinos are hidden in social areas, not corners
- Taming requires visiting food stations (people eat)
- Social play requires finding someone IRL and cooperating on trivia
- Play cooldown (15–20 min per pair) encourages meeting new people
- Cooking pot rewards making drinks (people mingle at the bar)
- Feed gives FOMO to go do things
- Alex's Inspiration QR rewards entertaining the birthday girl

## Player Onboarding

First QR scan of any kind lands on the site:
1. Enter display name
2. Take/upload a selfie (optional but encouraged — helps people find each other)
3. Player ID generated client-side (UUID), stored in localStorage
4. Player is created in the database
5. Redirected to the encounter/event from the original QR, or to the plaza if it was a generic join code

Return visits: localStorage has the player ID, so the app skips onboarding and goes straight to the relevant screen or the plaza.

## Dino Instances

Each player can have at most one of each species (7 max). Each dino instance has:

- **Species**: one of the 7
- **Colors**: random color combination applied to the sprite at creation. Multiple colorable regions per species. Can be changed later with paint items.
- **Name**: player-chosen
- **Gender**: randomly assigned (male/female), displayed on detail screen, no mechanical effect
- **Nature**: randomly assigned from a pool (Bold, Jolly, Timid, Brave, Gentle, Quirky, etc.), displayed on detail screen, no mechanical effect
- **XP & Level**: starts at level 1, cap at level 5. 100 XP per level (500 XP total to max). Leveling has no mechanical effect except boss fight damage and visual size scaling.
- **Hat**: one equipped at a time, visible in the plaza
- **Tamed**: boolean — must scan the correct food QR to tame
- **Partner**: boolean — one dino at a time can be the player's partner, displayed in the plaza. All other dinos stay in the collection.
- **Shiny**: boolean — ~5% chance at creation. Sparkle effect on sprite. Pure bragging rights.

**Level size scaling**: Dinos get slightly larger at each level, visible in the plaza as a flex.

**Champion crown**: The highest-level partner dino currently in the plaza gets an automatic crown overlay. Ties: all tied dinos get it. Updates live as people level up.

## Items

Two item types, both cosmetic:

### Hats
- Pool of ~15–20 hat designs (party hat, cowboy hat, crown, top hat, flower crown, sunglasses, chef hat, viking helmet, wizard hat, pirate hat, etc.)
- One hat equipped per dino at a time
- Visible on the dino's sprite in the plaza
- Earned from: social play (guaranteed drop), trivia bonus (rare hat), party events, Alex's Inspiration
- Starter hat chosen during taming

### Paint
- Consumable item — one-time use
- Recolors one region of a dino's sprite
- Player picks the region and the new color
- Earned from: social play, party events

## The Plaza (Home Screen)

The plaza is the home screen — where players land after onboarding and on every return visit.

- **Top-down pixel art** scene with grass, decorations, maybe a little pond
- Each player's **partner dino** hops/wanders around with random movement paths assigned server-side
- One dino per player in the plaza (30–40 dinos max) — clean and readable
- Each dino wears its equipped hat
- Dinos scale slightly larger based on level
- Champion crown on the strongest partner dino
- **Tap a dino** to see: dino name, species, level, owner name, owner photo
- Real-time updates via WebSocket — see new dinos arrive, movements update
- Players can switch their partner anytime from the My Dinos screen

### Bottom Navigation Bar

| Tab      | Icon | Destination                    |
|----------|------|--------------------------------|
| Plaza    | 🌿   | The plaza (home)              |
| My Dinos | 🦕   | Your dino collection          |
| Play     | 🤝   | Host or join a play lobby     |
| Feed     | 📰   | Live party activity feed      |
| Profile  | 👤   | Your name, photo, item inventory |

## Social Play

### Lobby System
1. Player A taps "Host a Lobby" → server generates a 3-symbol code using game items as symbols (e.g., Meat + Top Hat + Paint). Lobby expires after 2 minutes.
2. Player A shows the code to Player B in person.
3. Player B taps "Join a Lobby" → selects the 3 symbols to match the code.
4. Match confirmed → both players see a dino trivia question.

### Trivia
- Multiple choice (4 options), dinosaur-themed
- Both players see the same question. Either player can submit the answer.
- **Correct**: base XP + bonus XP + guaranteed hat drop (chance of rare hat)
- **Incorrect**: base XP + guaranteed hat drop (common hat)
- Pool of ~30–50 trivia questions, pre-loaded

### Cooldown
- After playing together, the same pair cannot play again for 15–20 minutes
- Recent plays shown on the Play screen with countdown timers
- Encourages meeting new people

### Play Animation
After trivia, a short animation of the two players' dinos playing together. Then the rewards screen.

## Live Feed

The 5th tab — a scrolling activity feed showing what's happening at the party in real time:

- "Andrew brewed a Health Potion (Beer + Lemonade) 🧪"
- "Sarah tamed a wild Spinosaurus! 🦖"
- "Jake and Mike's dinos played together! 🤝"
- "Emma's Rex 'Chompers' reached Level 4! ⬆️"
- "Alex blessed Jake with Inspiration! ✨"

When scanning a party event QR, players get an optional prompt to describe what happened (e.g., the drink recipe). This description appears in the feed entry.

Real-time via WebSocket — new entries appear live for everyone.

## Party Events

Party events are real-world activities with associated QR codes:

- **Cooking Pot**: Making a mixed drink. Scan the QR, optionally describe the recipe. Rewards: XP + random item.
- Additional events can be added by creating new QR codes with event-type URLs.

Each event QR can be scanned once per player. Rewards: ~25 XP + random item (hat or paint). Event scans post to the live feed.

## Alex's Inspiration

Alex (the birthday girl) gets a special printed QR code — her personal "DM Inspiration" token.

- Any player can scan it to receive a chunk of bonus XP (~50 XP) and a unique "Birthday Girl's Blessing" hat (only obtainable this way)
- Each player can only receive Inspiration once (server enforces)
- Scanning posts to the feed: "Alex blessed [player] with Inspiration! ✨"
- Encourages guests to entertain Alex — like a DM giving inspiration to players

## Discovery & Secrets

Hidden surprises that reward exploration and make the party feel alive. None of these are announced — players discover them organically.

### Shiny Dinos
- ~5% chance when scanning a dino QR that the instance is "shiny" — a sparkle/shimmer effect on the sprite
- No gameplay difference, pure bragging rights
- Visible in the plaza — other players will notice
- Feed post: "Sarah found a ✨SHINY✨ Spinosaurus!"

### Explorer's Notes
- 5 hidden QR codes placed in sneaky spots around the party (taped under a table, inside a cabinet, behind a plant, etc.)
- Each reveals a silly lore entry written as an ARK-style explorer's note — narrating why dinosaurs crashed Alex's birthday
- No XP reward — pure flavor and collectibility
- Tracked in the player's profile: "Explorer's Notes: 3/5 found"
- Example notes:
  - Note #1: "Day 1. Arrived at what the locals call 'Alex's Birthday.' The creatures here are... friendly? One tried to eat my hat."
  - Note #2: "Day 3. The Mejoberry supply is running low. The herbivores have started eyeing the veggie platter with alarming intensity."

### Secret Recipes (Cooking Pot Combos)
- Multiple cooking pot QR codes at different drink stations (not just one)
- Each station has its own themed QR (e.g., "Potion of Fire" at the hot sauce station, "Elixir of Calm" at the beer cooler, "Berry Brew" at the juice bar)
- Scanning any single station gives normal event rewards (25 XP + random item)
- But certain combinations unlock a rare hat. Players don't know the combos — they have to experiment and compare notes with other guests
- Example combos:
  - "Potion of Fire" + "Elixir of Calm" → "Mad Scientist" hat
  - "Berry Brew" + "Potion of Fire" + "Elixir of Calm" → "Master Chef" hat
- Combos checked client-side against the player's scanned events — no extra backend needed

### Dino Flavor Text
- Each species has a funny bio displayed on the dino detail screen
- Written specifically for the party context, ARK-inspired
- Examples:
  - T-Rex: "The apex predator of the party. Will fight you for the last chicken wing."
  - Pachycephalosaurus: "Known for headbutting the snack table. Approach from behind."
  - Dilophosaurus: "Will absolutely spit on you if you don't bring it meat. Just like Alex's cat."
  - Ankylosaurus: "Built like a tank. Immune to peer pressure and spicy food."

### Achievement Badges
- Fun badges that appear on your profile when milestones are hit
- Not announced beforehand — players discover them when they earn one
- Badge list:
  - "First Blood" — tame your first dino
  - "Gotta Tame 'Em All" — collect all 7 species
  - "Social Butterfly" — play with 5+ different people
  - "Trivia Master" — answer 3 trivia questions correctly
  - "Alex's Favorite" — receive Inspiration
  - "Explorer" — find all 5 explorer's notes
  - "Shiny Hunter" — own a shiny dino
  - "Mad Scientist" — unlock a secret recipe
  - "Kaiju Slayer" — participate in the boss fight
  - "Party Animal" — scan 3+ party event QRs
- Checked client-side against player data — no backend changes needed

## Boss Fight — Godzilla Raid

### Trigger
Host triggers the boss fight from the admin panel when the moment feels right (suggested: peak energy, ~2 hours in).

### Mechanics
- WebSocket push to all connected players: "GODZILLA IS ATTACKING THE PLAZA!"
- Banner appears on whatever screen players are on
- Tap-to-attack: each tap deals damage. Damage per tap = base (e.g., 5) + bonus from all dinos' combined levels (e.g., +1 per total level — a player with three dinos at Lv3, Lv2, Lv1 = 6 bonus = 11 dmg/tap). All dinos contribute, not just the partner.
- Godzilla HP scales to active player count (~300 HP per player, so ~2–3 minutes of collective tapping)
- Live HP bar on everyone's screen
- Visual feedback: damage numbers, screen shakes on big hits
- Players with no dinos can still participate at base damage

### Victory
- Godzilla falls → victory screen with confetti
- "Party MVP" shoutout for top damage dealer
- Everyone who participated gets a commemorative "Kaiju Slayer" hat

## Admin Panel

Secret URL, accessible only to the host. No auth needed (obscurity is fine for a party game).

- **Dashboard**: player count, dinos tamed, total feed events
- **Boss fight**: trigger start, see HP bar live, trigger manually if needed
- **Announcements**: post messages to the feed ("Boss fight in 10 minutes!", "Go find the dinos!")
- **Player list**: see all players and their dinos (for troubleshooting)

## Backend Architecture

### DynamoDB Single Table

| PK                     | SK                          | Data                                                    |
|------------------------|-----------------------------|---------------------------------------------------------|
| `PLAYER#<id>`         | `PROFILE`                   | name, photo_url, created_at                             |
| `PLAYER#<id>`         | `DINO#<species>`            | name, colors, gender, nature, hat, xp, level, is_partner, tamed, shiny |
| `PLAYER#<id>`         | `ITEM#<id>`                 | type (hat/paint), name, details                         |
| `PLAYER#<id>`         | `INSPIRATION`               | received (boolean), received_at                         |
| `PLAZA`               | `PARTNER#<player_id>`       | species, position, hat, colors, level, name, owner_name, owner_photo |
| `LOBBY#<code>`        | `META`                      | host_id, guest_id, status, trivia_question, created_at, expires_at |
| `BOSS`                | `STATE`                     | hp, max_hp, status (waiting/active/defeated), started_at |
| `FEED`                | `<timestamp>#<id>`          | type, message, player_name, details                     |
| `COOLDOWN#<p1>#<p2>`  | `META`                      | expires_at (TTL for auto-cleanup)                       |
| `EVENT#<player_id>`   | `<event_type>`              | claimed_at (prevents double-claiming)                   |
| `PLAYER#<id>`         | `NOTE#<note_id>`            | found_at                                                |

### REST Endpoints

| Method | Path                        | Purpose                                      |
|--------|-----------------------------|----------------------------------------------|
| POST   | `/player`                   | Create player (name, photo)                  |
| GET    | `/player/<id>`              | Get player data, dinos, items                |
| POST   | `/scan/dino/<species>`      | Encounter a dino (mints instance if new)     |
| POST   | `/scan/food/<type>`         | List untamed dinos of matching diet; tame selected one |
| POST   | `/scan/event/<type>`        | Claim event XP + item, post to feed          |
| POST   | `/scan/inspiration`         | Receive Alex's Inspiration (once per player) |
| POST   | `/scan/note/<note_id>`      | Discover an explorer's note (once per player)|
| POST   | `/lobby`                    | Create a lobby (returns 3-symbol code)       |
| POST   | `/lobby/<code>/join`        | Join a lobby                                 |
| POST   | `/lobby/<code>/answer`      | Submit trivia answer                         |
| POST   | `/boss/tap`                 | Send tap damage during boss fight            |
| PUT    | `/dino/<species>/customize` | Rename, equip hat, apply paint               |
| PUT    | `/dino/<species>/partner`   | Set this dino as your plaza partner          |
| POST   | `/admin/boss/start`         | Trigger boss fight (admin only)              |
| POST   | `/admin/announce`           | Post announcement to feed (admin only)       |
| GET    | `/admin/dashboard`          | Get stats (admin only)                       |

### WebSocket Channels

| Channel         | Events                                                |
|-----------------|-------------------------------------------------------|
| `plaza`         | dino_move, dino_arrive, dino_leave, crown_change      |
| `lobby:<code>`  | player_joined, trivia_question, trivia_result, play_animation |
| `boss`          | boss_start, hp_update, damage_dealt, boss_defeated    |
| `feed`          | new_entry                                             |

Players subscribe to `plaza` and `feed` on connect. `lobby:<code>` is subscribed when entering a lobby. `boss` is subscribed when the boss fight starts.

### S3

- Bucket for profile pics
- 7-day lifecycle policy (auto-delete after the party)
- Images compressed client-side before upload to keep small

## Frontend Architecture

- **Framework**: Preact (~3KB) or vanilla JS — decision deferred to implementation
- **Routing**: Hash-based (`/#/plaza`, `/#/dinos`, `/#/play`, `/#/feed`, `/#/profile`)
- **QR URL format**: `https://<site>/#/scan/dino/<species>`, `/#/scan/food/<type>`, `/#/scan/event/<type>`, `/#/scan/inspiration`, `/#/scan/note/<note_id>`
- **Plaza rendering**: `<canvas>` element for top-down pixel art with sprite rendering
- **State**: Simple client-side state (no Redux). Player data fetched on load, WebSocket for live updates.
- **Profile pic capture**: `<input type="file" accept="image/*" capture>` — works on all mobile browsers
- **Offline handling**: Minimal. If connection drops, show a reconnecting indicator. This is a party game at a house with WiFi.

## Sprite System

- Player provides pixel art sprites for all 7 species + Godzilla
- Each species has multiple colorable regions (e.g., body, crest, belly, stripes)
- At encounter time, random colors are assigned to each region
- Colors stored as hue/saturation shifts applied to the base sprite
- Paint items let players change one region's color
- Hats rendered as overlays positioned per-species
- Level scaling: sprite rendered at 1.0x (Lv1) up to ~1.4x (Lv5)

## XP Economy

| Source                    | XP     | Items                        |
|---------------------------|--------|------------------------------|
| Social play (base)        | 30 XP  | 1 random hat                 |
| Social play trivia bonus  | +20 XP | chance of rare hat           |
| Party event               | 25 XP  | 1 random item (hat or paint) |
| Alex's Inspiration        | 50 XP  | "Birthday Girl's Blessing" hat |

**Leveling curve**: 100 XP per level, cap at Level 5 (500 XP total).

A player who tames all 7 dinos and spreads XP around could reasonably get 2–3 dinos to Lv3+ during a party. A focused grinder could max one dino. This feels right for the event duration.

## Trivia Question Pool

~30–50 multiple-choice dinosaur trivia questions. Examples:
- "What period did the T-Rex live in?" (Cretaceous)
- "How many horns does a Triceratops have?" (Three)
- "What does Pachycephalosaurus mean?" (Thick-headed lizard)
- "Which dinosaur had a sail on its back?" (Spinosaurus)
- "What did Ankylosaurus use its tail club for?" (Defense)

Questions are stored server-side and selected randomly by the server when a lobby match is confirmed. The selected question is pushed to both players via WebSocket.

## Party Timeline (Suggested)

| Phase       | Timing          | Activity                                              |
|-------------|-----------------|-------------------------------------------------------|
| Discovery   | First 1–2 hours | Guests arrive, scan QR to join, find and tame dinos   |
| Social      | Mid-party       | Playing together, trivia, cooking pot, leveling up     |
| Boss Fight  | Peak energy     | Host triggers Godzilla, 2–3 min collective fight      |
| Afterglow   | Post-boss       | Plaza shows everyone's dinos, compare collections     |

## Natures Pool

Randomly assigned, no mechanical effect. Displayed on dino detail screen for personality flavor:

Bold, Jolly, Timid, Brave, Gentle, Quirky, Hasty, Calm, Sassy, Naive, Lonely, Adamant, Naughty, Relaxed, Modest

## Out of Scope

- User accounts / authentication
- Persistent data beyond the party (though the DB will stick around)
- In-app QR scanner (native camera handles this)
- Complex battle mechanics (this is tamagotchi, not diablo)
- Offline play
- Push notifications
