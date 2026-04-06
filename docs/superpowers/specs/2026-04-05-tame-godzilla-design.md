# Tame Godzilla After Boss Defeat

## Summary

After defeating Godzilla in the boss fight, players can scan a hidden QR code to add Godzilla to their collection as a bonus 8th dino. He arrives pre-tamed (no food step) and works exactly like any other dino: colors, hats, naming, leveling, partner, plaza display.

## Rules

- Godzilla has his own QR code (scans as `godzilla` species)
- QR code only works after boss status is `"defeated"` -- otherwise returns a silent rejection
- Godzilla is created **pre-tamed** (`tamed: True`) on scan -- no food harvesting required
- Auto-sets as partner if player has no current partner (same as existing taming flow)
- 5% shiny chance, random colors/gender/nature like all other dinos
- Excluded from "collect all 7 species" completionist rewards (prismatic paint)
- Fully supports: rename, hat equip, paint, background, set as partner, XP/leveling, plaza display

## Backend Changes

### game_data.py

Add godzilla to `SPECIES` dict:

```python
"godzilla": {
    "name": "Godzilla",
    "diet": "carnivore",
    "food": "meat",
    "regions": ["body", "spines", "belly"],
}
```

Diet/food are included for schema consistency but won't be used since godzilla is pre-tamed.

### scan_dino.py

Add godzilla-specific logic in the handler:

1. If `species == "godzilla"`:
   - Check `BOSS` / `STATE` record in DynamoDB
   - If boss status != `"defeated"` -> return generic "not available" response (silent fail, no error details)
   - If defeated -> create dino record with `tamed: True` (skip food step)
   - Auto-set as partner if player has none
   - Skip the `has_food` check in response
2. All other species flow unchanged

### scan_food.py (completionist check)

Exclude `"godzilla"` from the "all species tamed" count so the existing 7-species prismatic paint reward is unaffected.

### No changes needed

- `dino.py` -- customize/partner handlers are species-agnostic
- `plaza.py` -- partner fetch is species-agnostic
- `boss.py` -- no changes to boss fight mechanics

## Frontend Changes

### species.js

Add godzilla entry:

```js
godzilla: {
  id: 'godzilla',
  name: 'Godzilla',
  diet: 'carnivore',
  food: 'meat',
  regions: ['body', 'spines', 'belly'],
  flavor: "Former city destroyer, now party guest.",
}
```

### No changes needed

- `DinoDetail.jsx` -- renders any species dynamically
- `Plaza.jsx` / `PlazaCanvas.js` -- partner system is species-agnostic
- `BossVictory.jsx` -- no mention of godzilla needed here

## DynamoDB

Uses existing patterns, no schema changes:

| PK | SK | Notes |
|----|-----|-------|
| `PLAYER#{id}` | `DINO#godzilla` | Standard dino record, `tamed: True` on creation |

## QR Code

The QR code should point to the same scan URL pattern as other dinos: `/#scan/dino/godzilla`. The code will be physically hidden until after the boss fight.
