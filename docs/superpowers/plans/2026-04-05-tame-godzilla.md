# Tame Godzilla Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players scan a QR code after the boss fight to add Godzilla as a tame-able, fully customizable 8th dino.

**Architecture:** Add `godzilla` to the species dict (backend + frontend), gate the scan_dino handler behind a boss-defeated check, create the dino pre-tamed, and fix the prismatic paint check to exclude godzilla from the "all 7" count.

**Tech Stack:** Python 3.12 (Lambda handlers), Preact (frontend), DynamoDB, pytest

---

### Task 1: Add Godzilla to Backend Species Data

**Files:**
- Modify: `backend/src/shared/game_data.py:3-11`
- Modify: `backend/tests/test_game_data.py:18-19`

- [ ] **Step 1: Update the species count test**

In `backend/tests/test_game_data.py`, change the species count test to expect 8:

```python
def test_species_count():
    assert len(SPECIES) == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_game_data.py::test_species_count -v`
Expected: FAIL — `assert 7 == 8`

- [ ] **Step 3: Add godzilla to SPECIES and add BASE_SPECIES constant**

In `backend/src/shared/game_data.py`, add godzilla to `SPECIES` and a constant for the base 7 species count:

```python
SPECIES = {
    "trex": {"name": "T-Rex", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "spinosaurus": {"name": "Spinosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "sail", "belly"]},
    "dilophosaurus": {"name": "Dilophosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "frill", "crest"]},
    "pachycephalosaurus": {"name": "Pachycephalosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "dome", "spots"]},
    "parasaurolophus": {"name": "Parasaurolophus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "crest", "belly"]},
    "triceratops": {"name": "Triceratops", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "frill", "horns"]},
    "ankylosaurus": {"name": "Ankylosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "armor", "club"]},
    "godzilla": {"name": "Godzilla", "diet": "carnivore", "food": "meat", "regions": ["body", "spines", "belly"]},
}

# The 7 base species — godzilla is a bonus and excluded from completionist checks
BASE_SPECIES_COUNT = 7
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_game_data.py -v`
Expected: All PASS (species count is now 8, godzilla has all required fields)

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/game_data.py backend/tests/test_game_data.py
git commit -m "feat: add godzilla to species data with BASE_SPECIES_COUNT constant"
```

---

### Task 2: Fix Prismatic Paint Check to Exclude Godzilla

**Files:**
- Modify: `backend/src/handlers/scan_food.py:24-29`

- [ ] **Step 1: Write test for prismatic paint not triggering on godzilla tame**

Add to `backend/tests/test_scan_food.py`:

```python
def test_prismatic_not_granted_by_godzilla():
    """Godzilla doesn't count toward the 7-species prismatic paint."""
    from src.handlers.scan_food import _check_all_tamed
    from src.shared.db import get_item

    put_item({"PK": "PLAYER#pgz", "SK": "PROFILE", "name": "Zilla Fan"})
    # 6 base species tamed + godzilla tamed = 7 tamed, but should NOT trigger prismatic
    for sp in ["trex", "spinosaurus", "dilophosaurus", "pachycephalosaurus", "parasaurolophus", "triceratops"]:
        put_item({"PK": "PLAYER#pgz", "SK": f"DINO#{sp}", "tamed": True})
    put_item({"PK": "PLAYER#pgz", "SK": "DINO#godzilla", "tamed": True})

    _check_all_tamed("pgz")

    # Should NOT have prismatic — only 6 of 7 base species
    items = [get_item("PLAYER#pgz", f"ITEM#{i}") for i in range(10)]
    paints = [i for i in items if i and i.get("type") == "paint" and i.get("details", {}).get("paint_id") == "prismatic"]
    assert len(paints) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_scan_food.py::test_prismatic_not_granted_by_godzilla -v`
Expected: FAIL — prismatic is granted because `tamed_count (7) >= len(SPECIES) (8)` actually passes as False now... Wait — with 8 species, 7 tamed < 8 so it actually won't trigger. The real risk is the opposite: a player who tames all 7 base species now has `tamed_count=7 < len(SPECIES)=8`, so prismatic NEVER triggers.

Let me rewrite the test:

```python
def test_prismatic_granted_with_all_base_species():
    """Prismatic triggers when all 7 base species are tamed, even without godzilla."""
    from src.handlers.scan_food import _check_all_tamed
    from src.shared.db import query_pk

    put_item({"PK": "PLAYER#ppr", "SK": "PROFILE", "name": "Collector"})
    for sp in ["trex", "spinosaurus", "dilophosaurus", "pachycephalosaurus", "parasaurolophus", "triceratops", "ankylosaurus"]:
        put_item({"PK": "PLAYER#ppr", "SK": f"DINO#{sp}", "tamed": True})

    _check_all_tamed("ppr")

    items = query_pk("PLAYER#ppr", sk_prefix="ITEM#")
    paints = [i for i in items if i.get("type") == "paint" and i.get("details", {}).get("paint_id") == "prismatic"]
    assert len(paints) == 1
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_scan_food.py::test_prismatic_granted_with_all_base_species -v`
Expected: FAIL — `tamed_count (7) >= len(SPECIES) (8)` is False, so prismatic is never granted

- [ ] **Step 4: Fix _check_all_tamed to use BASE_SPECIES_COUNT**

In `backend/src/handlers/scan_food.py`, update the import and function:

Change the import line:
```python
from ..shared.game_data import SPECIES
```
to:
```python
from ..shared.game_data import SPECIES, BASE_SPECIES_COUNT
```

Change `_check_all_tamed`:
```python
def _check_all_tamed(player_id):
    """Grant prismatic rare paint when the player has tamed all 7 base species."""
    all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
    tamed_base = sum(1 for d in all_dinos if d.get("tamed") and d["SK"].replace("DINO#", "") != "godzilla")
    if tamed_base >= BASE_SPECIES_COUNT:
        grant_rare_paint(player_id, "prismatic")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_scan_food.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/scan_food.py backend/tests/test_scan_food.py
git commit -m "fix: use BASE_SPECIES_COUNT for prismatic paint check, exclude godzilla"
```

---

### Task 3: Gate Godzilla Scan Behind Boss Defeat

**Files:**
- Modify: `backend/src/handlers/scan_dino.py:10-92`
- Modify: `backend/tests/test_scan_dino.py`

- [ ] **Step 1: Write test for godzilla scan when boss not defeated**

Add to `backend/tests/test_scan_dino.py`:

```python
def test_godzilla_rejected_before_boss_defeated():
    put_item({"PK": "PLAYER#pg1", "SK": "PROFILE", "name": "Eager"})
    # No boss state at all
    event = _event({"player_id": "pg1", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body.get("not_available") is True


def test_godzilla_rejected_boss_active():
    put_item({"PK": "PLAYER#pg2", "SK": "PROFILE", "name": "Impatient"})
    put_item({"PK": "BOSS", "SK": "STATE", "status": "active", "hp": 500, "max_hp": 900})
    event = _event({"player_id": "pg2", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body.get("not_available") is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_scan_dino.py::test_godzilla_rejected_before_boss_defeated tests/test_scan_dino.py::test_godzilla_rejected_boss_active -v`
Expected: FAIL — godzilla is a valid species now so handler creates a normal wild dino instead of returning `not_available`

- [ ] **Step 3: Write test for successful godzilla scan after boss defeated**

Add to `backend/tests/test_scan_dino.py`:

```python
def test_godzilla_tamed_after_boss_defeated():
    put_item({"PK": "PLAYER#pg3", "SK": "PROFILE", "name": "Victor"})
    put_item({"PK": "BOSS", "SK": "STATE", "status": "defeated", "hp": 0, "max_hp": 900})

    event = _event({"player_id": "pg3", "species": "godzilla"})
    event["pathParameters"]["species"] = "godzilla"
    resp = handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["species"] == "godzilla"
    assert body["tamed"] is True
    assert "colors" in body

    item = get_item("PLAYER#pg3", "DINO#godzilla")
    assert item is not None
    assert item["tamed"] is True
```

- [ ] **Step 4: Implement godzilla gate in scan_dino handler**

In `backend/src/handlers/scan_dino.py`, add the godzilla-specific logic. After the `player_id` check and profile lookup, before the `existing` check, add the godzilla gate. Also update the dino creation to set `tamed: True` for godzilla.

Full updated handler:

```python
import json
import uuid
from datetime import datetime, timezone
from ..shared.db import put_item, get_item, query_pk, update_item
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

    # Godzilla requires boss to be defeated
    if species == "godzilla":
        boss = get_item("BOSS", "STATE")
        if not boss or boss.get("status") != "defeated":
            return success({"not_available": True, "species": "godzilla"})

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
    colors = random_colors(species_data["regions"], shiny=shiny)
    gender = random_gender()
    nature = random_nature()

    # Godzilla arrives pre-tamed; other dinos start wild
    is_godzilla = species == "godzilla"
    tamed = True if is_godzilla else False

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
        "tamed": tamed,
        "shiny": shiny,
        "name": "",
    }
    put_item(dino)

    # Auto-set as partner if player has none (for pre-tamed godzilla)
    first_partner = False
    if is_godzilla:
        all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
        has_partner = any(d.get("is_partner") for d in all_dinos)
        if not has_partner:
            update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"is_partner": True})
            put_item({
                "PK": "PLAZA",
                "SK": f"PARTNER#{player_id}",
                "species": species,
                "hat": "",
                "colors": colors,
                "level": 1,
                "name": "",
                "gender": gender,
                "owner_name": profile.get("name", ""),
                "owner_photo": profile.get("photo_url", ""),
            })
            try:
                broadcast("plaza", "dino_arrive", {
                    "player_id": player_id,
                    "species": species,
                    "name": "",
                    "hat": "",
                    "colors": colors,
                    "level": 1,
                    "owner_name": profile.get("name", ""),
                    "owner_photo": profile.get("photo_url", ""),
                })
            except Exception:
                pass
            first_partner = True

    feed_msg = f"✨SHINY✨ {species_data['name']}" if shiny else species_data['name']
    if is_godzilla:
        feed_entry_message = f"{profile['name']} tamed Godzilla! 🦎👑"
    else:
        feed_entry_message = f"{profile['name']} encountered a wild {feed_msg}!"
    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        feed_sk = f"{ts}#{uuid.uuid4()}"
        put_item({
            "PK": "FEED",
            "SK": feed_sk,
            "type": "tamed" if is_godzilla else "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
        })
        broadcast("feed", "new_entry", {
            "id": feed_sk,
            "type": "tamed" if is_godzilla else "encounter",
            "message": feed_entry_message,
            "player_name": profile["name"],
            "timestamp": ts,
        })
    except Exception:
        pass

    result = {
        "species": species,
        "colors": colors,
        "gender": gender,
        "nature": nature,
        "shiny": shiny,
        "tamed": tamed,
        "already_owned": False,
    }

    if is_godzilla:
        result["first_partner"] = first_partner
    else:
        # Only include food info for normal dinos
        food_type = species_data["food"]
        has_food = get_item(f"FOOD#{player_id}", food_type) is not None
        result["diet"] = species_data["diet"]
        result["food"] = species_data["food"]
        result["has_food"] = has_food

    return success(result)
```

- [ ] **Step 5: Run all scan_dino tests**

Run: `cd backend && python -m pytest tests/test_scan_dino.py -v`
Expected: All PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/handlers/scan_dino.py backend/tests/test_scan_dino.py
git commit -m "feat: gate godzilla scan behind boss defeat, create pre-tamed"
```

---

### Task 4: Add Godzilla to Frontend Species Data

**Files:**
- Modify: `frontend/src/data/species.js`

- [ ] **Step 1: Add godzilla entry to species.js**

Add to the `SPECIES` object in `frontend/src/data/species.js`, after ankylosaurus:

```js
godzilla: {
  id: 'godzilla', name: 'Godzilla', diet: 'carnivore', food: 'meat',
  regions: ['body', 'spines', 'belly'],
  flavor: "Former city destroyer, now party guest.",
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/data/species.js
git commit -m "feat: add godzilla to frontend species data"
```

---

### Task 5: Add Godzilla QR Code to Admin Panel

**Files:**
- Modify: `frontend/src/components/AdminQRCodes.jsx:8-14`

- [ ] **Step 1: Add godzilla to the QR code list**

In `frontend/src/components/AdminQRCodes.jsx`, add to the dino QR codes array after the triceratops entry:

```js
{ label: 'Godzilla', route: '/scan/dino/godzilla', sub: 'Boss Reward', subColor: '#f59e0b' },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AdminQRCodes.jsx
git commit -m "feat: add godzilla QR code to admin panel"
```

---

### Task 6: Deploy Backend

**Files:** None (CDK deploy only)

- [ ] **Step 1: Deploy**

Run: `cd infra && npx cdk deploy`

This picks up the new godzilla species in game_data.py and the updated scan_dino handler automatically since the Lambda code is bundled from `backend/src/`.

- [ ] **Step 2: Verify**

Test the endpoint manually:
- Without boss defeated: `POST /scan/dino/godzilla` should return `{"not_available": true}`
- After boss is defeated: should return a tamed godzilla with colors, nature, etc.
