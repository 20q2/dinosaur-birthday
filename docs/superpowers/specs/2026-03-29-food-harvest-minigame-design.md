# Food Harvest Minigame Design

## Goal

Replace the static "FOOD HARVESTED!" screen with a short interactive minigame that plays every time a player scans a food QR code. Awards a small flat XP reward per play. No cooldown — grinding is fine at a birthday party.

## Decisions

| Decision | Choice |
|---|---|
| Meat minigame | Timing Tap (C) |
| Berry minigame | Whack-a-Food (A) |
| Repeatable? | Yes, every scan |
| Cooldown | None |
| XP per play | 5 XP (flat, no performance scaling) |
| Architecture | Single `HarvestMinigame.jsx` with `foodType` prop |

---

## User Flow

1. Player scans food QR → navigates to `/scan/food/meat` or `/scan/food/mejoberries`
2. `FoodHarvest.jsx` mounts → fires `api.scanFood()` in background, renders `<HarvestMinigame>`
3. **Get Ready phase** — food icon + instruction text + 3-2-1 countdown (1.5s per beat)
4. **Playing phase** — minigame runs (~10s)
5. **Results phase** — score + `+5 XP` + optional "Feed a Dino!" button

The API call fires on mount (hidden behind the countdown) so taming eligibility is known by the time the results screen appears.

---

## Frontend

### Files changed

- **Modify** `frontend/src/components/FoodHarvest.jsx` — replace phase-1 body with `<HarvestMinigame>`. Keep phase-2 `<DinoTaming>` transition unchanged.
- **Create** `frontend/src/components/HarvestMinigame.jsx` — all minigame logic

### Integration with `FoodHarvest.jsx`

`FoodHarvest` fires `api.scanFood()` on mount (as it does today) and stores the result in state. It renders `<HarvestMinigame>` as its phase-1 screen, passing `apiResult` (null while the API call is in flight). When the minigame finishes, it sets `phase = 'taming'` if `apiResult` indicates untamed dinos, otherwise navigates to `/plaza`. This mirrors the existing phase-switch pattern in `FoodHarvest`.

### `HarvestMinigame` props

```js
<HarvestMinigame
  foodType="meat"          // "meat" | "mejoberries"
  apiResult={result}       // from api.scanFood() — null while API is in-flight
  onComplete={() => {}}    // called when player taps the post-game action button
/>
```

`onComplete` is called without arguments. `FoodHarvest` reads `result` from its own state to decide the next step (tame vs. plaza).

### Component phases

```
phase: 'ready' → 'playing' → 'results'
```

State:
- `phase` — current phase
- `score` — items caught / perfect taps
- `total` — max possible score (for display: "12 / 15")
- `countdown` — 3/2/1 during ready phase (useEffect interval)

### Timing Tap (meat)

- **Rounds**: 6
- **Per round**: an outer ring shrinks inward over 1.5s. Ring animates via CSS `transform: scale()` driven by `requestAnimationFrame` or a `useEffect` interval (16ms tick).
- **Sweet spot**: inner 30% of the ring radius = "PERFECT" (2pts) ; 30–60% = "GOOD" (1pt) ; outside/miss = 0pts
- **Miss detection**: if player doesn't tap within the 1.5s window, auto-advance as a miss
- **Feedback flash**: "PERFECT ✦" / "GOOD" / "MISS" text, fades out in 0.5s
- **Score display**: dot indicators (●●○○○○) showing perfects earned per round
- **Max score**: 12 (6 rounds × 2pts)

Ring progress value `t` (0→1 over 1.5s) determines visual ring radius. Tap registers `t` at moment of tap:
- `t >= 0.7` (ring near centre) → PERFECT
- `t >= 0.4` → GOOD
- `t < 0.4` → MISS

### Whack-a-Food (mejoberries)

- **Duration**: 10 seconds
- **Items**: mejoberry images (`berryImg`) appear at random positions within the play area (a fixed-height div, `position:relative`)
- **Item lifespan**: each item visible for 1.0–1.4s (random), then fades/pops out untapped
- **Spawn rate**: new item every 0.7s; up to 4 items on screen simultaneously
- **Tap**: `onClick` on item div → item disappears with a quick scale-up-and-fade animation, score +1
- **Timer bar**: purple progress bar depleting over 10s (CSS transition driven by a `useEffect` interval)
- **Max score**: ~14 (time / spawn-rate ceiling; displayed as "X / Y" where Y = total spawned)
- **Item positions**: random `left` (5–75%) and `top` (5–80%) within play area, ensuring no overflow

### Results screen (shared)

```
[HUNT COMPLETE / FORAGE COMPLETE]
  [score] / [total]
  perfect catches / berries collected

  ┌───────────────────────┐
  │  XP Earned    +5 XP   │
  └───────────────────────┘

  [Feed a Dino!]  ← only if canTame
  Back to Plaza
```

"Feed a Dino!" shown only when `apiResult` has untamed dinos of the right diet. Transitions to `DinoTaming` via `onDone`.

### Styling

- Meat theme: `background: #1a1008`, accent `#f87171` / `#fbbf24` (warm red/amber)
- Berry theme: `background: #1a1035`, accent `#a78bfa` (purple)
- Matches existing dark theme from `FoodHarvest.jsx`
- All inline styles (no CSS files) per project convention

---

## Backend

### File changed

`backend/src/handlers/scan_food.py`

### What changes

Remove the one-time harvest gate. `_harvest()` currently:
1. Checks for existing `FOOD#{player_id}:food_type` record → returns `{first_time: False}` if found
2. On first harvest: creates that record, awards 10 XP

**New behaviour**: always award 5 XP, never write/read the `FOOD#` record. Remove the `FOOD#` DynamoDB record entirely from this handler.

```python
def _harvest(player_id, food_type, profile):
    """Award XP for harvesting food. Called on every scan."""
    dino_result = award_xp(player_id, 5)
    return {
        "xp_awarded": 5,
        "dino": dino_result,
        "no_partner": dino_result is None,
    }
```

Response shape changes: remove `first_time` field (frontend no longer uses it). All other response fields (`tamed`, `already_tamed`, `harvest_only`, `choose_species`, `harvest`) remain identical so `DinoTaming` and other downstream consumers are unaffected.

The feed broadcast for harvesting ("PlayerName harvested Meat!") is also removed — it was tied to first-time only and would be spammy if called every scan.

### Existing `FOOD#` records in DynamoDB

Old records (`PK=FOOD#{player_id}`, `SK=meat|mejoberries`) are orphaned but harmless — they are no longer read or written.

---

## Testing

### Backend

- `POST /scan/food/meat` → always returns `harvest.xp_awarded = 5`
- Calling twice in a row both return XP (no one-time gate)
- Taming logic still works: untamed dinos get tamed, `first_partner` auto-set still fires
- `pytest` — all existing tests pass (harvest one-time tests will need updating)

### Frontend

- Scan meat QR → timing tap minigame plays, results show "+5 XP", "Feed a Dino!" if eligible
- Scan berry QR → whack-a-food plays, same results screen
- Scan again immediately → minigame plays again, +5 XP again
- If no untamed dinos → "Feed a Dino!" button absent, "Back to Plaza" only
- `apiResult` still null during "Get Ready" phase → results screen waits for it before rendering XP/taming rows (show spinner if needed)
